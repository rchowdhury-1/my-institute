const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /students/me — profile + active package + upcoming sessions
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [userResult, packageResult, sessionsResult] = await Promise.all([
      pool.query(
        'SELECT id, display_name, email, phone, created_at FROM users WHERE id = $1',
        [req.userId]
      ),
      pool.query(
        'SELECT * FROM packages WHERE user_id = $1 ORDER BY purchased_at DESC LIMIT 1',
        [req.userId]
      ),
      pool.query(
        `SELECT s.*, u.display_name AS teacher_name
         FROM sessions s
         JOIN users u ON u.id = s.teacher_id
         WHERE s.student_id = $1 AND s.status = 'scheduled' AND s.scheduled_at >= NOW()
         ORDER BY s.scheduled_at ASC
         LIMIT 5`,
        [req.userId]
      ),
    ]);

    res.json({
      user: userResult.rows[0],
      package: packageResult.rows[0] || null,
      upcoming_lessons: sessionsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /students/lessons — full session history (name kept for backwards compat)
router.get('/lessons', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.display_name AS teacher_name
       FROM sessions s
       JOIN users u ON u.id = s.teacher_id
       WHERE s.student_id = $1
       ORDER BY s.scheduled_at DESC`,
      [req.userId]
    );
    res.json({ lessons: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /students/payments — student views own payment history
router.get('/payments', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, amount, currency, payment_method, notes, created_at
       FROM student_payments
       WHERE student_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
