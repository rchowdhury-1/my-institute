const { v4: uuidv4 } = require('uuid');
const { notify, notifyAdmins } = require('../lib/notify');
const { canStudentCancel } = require('../lib/cancellation');
const { formatSessionTime } = require('../lib/datetime');
const { hasTeacherConflict } = require('../lib/queries');

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
    // 1. Session exists and belongs to this student
    const sessRes = await pool.query(
      `SELECT s.*, st.display_name AS student_name, t.display_name AS teacher_name
       FROM sessions s
       JOIN users st ON st.id = s.student_id
       JOIN users t  ON t.id  = s.teacher_id
       WHERE s.id = $1`, [sessionId]
    );
    if (sessRes.rows.length === 0)
      return { status: 404, body: { error: 'Session not found' } };
    const session = sessRes.rows[0];

    if (session.student_id !== studentId)
      return { status: 403, body: { error: 'Forbidden' } };

    // 2. Session must be scheduled
    if (session.status !== 'scheduled')
      return { status: 400, body: { error: 'This session is no longer active' } };

    // 3. 12-hour buffer / past session check
    const bufferCheck = canStudentCancel(session);
    if (!bufferCheck.allowed)
      return { status: 403, body: { error: bufferCheck.reason, code: bufferCheck.code } };

    // 4. No existing pending request
    const pending = await pool.query(
      `SELECT id FROM reschedule_requests WHERE session_id = $1 AND status = 'pending'`,
      [sessionId]
    );
    if (pending.rows.length > 0)
      return { status: 409, body: { error: 'A reschedule request is already pending for this session' } };

    // 5. Teacher availability — overlap check
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

    // 6. Insert request
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO reschedule_requests (id, session_id, student_id, teacher_id, proposed_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, sessionId, session.student_id, session.teacher_id, proposedDate.toISOString()]
    );

    // 7. Notify teacher + admins
    const origTime = formatSessionTime(session.scheduled_at);
    const newTime = formatSessionTime(proposedDate);
    await notify(session.teacher_id, 'reschedule_requested', 'Reschedule Requested',
      `${session.student_name} wants to reschedule from ${origTime} to ${newTime}`,
      '/teacher/dashboard');
    await notifyAdmins('reschedule_requested', 'Reschedule Requested',
      `${session.student_name} wants to reschedule from ${origTime} to ${newTime}`,
      '/supervisor');

    return { status: 201, body: { request: result.rows[0] } };
  } catch (err) {
    // Handle partial unique index violation (race condition)
    if (err.code === '23505' && err.constraint?.includes('one_pending'))
      return { status: 409, body: { error: 'A reschedule request is already pending for this session' } };
    throw err;
  }
}

// Approves a pending reschedule request: conflict re-check, close the old
// session, insert the new one, update the request, notify — all inside one
// transaction (all-or-nothing). Returns { status, body }; throws only on a
// genuinely unexpected DB error, after rolling back and releasing the
// client (the route's catch-all then does the same 500 response + log as
// the original inline try/catch).
async function approveRescheduleRequest(pool, { requestId, userId, userRole }) {
  const client = await pool.connect();
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
    const rescheduleRequest = reqRes.rows[0];

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

    // 3. Update request
    const updatedReq = await client.query(
      `UPDATE reschedule_requests
       SET status = 'approved', decided_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [userId, requestId]
    );

    await client.query('COMMIT');

    // Notify student
    const newTime = formatSessionTime(rescheduleRequest.proposed_at);
    await notify(rescheduleRequest.student_id, 'reschedule_approved', 'Reschedule Approved',
      `Your session has been rescheduled to ${newTime}`,
      '/student/sessions');

    // Notify the other party (if teacher approved, notify admins; if admin approved, notify teacher)
    if (userRole === 'teacher') {
      await notifyAdmins('reschedule_approved', 'Reschedule Approved',
        `${rescheduleRequest.student_name}'s session was approved and rescheduled to ${newTime}`, '/supervisor');
    } else {
      await notify(rescheduleRequest.teacher_id, 'reschedule_approved', 'Reschedule Approved',
        `${rescheduleRequest.student_name}'s session was rescheduled to ${newTime}`, '/teacher/dashboard');
    }

    return { status: 200, body: { request: updatedReq.rows[0], new_session: newSessRes.rows[0] } };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

  // Notify student
  const origTime = formatSessionTime(rescheduleRequest.original_scheduled_at);
  const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : '';
  await notify(rescheduleRequest.student_id, 'reschedule_rejected', 'Reschedule Rejected',
    `Your reschedule request for ${origTime} was not approved.${reasonText}`,
    '/student/sessions');

  // Notify the other party
  if (userRole === 'teacher') {
    await notifyAdmins('reschedule_rejected', 'Reschedule Rejected',
      `${rescheduleRequest.student_name}'s reschedule request was rejected`, '/supervisor');
  } else {
    await notify(rescheduleRequest.teacher_id, 'reschedule_rejected', 'Reschedule Rejected',
      `${rescheduleRequest.student_name}'s reschedule request was rejected`, '/teacher/dashboard');
  }

  return { status: 200, body: { request: result.rows[0] } };
}

module.exports = { createRescheduleRequest, approveRescheduleRequest, rejectRescheduleRequest };
