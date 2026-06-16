const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../lib/notify');
const { canStudentCancel } = require('../lib/cancellation');
const { formatSessionTime } = require('../lib/datetime');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(requireAuth);

// ─── POST /reschedule-requests ─────────────────────────────────────────────
router.post('/', requireRole('student'), async (req, res) => {
  const { session_id, proposed_at } = req.body;
  if (!session_id || !proposed_at)
    return res.status(400).json({ error: 'session_id and proposed_at are required' });

  const proposedDate = new Date(proposed_at);
  if (isNaN(proposedDate.getTime()))
    return res.status(400).json({ error: 'proposed_at must be a valid date' });
  if (proposedDate <= new Date())
    return res.status(400).json({ error: 'Proposed time must be in the future' });

  try {
    // 1. Session exists and belongs to this student
    const sessRes = await pool.query(
      `SELECT s.*, st.display_name AS student_name, t.display_name AS teacher_name
       FROM sessions s
       JOIN users st ON st.id = s.student_id
       JOIN users t  ON t.id  = s.teacher_id
       WHERE s.id = $1`, [session_id]
    );
    if (sessRes.rows.length === 0)
      return res.status(404).json({ error: 'Session not found' });
    const session = sessRes.rows[0];

    if (session.student_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    // 2. Session must be scheduled
    if (session.status !== 'scheduled')
      return res.status(400).json({ error: 'This session is no longer active' });

    // 3. 12-hour buffer
    const bufferCheck = canStudentCancel(session);
    if (!bufferCheck.allowed)
      return res.status(403).json({ error: bufferCheck.reason, code: 'CANCELLATION_BUFFER' });

    // 4. No existing pending request
    const pending = await pool.query(
      `SELECT id FROM reschedule_requests WHERE session_id = $1 AND status = 'pending'`,
      [session_id]
    );
    if (pending.rows.length > 0)
      return res.status(409).json({ error: 'A reschedule request is already pending for this session' });

    // 5. Teacher availability — overlap check
    const conflict = await pool.query(
      `SELECT id FROM sessions
       WHERE teacher_id = $1
         AND status = 'scheduled'
         AND id <> $2
         AND tstzrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute')
          && tstzrange($3::timestamptz, $3::timestamptz + $4 * interval '1 minute')`,
      [session.teacher_id, session_id, proposedDate.toISOString(), session.duration_minutes]
    );
    if (conflict.rows.length > 0)
      return res.status(409).json({
        error: 'Teacher is not available at this time. Please pick a different time.',
        code: 'TEACHER_CONFLICT',
      });

    // 6. Insert request
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO reschedule_requests (id, session_id, student_id, teacher_id, proposed_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, session_id, session.student_id, session.teacher_id, proposedDate.toISOString()]
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

    res.status(201).json({ request: result.rows[0] });
  } catch (err) {
    // Handle partial unique index violation (race condition)
    if (err.code === '23505' && err.constraint?.includes('one_pending'))
      return res.status(409).json({ error: 'A reschedule request is already pending for this session' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /reschedule-requests/:id ───────────────────────────────────────
router.delete('/:id', requireRole('student'), async (req, res) => {
  try {
    const reqRes = await pool.query('SELECT * FROM reschedule_requests WHERE id = $1', [req.params.id]);
    if (reqRes.rows.length === 0)
      return res.status(404).json({ error: 'Request not found' });
    const rr = reqRes.rows[0];

    if (rr.student_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });
    if (rr.status !== 'pending')
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });

    const result = await pool.query(
      `UPDATE reschedule_requests SET status = 'cancelled_by_student', updated_at = now()
       WHERE id = $1 RETURNING *`, [req.params.id]
    );
    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /reschedule-requests ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  const statusFilter = req.query.status;
  try {
    let query = `
      SELECT rr.*,
             s.scheduled_at AS original_scheduled_at,
             s.duration_minutes,
             s.subject,
             st.display_name AS student_name,
             st.email AS student_email,
             st.phone AS student_phone,
             t.display_name AS teacher_name
      FROM reschedule_requests rr
      JOIN sessions s ON s.id = rr.session_id
      JOIN users st ON st.id = rr.student_id
      JOIN users t  ON t.id  = rr.teacher_id
    `;
    const params = [];
    const conditions = [];

    // Role-based scope
    if (req.userRole === 'student') {
      conditions.push(`rr.student_id = $${params.length + 1}`);
      params.push(req.userId);
    } else if (req.userRole === 'teacher') {
      conditions.push(`rr.teacher_id = $${params.length + 1}`);
      params.push(req.userId);
    }
    // admin/supervisor see all

    if (statusFilter) {
      conditions.push(`rr.status = $${params.length + 1}`);
      params.push(statusFilter);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY rr.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /reschedule-requests/:id/approve ────────────────────────────────
router.patch('/:id/approve', requireRole('teacher', 'admin', 'supervisor'), async (req, res) => {
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
       WHERE rr.id = $1`, [req.params.id]
    );
    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    const rr = reqRes.rows[0];

    if (rr.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Request is no longer pending' });
    }

    // Teacher can only approve their own sessions
    if (req.userRole === 'teacher' && rr.teacher_id !== req.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Re-check teacher conflict
    const conflict = await client.query(
      `SELECT id FROM sessions
       WHERE teacher_id = $1
         AND status = 'scheduled'
         AND id <> $2
         AND tstzrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute')
          && tstzrange($3::timestamptz, $3::timestamptz + $4 * interval '1 minute')`,
      [rr.teacher_id, rr.session_id, rr.proposed_at, rr.duration_minutes]
    );
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Conflict detected — another session has been scheduled at this time. Please reject this request and ask the student to propose a different time.',
        code: 'TEACHER_CONFLICT',
      });
    }

    // 1. Mark original session as rescheduled
    await client.query(
      `UPDATE sessions SET status = 'rescheduled', last_modified_by = $1, updated_at = now()
       WHERE id = $2`,
      [req.userId, rr.session_id]
    );

    // 2. Create new session with copied fields
    const newId = uuidv4();
    const newSessRes = await client.query(
      `INSERT INTO sessions
         (id, student_id, teacher_id, scheduled_at, duration_minutes, subject,
          zoom_link, rate_at_creation, currency_at_creation, rescheduled_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [newId, rr.student_id, rr.teacher_id, rr.proposed_at,
       rr.duration_minutes, rr.subject || 'quran',
       rr.zoom_link, rr.rate_at_creation, rr.currency_at_creation,
       rr.session_id]
    );

    // 3. Update request
    const updatedReq = await client.query(
      `UPDATE reschedule_requests
       SET status = 'approved', decided_by = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [req.userId, req.params.id]
    );

    await client.query('COMMIT');

    // Notify student
    const newTime = formatSessionTime(rr.proposed_at);
    await notify(rr.student_id, 'reschedule_approved', 'Reschedule Approved',
      `Your session has been rescheduled to ${newTime}`,
      '/student/sessions');

    // Notify the other party (if teacher approved, notify admins; if admin approved, notify teacher)
    if (req.userRole === 'teacher') {
      await notifyAdmins('reschedule_approved', 'Reschedule Approved',
        `${rr.student_name}'s session was approved and rescheduled to ${newTime}`, '/supervisor');
    } else {
      await notify(rr.teacher_id, 'reschedule_approved', 'Reschedule Approved',
        `${rr.student_name}'s session was rescheduled to ${newTime}`, '/teacher/dashboard');
    }

    res.json({ request: updatedReq.rows[0], new_session: newSessRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ─── PATCH /reschedule-requests/:id/reject ─────────────────────────────────
router.patch('/:id/reject', requireRole('teacher', 'admin', 'supervisor'), async (req, res) => {
  const { rejection_reason } = req.body;
  if (rejection_reason && rejection_reason.length > 500)
    return res.status(400).json({ error: 'Rejection reason must be 500 characters or less' });

  try {
    const reqRes = await pool.query(
      `SELECT rr.*, s.scheduled_at AS original_scheduled_at,
              st.display_name AS student_name
       FROM reschedule_requests rr
       JOIN sessions s ON s.id = rr.session_id
       JOIN users st ON st.id = rr.student_id
       WHERE rr.id = $1`, [req.params.id]
    );
    if (reqRes.rows.length === 0)
      return res.status(404).json({ error: 'Request not found' });
    const rr = reqRes.rows[0];

    if (rr.status !== 'pending')
      return res.status(400).json({ error: 'Request is no longer pending' });

    if (req.userRole === 'teacher' && rr.teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `UPDATE reschedule_requests
       SET status = 'rejected', decided_by = $1, rejection_reason = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [req.userId, rejection_reason || null, req.params.id]
    );

    // Notify student
    const origTime = formatSessionTime(rr.original_scheduled_at);
    const reasonText = rejection_reason ? ` Reason: ${rejection_reason}` : '';
    await notify(rr.student_id, 'reschedule_rejected', 'Reschedule Rejected',
      `Your reschedule request for ${origTime} was not approved.${reasonText}`,
      '/student/sessions');

    // Notify the other party
    if (req.userRole === 'teacher') {
      await notifyAdmins('reschedule_rejected', 'Reschedule Rejected',
        `${rr.student_name}'s reschedule request was rejected`, '/supervisor');
    } else {
      await notify(rr.teacher_id, 'reschedule_rejected', 'Reschedule Rejected',
        `${rr.student_name}'s reschedule request was rejected`, '/teacher/dashboard');
    }

    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
