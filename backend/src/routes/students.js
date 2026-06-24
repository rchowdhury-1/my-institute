const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /students/me — profile + active package + upcoming sessions
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const [userResult, packageResult, sessionsResult, schedulesResult] = await Promise.all([
      pool.query(
        'SELECT id, display_name, email, phone, created_at FROM users WHERE id = $1',
        [req.userId]
      ),
      pool.query(
        'SELECT * FROM packages WHERE user_id = $1 ORDER BY purchased_at DESC LIMIT 1',
        [req.userId]
      ),
      pool.query(
        `SELECT s.*, u.display_name AS teacher_name,
                ws.lessons_remaining AS schedule_lessons_remaining
         FROM sessions s
         JOIN users u ON u.id = s.teacher_id
         LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
         WHERE s.student_id = $1 AND s.status = 'scheduled'
           AND s.scheduled_at + (s.duration_minutes * interval '1 minute') > NOW() - interval '24 hours'
         ORDER BY s.scheduled_at ASC
         LIMIT 5`,
        [req.userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS active_schedule_count,
                COALESCE(SUM(lessons_remaining), 0)::int AS total_lessons_remaining,
                bool_or(lessons_remaining IS NOT NULL) AS has_lessons_set
         FROM weekly_schedules
         WHERE student_id = $1 AND is_active = true`,
        [req.userId]
      ),
    ]);

    const pkg = packageResult.rows[0] || null;
    const sched = schedulesResult.rows[0];

    let schedules_summary;
    if (sched.active_schedule_count > 0 && sched.has_lessons_set) {
      schedules_summary = {
        active_schedule_count: sched.active_schedule_count,
        active_lessons_remaining: sched.total_lessons_remaining,
        source: 'schedules',
      };
    } else if (pkg && pkg.sessions_remaining !== null && pkg.sessions_remaining > 0) {
      schedules_summary = {
        active_schedule_count: 0,
        active_lessons_remaining: pkg.sessions_remaining,
        source: 'package',
      };
    } else {
      schedules_summary = {
        active_schedule_count: 0,
        active_lessons_remaining: 0,
        source: 'none',
      };
    }

    res.json({
      user: userResult.rows[0],
      package: pkg,
      schedules_summary,
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
      `SELECT s.*, u.display_name AS teacher_name,
              ws.lessons_remaining AS schedule_lessons_remaining
       FROM sessions s
       JOIN users u ON u.id = s.teacher_id
       LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
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
