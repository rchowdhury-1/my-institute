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

// GET /teachers/lessons — upcoming + recent schedule
router.get('/lessons', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.display_name AS student_name
       FROM lessons l
       JOIN users u ON u.id = l.student_id
       WHERE l.teacher_id = $1
       ORDER BY l.scheduled_at DESC`,
      [req.userId]
    );
    res.json({ lessons: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /teachers/lessons/:id — update status or notes
router.patch('/lessons/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { status, notes } = req.body;
  const validStatuses = ['scheduled', 'completed', 'cancelled'];

  if (status && !validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const existing = await pool.query(
      'SELECT id FROM lessons WHERE id = $1 AND teacher_id = $2',
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Lesson not found' });

    const result = await pool.query(
      `UPDATE lessons
       SET status = COALESCE($1, status), notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING *`,
      [status || null, notes ?? null, req.params.id]
    );
    res.json({ lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
