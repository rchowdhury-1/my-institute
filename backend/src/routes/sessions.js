const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../lib/notify');
const { canStudentCancel } = require('../lib/cancellation');
const { formatSessionTime } = require('../lib/datetime');
const { v4: uuidv4 } = require('uuid');
const { generateAllSchedules } = require('../lib/schedule-generator');

const router = express.Router();
router.use(requireAuth);

// GET /sessions
router.get('/', async (req, res) => {
  try {
    // On-demand session generation — idempotent, fills any gaps in the 4-week window
    try {
      await generateAllSchedules();
    } catch (genErr) {
      console.error('[ON-DEMAND] Generation failed (non-blocking):', genErr.message);
    }

    let result;
    if (req.userRole === 'student') {
      result = await pool.query(
        `SELECT s.*, u.display_name AS teacher_name,
                ws.lessons_remaining AS schedule_lessons_remaining
         FROM sessions s
         JOIN users u ON u.id = s.teacher_id
         LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
         WHERE s.student_id = $1
         ORDER BY s.scheduled_at DESC`,
        [req.userId]
      );
    } else if (req.userRole === 'teacher') {
      result = await pool.query(
        `SELECT s.*, u.display_name AS student_name,
                ws.lessons_remaining AS schedule_lessons_remaining
         FROM sessions s
         JOIN users u ON u.id = s.student_id
         LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
         WHERE s.teacher_id = $1
         ORDER BY s.scheduled_at DESC`,
        [req.userId]
      );
    } else {
      // admin / supervisor
      result = await pool.query(
        `SELECT s.*,
                st.display_name AS student_name,
                t.display_name  AS teacher_name,
                ws.lessons_remaining AS schedule_lessons_remaining
         FROM sessions s
         JOIN users st ON st.id = s.student_id
         JOIN users t  ON t.id  = s.teacher_id
         LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
         ORDER BY s.scheduled_at DESC`
      );
    }
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /sessions  (admin / supervisor only)
router.post('/', requireRole('admin', 'supervisor'), async (req, res) => {
  const { student_id, teacher_id, scheduled_at, duration_minutes, subject, zoom_link } = req.body;
  if (!student_id || !teacher_id || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id and scheduled_at are required' });

  const validSubjects = ['quran', 'arabic', 'islamic_studies'];
  const sessionSubject = validSubjects.includes(subject) ? subject : 'quran';

  const dur = parseInt(duration_minutes) || 60;
  if (dur % 30 !== 0 || dur < 30)
    return res.status(400).json({ error: 'Duration must be 30, 60, 90, or 120 minutes' });

  try {
    // Snapshot the student's current rate at session creation time
    const studentResult = await pool.query(
      "SELECT hourly_rate, currency FROM users WHERE id=$1 AND role='student'",
      [student_id]
    );
    const { hourly_rate = null, currency = null } = studentResult.rows[0] || {};

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO sessions
         (id, student_id, teacher_id, scheduled_at, duration_minutes, subject, zoom_link,
          rate_at_creation, currency_at_creation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, student_id, teacher_id, scheduled_at, dur, sessionSubject, zoom_link || null, hourly_rate, currency]
    );
    const session = result.rows[0];
    const dt = formatSessionTime(scheduled_at);

    await notify(student_id, 'session_scheduled', 'Session Scheduled',
      `A session has been booked for ${dt}`, '/student/sessions');
    await notify(teacher_id, 'session_scheduled', 'Session Scheduled',
      `A session has been scheduled for ${dt}`, '/teacher/dashboard');

    res.status(201).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id — update zoom link (admin / supervisor / teacher)
router.patch('/:id', requireRole('admin', 'supervisor', 'teacher'), async (req, res) => {
  const { zoom_link } = req.body;
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    if (req.userRole === 'teacher' && existing.rows[0].teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `UPDATE sessions SET zoom_link = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [zoom_link || null, id]
    );
    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /sessions/:id  (admin / supervisor only)
router.delete('/:id', requireRole('admin', 'supervisor'), async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const session = existing.rows[0];
    await pool.query('DELETE FROM sessions WHERE id=$1', [id]);
    const dt = formatSessionTime(session.scheduled_at);
    await notify(session.student_id, 'session_cancelled', 'Session Removed',
      `Your session on ${dt} has been removed by admin`, '/student/sessions');
    await notify(session.teacher_id, 'session_cancelled', 'Session Removed',
      `A session on ${dt} has been removed`, '/teacher/dashboard');
    res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id/cancel
router.patch('/:id/cancel', requireRole('student', 'teacher', 'admin', 'supervisor'), async (req, res) => {
  const { cancellation_reason } = req.body;
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = existing.rows[0];

    if (req.userRole === 'student' && session.student_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });
    if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    // 12-hour buffer for students only
    if (req.userRole === 'student') {
      const check = canStudentCancel(session);
      if (!check.allowed)
        return res.status(403).json({ error: check.reason, code: check.code });
    }

    const result = await pool.query(
      `UPDATE sessions SET status='cancelled', cancellation_reason=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [cancellation_reason || null, id]
    );

    const dt = formatSessionTime(session.scheduled_at);
    if (req.userRole === 'student') {
      await notify(session.teacher_id, 'session_cancelled', 'Session Cancelled',
        `Session on ${dt} was cancelled by the student`, '/teacher/dashboard');
    } else {
      await notify(session.student_id, 'session_cancelled', 'Session Cancelled',
        `Your session on ${dt} was cancelled`, '/student/sessions');
    }
    await notifyAdmins('session_cancelled', 'Session Cancelled',
      `Session on ${dt} was cancelled`, '/supervisor');

    res.json({ session: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id/reschedule  (admin / supervisor only — students use /reschedule-requests)
router.patch('/:id/reschedule', requireRole('admin', 'supervisor'), async (req, res) => {
  const { scheduled_at } = req.body;
  const { id } = req.params;
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required' });

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = existing.rows[0];

    await pool.query(
      `UPDATE sessions SET status='rescheduled', last_modified_by=$1, updated_at=NOW() WHERE id=$2`,
      [req.userId, id]
    );

    const newId = uuidv4();
    const result = await pool.query(
      `INSERT INTO sessions (id, student_id, teacher_id, scheduled_at, duration_minutes, subject, rescheduled_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [newId, session.student_id, session.teacher_id, scheduled_at,
       session.duration_minutes, session.subject || 'quran', id]
    );

    const newDt = formatSessionTime(scheduled_at);
    await notify(session.student_id, 'session_rescheduled', 'Session Rescheduled',
      `Your session has been rescheduled to ${newDt}`, '/student/sessions');
    await notify(session.teacher_id, 'session_rescheduled', 'Session Rescheduled',
      `A session has been rescheduled to ${newDt}`, '/teacher/dashboard');
    await notifyAdmins('session_rescheduled', 'Session Rescheduled',
      `Session rescheduled to ${newDt}`, '/supervisor');

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DEPRECATED: replaced by PATCH /sessions/:id/attendance in Phase 4.3
// Kept for backward compatibility — remove after 2026-08-01
router.patch('/:id/complete', requireRole('teacher', 'admin'), async (req, res) => {
  res.set('Deprecation', 'true');
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = existing.rows[0];

    if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    await pool.query(`UPDATE sessions SET status='completed', updated_at=NOW() WHERE id=$1`, [id]);

    // Decrement package sessions_remaining
    const pkg = await pool.query(
      `SELECT * FROM packages WHERE user_id=$1 ORDER BY purchased_at DESC LIMIT 1`,
      [session.student_id]
    );
    if (pkg.rows.length > 0 && pkg.rows[0].sessions_remaining !== null) {
      const remaining = Math.max(0, pkg.rows[0].sessions_remaining - 1);
      await pool.query(`UPDATE packages SET sessions_remaining=$1 WHERE id=$2`, [remaining, pkg.rows[0].id]);

      if (remaining <= 2 && !pkg.rows[0].renewal_reminder_sent) {
        await pool.query(`UPDATE packages SET renewal_reminder_sent=true WHERE id=$1`, [pkg.rows[0].id]);
        await notify(session.student_id, 'renewal_reminder', 'Renew Your Package',
          `You have ${remaining} session${remaining !== 1 ? 's' : ''} remaining. Contact us to renew.`,
          '/student/sessions');
        await notifyAdmins('renewal_reminder', 'Student Package Renewal',
          `A student has ${remaining} sessions remaining and needs renewal.`, '/supervisor');
      }
    }

    res.json({ message: 'Session marked complete' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /sessions/:id/attendance  (teacher within time window, admin/supervisor any time)
router.patch('/:id/attendance', requireRole('student', 'teacher', 'admin', 'supervisor'), async (req, res) => {
  // Students cannot mark attendance
  if (req.userRole === 'student')
    return res.status(403).json({ error: 'Students cannot mark attendance' });

  const { teacher_attended, student_attended } = req.body;
  const { id } = req.params;

  if (typeof teacher_attended !== 'boolean')
    return res.status(400).json({ error: 'teacher_attended (boolean) is required' });
  if (teacher_attended && typeof student_attended !== 'boolean')
    return res.status(400).json({ error: 'student_attended (boolean) is required when teacher attended' });

  try {
    const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Session not found' });

    const session = existing.rows[0];

    // Teacher can only mark their own sessions
    if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    // Time window for teachers: 15 min before to 24h after
    if (req.userRole === 'teacher') {
      const sessionStart = new Date(session.scheduled_at);
      const now = new Date();
      const windowStart = new Date(sessionStart.getTime() - 15 * 60 * 1000);
      const windowEnd = new Date(sessionStart.getTime() + 24 * 60 * 60 * 1000);

      if (now < windowStart)
        return res.status(403).json({
          error: 'Attendance can only be marked from 15 minutes before the session',
          code: 'ATTENDANCE_TOO_EARLY',
        });
      if (now > windowEnd)
        return res.status(403).json({
          error: 'Attendance window has closed (24 hours after session). Contact admin.',
          code: 'ATTENDANCE_WINDOW_CLOSED',
        });
    }

    // Determine status
    let newStatus;
    if (!teacher_attended) {
      newStatus = 'cancelled_teacher';
    } else if (student_attended) {
      newStatus = 'completed';
    } else {
      newStatus = 'no_show';
    }

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
      [newStatus, teacher_attended, teacher_attended ? student_attended : null, req.userId, id]
    );

    const updated = result.rows[0];

    // Decrement lessons_remaining on completed or no_show (lesson slot was consumed)
    // cancelled_teacher does NOT decrement (lesson wasn't consumed)
    if (newStatus === 'completed' || newStatus === 'no_show') {
      if (session.schedule_id) {
        // Schedule-based: decrement weekly_schedules.lessons_remaining
        await pool.query(
          `UPDATE weekly_schedules
           SET lessons_remaining = GREATEST(0, lessons_remaining - 1),
               updated_at = NOW()
           WHERE id = $1 AND lessons_remaining IS NOT NULL AND lessons_remaining > 0`,
          [session.schedule_id]
        );

        // Check balance and notify
        const sched = await pool.query(
          'SELECT lessons_remaining FROM weekly_schedules WHERE id = $1',
          [session.schedule_id]
        );
        const balance = sched.rows[0]?.lessons_remaining;
        if (balance !== null && balance !== undefined) {
          if (balance === 0) {
            // Balance just hit zero — notify student + admins
            const studentName = (await pool.query('SELECT display_name FROM users WHERE id=$1', [session.student_id])).rows[0]?.display_name || 'A student';
            await notify(session.student_id, 'lesson_balance_zero', 'Lesson Balance Empty',
              'Your lesson balance has reached 0. Please contact admin to renew.',
              '/student/sessions');
            await notifyAdmins('lesson_balance_zero', 'Student Lesson Balance Empty',
              `${studentName}'s lesson balance has reached 0 and needs renewal.`, '/supervisor');
          } else if (balance <= 2) {
            await notify(session.student_id, 'renewal_reminder', 'Renew Your Lessons',
              `You have ${balance} lesson${balance !== 1 ? 's' : ''} remaining. Contact us to renew.`,
              '/student/sessions');
            await notifyAdmins('renewal_reminder', 'Student Lesson Renewal',
              `A student has ${balance} lessons remaining and needs renewal.`, '/supervisor');
          }
        }
      } else {
        // Legacy: decrement packages.sessions_remaining (existing logic)
        const pkg = await pool.query(
          'SELECT * FROM packages WHERE user_id=$1 ORDER BY purchased_at DESC LIMIT 1',
          [session.student_id]
        );
        if (pkg.rows.length > 0 && pkg.rows[0].sessions_remaining !== null) {
          const remaining = Math.max(0, pkg.rows[0].sessions_remaining - 1);
          await pool.query('UPDATE packages SET sessions_remaining=$1 WHERE id=$2', [remaining, pkg.rows[0].id]);

          if (remaining <= 2 && !pkg.rows[0].renewal_reminder_sent) {
            await pool.query('UPDATE packages SET renewal_reminder_sent=true WHERE id=$1', [pkg.rows[0].id]);
            await notify(session.student_id, 'renewal_reminder', 'Renew Your Package',
              `You have ${remaining} session${remaining !== 1 ? 's' : ''} remaining. Contact us to renew.`,
              '/student/sessions');
            await notifyAdmins('renewal_reminder', 'Student Package Renewal',
              `A student has ${remaining} sessions remaining and needs renewal.`, '/supervisor');
          }
        }
      }
    }

    // Notify student of attendance record
    const dt = formatSessionTime(session.scheduled_at);
    if (newStatus === 'completed') {
      await notify(session.student_id, 'attendance_marked', 'Attendance Confirmed',
        `Attendance confirmed for your session on ${dt}`, '/student/sessions');
    } else if (newStatus === 'no_show') {
      await notify(session.student_id, 'attendance_marked', 'Marked as No-Show',
        `You were marked as absent for the session on ${dt}`, '/student/sessions');
    } else if (newStatus === 'cancelled_teacher') {
      await notify(session.student_id, 'attendance_marked', 'Session Cancelled by Teacher',
        `The session on ${dt} was cancelled by the teacher`, '/student/sessions');
    }

    res.json({ session: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
