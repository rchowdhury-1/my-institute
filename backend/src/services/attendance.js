const { notify, notifyAdmins } = require('../lib/notify');
const { formatSessionTime } = require('../lib/datetime');
const { getDisplayName } = require('../lib/queries');
const { ATTENDANCE_EARLY_MS, ATTENDANCE_LATE_MS, RENEWAL_REMINDER_HOURS } = require('../config');

// Teachers may only mark attendance from 15 min before the session to 24h
// after; admin/supervisor have no window restriction.
function checkAttendanceWindow(session, userRole) {
  if (userRole !== 'teacher') return null;

  const sessionStart = new Date(session.scheduled_at);
  const now = new Date();
  const windowStart = new Date(sessionStart.getTime() - ATTENDANCE_EARLY_MS);
  const windowEnd = new Date(sessionStart.getTime() + ATTENDANCE_LATE_MS);

  if (now < windowStart)
    return {
      status: 403,
      error: 'Attendance can only be marked from 15 minutes before the session',
      code: 'ATTENDANCE_TOO_EARLY',
    };
  if (now > windowEnd)
    return {
      status: 403,
      error: 'Attendance window has closed (24 hours after session). Contact admin.',
      code: 'ATTENDANCE_WINDOW_CLOSED',
    };
  return null;
}

function deriveAttendanceStatus(teacherAttended, studentAttended) {
  if (!teacherAttended) return 'cancelled_teacher';
  if (studentAttended) return 'completed';
  return 'no_show';
}

// Renders "${n} unit" or "${n} units" — shared by every low-balance /
// renewal-reminder message so a count of exactly 1 is never pluralized.
function pluralize(n, unit) {
  return `${n} ${unit}${n !== 1 ? 's' : ''}`;
}

// LOCKED decrement rules: completed/no_show consume the slot (decrement by
// duration_minutes/60); cancelled_teacher does not decrement. Clamped at 0.
// Schedule-based sessions decrement weekly_schedules.lessons_remaining
// (hours); legacy sessions decrement packages.sessions_remaining (count).
// Pure persistence only — returns the resulting balance info needed for the
// notification decision, but does not itself send notifications.
async function decrementBalance(pool, session, status) {
  if (status !== 'completed' && status !== 'no_show') return null;

  if (session.schedule_id) {
    await pool.query(
      `UPDATE weekly_schedules
       SET lessons_remaining = GREATEST(0, lessons_remaining - $2::numeric / 60),
           updated_at = NOW()
       WHERE id = $1 AND lessons_remaining IS NOT NULL AND lessons_remaining > 0`,
      [session.schedule_id, session.duration_minutes]
    );

    const sched = await pool.query(
      'SELECT lessons_remaining FROM weekly_schedules WHERE id = $1',
      [session.schedule_id]
    );
    const balance = sched.rows[0]?.lessons_remaining;
    return { kind: 'schedule', balance };
  }

  const pkg = await pool.query(
    'SELECT * FROM packages WHERE user_id=$1 ORDER BY purchased_at DESC LIMIT 1',
    [session.student_id]
  );
  if (pkg.rows.length > 0 && pkg.rows[0].sessions_remaining !== null) {
    const remaining = Math.max(0, pkg.rows[0].sessions_remaining - 1);
    await pool.query('UPDATE packages SET sessions_remaining=$1 WHERE id=$2', [remaining, pkg.rows[0].id]);

    let reminderSent = false;
    if (remaining <= 2 && !pkg.rows[0].renewal_reminder_sent) {
      await pool.query('UPDATE packages SET renewal_reminder_sent=true WHERE id=$1', [pkg.rows[0].id]);
      reminderSent = true;
    }
    return { kind: 'package', remaining, reminderSent };
  }

  return null;
}

// Evaluates the zero/low-balance thresholds against the result of
// decrementBalance and sends the appropriate student + admin notifications.
// Kept separate from decrementBalance so persistence and notification
// concerns don't share one function (F48).
async function notifyIfLowBalance(pool, session, balanceResult) {
  if (!balanceResult) return;

  if (balanceResult.kind === 'schedule') {
    const { balance } = balanceResult;
    if (balance === null || balance === undefined) return;

    if (balance <= 0) {
      const studentName = (await getDisplayName(pool, session.student_id)) || 'A student';
      await notify(session.student_id, 'lesson_balance_zero', 'Hours Balance Empty',
        'You have no hours remaining. Please contact admin to renew.',
        '/student/sessions');
      await notifyAdmins('lesson_balance_zero', 'Student Hours Balance Empty',
        `${studentName} has no hours remaining and needs renewal.`, '/supervisor');
    } else if (balance <= RENEWAL_REMINDER_HOURS) {
      await notify(session.student_id, 'renewal_reminder', 'Renew Your Hours',
        `You have ${pluralize(balance, 'hour')} remaining. Contact us to renew.`,
        '/student/sessions');
      await notifyAdmins('renewal_reminder', 'Student Hours Renewal',
        `A student has ${pluralize(balance, 'hour')} remaining and needs renewal.`, '/supervisor');
    }
    return;
  }

  // kind === 'package'
  const { remaining, reminderSent } = balanceResult;
  if (reminderSent) {
    await notify(session.student_id, 'renewal_reminder', 'Renew Your Package',
      `You have ${pluralize(remaining, 'session')} remaining. Contact us to renew.`,
      '/student/sessions');
    await notifyAdmins('renewal_reminder', 'Student Package Renewal',
      `A student has ${pluralize(remaining, 'session')} remaining and needs renewal.`, '/supervisor');
  }
}

// Decrements the appropriate balance and sends any resulting zero/low-
// balance notifications. Combines decrementBalance + notifyIfLowBalance for
// callers (e.g. markAttendance) that want the original single-call
// behavior.
async function decrementBalanceAndNotify(pool, session, status) {
  const balanceResult = await decrementBalance(pool, session, status);
  await notifyIfLowBalance(pool, session, balanceResult);
}

async function notifyAttendanceMarked(session, status) {
  const dateTime = formatSessionTime(session.scheduled_at);
  if (status === 'completed') {
    await notify(session.student_id, 'attendance_marked', 'Attendance Confirmed',
      `Attendance confirmed for your session on ${dateTime}`, '/student/sessions');
  } else if (status === 'no_show') {
    await notify(session.student_id, 'attendance_marked', 'Marked as No-Show',
      `You were marked as absent for the session on ${dateTime}`, '/student/sessions');
  } else if (status === 'cancelled_teacher') {
    await notify(session.student_id, 'attendance_marked', 'Session Cancelled by Teacher',
      `The session on ${dateTime} was cancelled by the teacher`, '/student/sessions');
  }
}

// Orchestrates a session's attendance mark: window-check, status derivation,
// the UPDATE, balance decrement, and notifications. Returns { status, error,
// code? } for an expected failure, or { session } on success.
async function markAttendance(pool, { session, userId, userRole, teacherAttended, studentAttended }) {
  const windowError = checkAttendanceWindow(session, userRole);
  if (windowError) return windowError;

  const newStatus = deriveAttendanceStatus(teacherAttended, studentAttended);

  const result = await pool.query(
    `UPDATE sessions
     SET status = $1,
         teacher_attended = $2,
         student_attended = $3,
         attendance_marked_at = NOW(),
         attendance_marked_by = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [newStatus, teacherAttended, teacherAttended ? studentAttended : null, userId, session.id]
  );
  const updated = result.rows[0];

  await decrementBalanceAndNotify(pool, session, newStatus);
  await notifyAttendanceMarked(session, newStatus);

  return { session: updated };
}

module.exports = {
  markAttendance,
  checkAttendanceWindow,
  deriveAttendanceStatus,
  decrementBalance,
  decrementBalanceAndNotify,
  notifyIfLowBalance,
  pluralize,
};
