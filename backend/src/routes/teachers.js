const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /teachers/me — teacher profile
router.get('/me', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, display_name, email, phone, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /teachers/students — students this teacher has sessions with
router.get('/students', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.display_name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.student_id
       WHERE s.teacher_id = $1
       ORDER BY u.display_name ASC`,
      [req.userId]
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /teachers/lessons — upcoming + recent schedule (queries sessions table)
router.get('/lessons', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.display_name AS student_name
       FROM sessions s
       JOIN users u ON u.id = s.student_id
       WHERE s.teacher_id = $1
       ORDER BY s.scheduled_at DESC`,
      [req.userId]
    );
    res.json({ lessons: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /teachers/lessons/:id — update status, notes, or zoom link
router.patch('/lessons/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { status, notes, zoom_link } = req.body;
  const validStatuses = ['scheduled', 'completed', 'cancelled'];

  if (status && !validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const existing = await pool.query(
      'SELECT id FROM sessions WHERE id = $1 AND teacher_id = $2',
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    const result = await pool.query(
      `UPDATE sessions
       SET status    = COALESCE($1, status),
           notes     = COALESCE($2, notes),
           zoom_link = COALESCE($3, zoom_link),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status || null, notes ?? null, zoom_link ?? null, req.params.id]
    );
    res.json({ lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
