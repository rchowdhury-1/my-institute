const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { buildUpdateClause } = require('../lib/queries');

const router = express.Router();

// GET /teachers/me — teacher profile
router.get('/me', requireAuth, requireRole('teacher'), asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, display_name, email, phone, created_at FROM users WHERE id = $1',
    [req.userId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
}));

// GET /teachers/students — students this teacher has sessions with
router.get('/students', requireAuth, requireRole('teacher'), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT u.id, u.display_name, u.email
     FROM sessions s
     JOIN users u ON u.id = s.student_id
     WHERE s.teacher_id = $1
     ORDER BY u.display_name ASC`,
    [req.userId]
  );
  res.json({ students: result.rows });
}));

// GET /teachers/lessons — upcoming + recent schedule (queries sessions table)
// Vocabulary debt: same "lessons" vs "sessions" naming mismatch as
// /admin/lessons — path and response key kept for frontend compatibility
// (smell roadmap L1, deferred).
router.get('/lessons', requireAuth, requireRole('teacher'), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT s.*, u.display_name AS student_name,
            ws.lessons_remaining AS schedule_lessons_remaining
     FROM sessions s
     JOIN users u ON u.id = s.student_id
     LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
     WHERE s.teacher_id = $1
     ORDER BY s.scheduled_at DESC`,
    [req.userId]
  );
  res.json({ lessons: result.rows, server_time: new Date().toISOString() });
}));

// PATCH /teachers/lessons/:id — update notes or zoom link.
// Status changes are NOT allowed here — they must go through
// PATCH /sessions/:id/attendance (services/attendance.js), which is the
// only path that window-checks, decrements the student's balance, and
// sends attendance notifications. This route used to also accept `status`
// directly, letting a teacher flip a session to completed/cancelled without
// any of that side-effect handling — removed as a correctness fix.
router.patch('/lessons/:id', requireAuth, requireRole('teacher', 'admin'), asyncHandler(async (req, res) => {
  const { notes, zoom_link } = req.body;

  const existing = await pool.query(
    'SELECT id FROM sessions WHERE id = $1 AND teacher_id = $2',
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

  const dynamic = buildUpdateClause({ notes, zoom_link }, 1);
  const result = await pool.query(
    `UPDATE sessions
     SET ${['updated_at = NOW()', ...dynamic.setClauses].join(', ')}
     WHERE id = $${dynamic.nextParamIdx}
     RETURNING *`,
    [...dynamic.params, req.params.id]
  );
  res.json({ lesson: result.rows[0] });
}));

module.exports = router;
