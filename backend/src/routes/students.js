const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /students/me — profile + active package + upcoming lessons
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [userResult, packageResult, lessonsResult] = await Promise.all([
      pool.query(
        'SELECT id, display_name, email, phone, created_at FROM users WHERE id = $1',
        [req.userId]
      ),
      pool.query(
        'SELECT * FROM packages WHERE user_id = $1 ORDER BY purchased_at DESC LIMIT 1',
        [req.userId]
      ),
      pool.query(
        `SELECT l.*, u.display_name AS teacher_name
         FROM lessons l
         JOIN users u ON u.id = l.teacher_id
         WHERE l.student_id = $1 AND l.status = 'scheduled' AND l.scheduled_at >= NOW()
         ORDER BY l.scheduled_at ASC
         LIMIT 5`,
        [req.userId]
      ),
    ]);

    res.json({
      user: userResult.rows[0],
      package: packageResult.rows[0] || null,
      upcoming_lessons: lessonsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /students/lessons — full lesson history
router.get('/lessons', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.display_name AS teacher_name
       FROM lessons l
       JOIN users u ON u.id = l.teacher_id
       WHERE l.student_id = $1
       ORDER BY l.scheduled_at DESC`,
      [req.userId]
    );
    res.json({ lessons: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
