const { v4: uuidv4 } = require('uuid');
const { notify, notifyAdmins } = require('../lib/notify');
const { canStudentCancel } = require('../lib/cancellation');
const { formatSessionTime } = require('../lib/datetime');
const { hasTeacherConflict } = require('../lib/queries');

// Notifications are best-effort side effects, not part of an operation's
// success criteria: a persisted (committed/updated) request must never be
// reported to the client as failed just because a downstream notify() call
// threw. Any error here is logged with request/recipient context and
// swallowed — never rethrown.
async function safeNotify(context, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[reschedule] notification failed (${context})`, err);
  }
}

// Notifies whichever party did NOT take the action (approve/reject): if a
// teacher acted, notify admins; if an admin/supervisor acted, notify the
// teacher. Shared by approve and reject — only the message strings differ.
async function notifyCounterparty(requestId, userRole, { teacherId, studentName }, { type, title, adminMessage, teacherMessage, link }) {
  if (userRole === 'teacher') {
    await safeNotify(`request ${requestId} admins`, () =>
      notifyAdmins(type, title, adminMessage(studentName), link));
  } else {
    await safeNotify(`request ${requestId} teacher ${teacherId}`, () =>
      notify(teacherId, type, title, teacherMessage(studentName), '/teacher/dashboard'));
  }
}

// Runs the sequential authorization/business-rule checks for creating a
// reschedule request. Returns the first failing { status, body }, or null
// if every check passes.
function validateRescheduleRequest(session, proposedDate, pending) {
  if (!session)
    return { status: 404, body: { error: 'Session not found' } };

  if (session.status !== 'scheduled')
    return { status: 400, body: { error: 'This session is no longer active' } };

  const bufferCheck = canStudentCancel(session);
  if (!bufferCheck.allowed)
    return { status: 403, body: { error: bufferCheck.reason, code: bufferCheck.code } };

  if (pending.rows.length > 0)
    return { status: 409, body: { error: 'A reschedule request is already pending for this session' } };

  return null;
}

// Creates a reschedule request. Returns { status, body } — callers should
// respond with exactly that status/body. Throws only on a genuinely
// unexpected DB error (the route's catch-all handles that, matching the
// original inline try/catch behavior).
async function createRescheduleRequest(pool, { studentId, sessionId, proposedAt }) {
  const proposedDate = new Date(proposedAt);
  if (isNaN(proposedDate.getTime()))
    return { status: 400, body: { error: 'proposed_at must be a valid date' } };
  if (proposedDate <= new Date())
    return { status: 400, body: { error: 'Proposed time must be in the future' } };

  try {
    const sessRes = await pool.query(
      `SELECT s.*, st.display_name AS student_name, t.display_name AS teacher_name
       FROM sessions s
       JOIN users st ON st.id = s.student_id
       JOIN users t  ON t.id  = s.teacher_id
       WHERE s.id = $1`, [sessionId]
    );
    const session = sessRes.rows[0];

    if (session && session.student_id !== studentId)
      return { status: 403, body: { error: 'Forbidden' } };

    const pending = await pool.query(
      `SELECT id FROM reschedule_requests WHERE session_id = $1 AND status = 'pending'`,
      [sessionId]
    );

    const validationError = validateRescheduleRequest(session, proposedDate, pending);
    if (validationError) return validationError;

    const hasConflict = await hasTeacherConflict(pool, {
      teacherId: session.teacher_id,
      scheduledAt: proposedDate.toISOString(),
      durationMinutes: session.duration_minutes,
      excludeSessionId: sessionId,
    });
    if (hasConflict)
      return {
        status: 409,
        body: {
          error: 'Teacher is not available at this time. Please pick a different time.',
          code: 'TEACHER_CONFLICT',
        },
      };

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO reschedule_requests (id, session_id, student_id, teacher_id, proposed_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, sessionId, session.student_id, session.teacher_id, proposedDate.toISOString()]
    );

    // Notify teacher + admins (best-effort — insert already succeeded).
    const origTime = formatSessionTime(session.scheduled_at);
    const newTime = formatSessionTime(proposedDate);
    await safeNotify(`request ${id} teacher ${session.teacher_id}`, () =>
      notify(session.teacher_id, 'reschedule_requested', 'Reschedule Requested',
        `${session.student_name} wants to reschedule from ${origTime} to ${newTime}`,
        '/teacher/dashboard'));
    await safeNotify(`request ${id} admins`, () =>
      notifyAdmins('reschedule_requested', 'Reschedule Requested',
        `${session.student_name} wants to reschedule from ${origTime} to ${newTime}`,
        '/supervisor'));

    return { status: 201, body: { request: result.rows[0] } };
  } catch (err) {
    // Handle partial unique index violation (race condition)
    if (err.code === '23505' && err.constraint?.includes('one_pending'))
      return { status: 409, body: { error: 'A reschedule request is already pending for this session' } };
    throw err;
  }
}

// Sends the post-commit notifications for a successful approval: the
// student is notified their session moved, and the counterparty (the side
// that did not take the approve action) is notified too. Called AFTER the
// transaction commits, using the safe-notify pattern — a notify failure
// here must never turn a persisted approval into a client-visible failure.
async function notifyRescheduleApproved(rescheduleRequest, userRole, newTime) {
  await safeNotify(`request ${rescheduleRequest.id} student ${rescheduleRequest.student_id}`, () =>
    notify(rescheduleRequest.student_id, 'reschedule_approved', 'Reschedule Approved',
      `Your session has been rescheduled to ${newTime}`,
      '/student/sessions'));

  await notifyCounterparty(
    rescheduleRequest.id,
    userRole,
    { teacherId: rescheduleRequest.teacher_id, studentName: rescheduleRequest.student_name },
    {
      type: 'reschedule_approved',
      title: 'Reschedule Approved',
      adminMessage: (studentName) => `${studentName}'s session was approved and rescheduled to ${newTime}`,
      teacherMessage: (studentName) => `${studentName}'s session was rescheduled to ${newTime}`,
    }
  );
}

// Approves a pending reschedule request: conflict re-check, close the old
// session, insert the new one, update the request — all inside one
// transaction (all-or-nothing). Notifications are sent AFTER commit and are
// best-effort (see notifyRescheduleApproved / F17): a notify failure never
// rolls back or fails an already-committed approval. Returns { status,
// body }; throws only on a genuinely unexpected DB error during the
// transaction itself, after rolling back and releasing the client (the
// route's catch-all then does the same 500 response + log as the original
// inline try/catch).
async function approveRescheduleRequest(pool, { requestId, userId, userRole }) {
  const client = await pool.connect();
  let rescheduleRequest;
  let newSession;
  let updatedRequest;
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT rr.*, s.student_id, s.teacher_id, s.duration_minutes, s.subject,
              s.zoom_link, s.rate_at_creation, s.currency_at_creation,
              s.scheduled_at AS original_scheduled_at,
              st.display_name AS student_name
       FROM reschedule_requests rr
       JOIN sessions s ON s.id = rr.session_id
       JOIN users st ON st.id = rr.student_id
       WHERE rr.id = $1`, [requestId]
    );
    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { error: 'Request not found' } };
    }
    rescheduleRequest = reqRes.rows[0];

    if (rescheduleRequest.status !== 'pending') {
      await client.query('ROLLBACK');
      return { status: 400, body: { error: 'Request is no longer pending' } };
    }

    // Teacher can only approve their own sessions
    if (userRole === 'teacher' && rescheduleRequest.teacher_id !== userId) {
      await client.query('ROLLBACK');
      return { status: 403, body: { error: 'Forbidden' } };
    }

    // Re-check teacher conflict
    const hasConflict = await hasTeacherConflict(client, {
      teacherId: rescheduleRequest.teacher_id,
      scheduledAt: rescheduleRequest.proposed_at,
      durationMinutes: rescheduleRequest.duration_minutes,
      excludeSessionId: rescheduleRequest.session_id,
    });
    if (hasConflict) {
      await client.query('ROLLBACK');
      return {
        status: 409,
        body: {
          error: 'Conflict detected — another session has been scheduled at this time. Please reject this request and ask the student to propose a different time.',
          code: 'TEACHER_CONFLICT',
        },
      };
    }

    // 1. Mark original session as rescheduled
    await client.query(
      `UPDATE sessions SET status = 'rescheduled', last_modified_by = $1, updated_at = now()
       WHERE id = $2`,
      [userId, rescheduleRequest.session_id]
    );

    // 2. Create new session with copied fields
    const newId = uuidv4();
    const newSessRes = await client.query(
      `INSERT INTO sessions
         (id, student_id, teacher_id, scheduled_at, duration_minutes, subject,
          zoom_link, rate_at_creation, currency_at_creation, rescheduled_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [newId, rescheduleRequest.student_id, rescheduleRequest.teacher_id, rescheduleRequest.proposed_at,
       rescheduleRequest.duration_minutes, rescheduleRequest.subject || 'quran',
       rescheduleRequest.zoom_link, rescheduleRequest.rate_at_creation, rescheduleRequest.currency_at_creation,
       rescheduleRequest.session_id]
    );
    newSession = newSessRes.rows[0];

    // 3. Update request
    const updatedReq = await client.query(
      `UPDATE reschedule_requests
       SET status = 'approved', decided_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [userId, requestId]
    );
    updatedRequest = updatedReq.rows[0];

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Post-commit: best-effort notifications. A failure here must NOT be
  // reported to the client as a failed approval (F17) — the approval is
  // already durably persisted at this point.
  const newTime = formatSessionTime(rescheduleRequest.proposed_at);
  await notifyRescheduleApproved(rescheduleRequest, userRole, newTime);

  return { status: 200, body: { request: updatedRequest, new_session: newSession } };
}

// Rejects a pending reschedule request. Returns { status, body }.
async function rejectRescheduleRequest(pool, { requestId, userId, userRole, rejectionReason }) {
  if (rejectionReason && rejectionReason.length > 500)
    return { status: 400, body: { error: 'Rejection reason must be 500 characters or less' } };

  const reqRes = await pool.query(
    `SELECT rr.*, s.scheduled_at AS original_scheduled_at,
            st.display_name AS student_name
     FROM reschedule_requests rr
     JOIN sessions s ON s.id = rr.session_id
     JOIN users st ON st.id = rr.student_id
     WHERE rr.id = $1`, [requestId]
  );
  if (reqRes.rows.length === 0)
    return { status: 404, body: { error: 'Request not found' } };
  const rescheduleRequest = reqRes.rows[0];

  if (rescheduleRequest.status !== 'pending')
    return { status: 400, body: { error: 'Request is no longer pending' } };

  if (userRole === 'teacher' && rescheduleRequest.teacher_id !== userId)
    return { status: 403, body: { error: 'Forbidden' } };

  const result = await pool.query(
    `UPDATE reschedule_requests
     SET status = 'rejected', decided_by = $1, rejection_reason = $2, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [userId, rejectionReason || null, requestId]
  );

  // Post-update: best-effort notifications (F17) — the rejection is already
  // durably persisted, so a notify failure must not be surfaced as an error.
  const origTime = formatSessionTime(rescheduleRequest.original_scheduled_at);
  const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
  await safeNotify(`request ${requestId} student ${rescheduleRequest.student_id}`, () =>
    notify(rescheduleRequest.student_id, 'reschedule_rejected', 'Reschedule Rejected',
      `Your reschedule request for ${origTime} was not approved.${reasonText}`,
      '/student/sessions'));

  await notifyCounterparty(
    requestId,
    userRole,
    { teacherId: rescheduleRequest.teacher_id, studentName: rescheduleRequest.student_name },
    {
      type: 'reschedule_rejected',
      title: 'Reschedule Rejected',
      adminMessage: (studentName) => `${studentName}'s reschedule request was rejected`,
      teacherMessage: (studentName) => `${studentName}'s reschedule request was rejected`,
    }
  );

  return { status: 200, body: { request: result.rows[0] } };
}

module.exports = {
  createRescheduleRequest,
  approveRescheduleRequest,
  rejectRescheduleRequest,
  validateRescheduleRequest,
  notifyRescheduleApproved,
  notifyCounterparty,
};
