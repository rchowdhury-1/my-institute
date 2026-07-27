const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { createRescheduleRequest, approveRescheduleRequest, rejectRescheduleRequest } = require('../services/reschedule');

const router = express.Router();
router.use(requireAuth);

// ─── POST /reschedule-requests ─────────────────────────────────────────────
router.post('/', requireRole('student'), asyncHandler(async (req, res) => {
  const { session_id, proposed_at } = req.body;
  if (!session_id || !proposed_at)
    return res.status(400).json({ error: 'session_id and proposed_at are required' });

  const result = await createRescheduleRequest(pool, {
    studentId: req.userId,
    sessionId: session_id,
    proposedAt: proposed_at,
  });
  res.status(result.status).json(result.body);
}));

// ─── DELETE /reschedule-requests/:id ───────────────────────────────────────
router.delete('/:id', requireRole('student'), asyncHandler(async (req, res) => {
  const reqRes = await pool.query('SELECT * FROM reschedule_requests WHERE id = $1', [req.params.id]);
  if (reqRes.rows.length === 0)
    return res.status(404).json({ error: 'Request not found' });
  const rescheduleRequest = reqRes.rows[0];

  if (rescheduleRequest.student_id !== req.userId)
    return res.status(403).json({ error: 'Forbidden' });
  if (rescheduleRequest.status !== 'pending')
    return res.status(400).json({ error: 'Only pending requests can be cancelled' });

  const result = await pool.query(
    `UPDATE reschedule_requests SET status = 'cancelled_by_student', updated_at = now()
     WHERE id = $1 RETURNING *`, [req.params.id]
  );
  res.json({ request: result.rows[0] });
}));

// ─── GET /reschedule-requests ──────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const statusFilter = req.query.status;
  let query = `
    SELECT rr.*,
           s.scheduled_at AS original_scheduled_at,
           s.duration_minutes,
           s.subject,
           st.display_name AS student_name,
           st.email AS student_email,
           st.phone AS student_phone,
           t.display_name AS teacher_name,
           t.phone AS teacher_phone
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
}));

// ─── PATCH /reschedule-requests/:id/approve ────────────────────────────────
router.patch('/:id/approve', requireRole('teacher', 'admin', 'supervisor'), asyncHandler(async (req, res) => {
  const result = await approveRescheduleRequest(pool, {
    requestId: req.params.id,
    userId: req.userId,
    userRole: req.userRole,
  });
  res.status(result.status).json(result.body);
}));

// ─── PATCH /reschedule-requests/:id/reject ─────────────────────────────────
router.patch('/:id/reject', requireRole('teacher', 'admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { rejection_reason } = req.body;
  const result = await rejectRescheduleRequest(pool, {
    requestId: req.params.id,
    userId: req.userId,
    userRole: req.userRole,
    rejectionReason: rejection_reason,
  });
  res.status(result.status).json(result.body);
}));

module.exports = router;
