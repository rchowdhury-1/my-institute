const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { buildUpdateClause } = require('../../lib/queries');

const router = express.Router();

// ─── Student Payments ────────────────────────────────────────────────────────

// GET /admin/payments/student — view all student payments
router.get('/payments/student', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT sp.*, u.display_name AS student_name, a.display_name AS logged_by_name
     FROM student_payments sp
     JOIN users u ON u.id = sp.student_id
     LEFT JOIN users a ON a.id = sp.logged_by
     ORDER BY sp.created_at DESC`
  );
  res.json({ payments: result.rows });
}));

// POST /admin/payments/student — log a student payment manually
router.post('/payments/student', asyncHandler(async (req, res) => {
  const { student_id, amount, currency, payment_method, notes } = req.body;
  if (!student_id || !amount)
    return res.status(400).json({ error: 'student_id and amount are required' });

  const result = await pool.query(
    `INSERT INTO student_payments (student_id, amount, currency, payment_method, notes, logged_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      student_id,
      parseFloat(amount),
      currency || 'GBP',
      payment_method || null,
      notes || null,
      req.userId,
    ]
  );
  res.status(201).json({ payment: result.rows[0] });
}));

// ─── Teacher Hours ──────────────────────────────────────────────────────────

// GET /admin/teacher-hours — monthly teaching hours + salary per teacher
router.get('/teacher-hours', asyncHandler(async (req, res) => {
  const now = new Date();
  const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Validate YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(month))
    return res.status(400).json({ error: 'month must be in YYYY-MM format' });

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNum, 1));

  const result = await pool.query(
    `SELECT
       u.id AS teacher_id,
       u.display_name,
       u.pay_rate_per_hour,
       u.pay_currency,
       COALESCE(SUM(s.duration_minutes) FILTER (WHERE s.teacher_attended = true), 0)::int AS total_minutes,
       COUNT(s.id) FILTER (WHERE s.teacher_attended = true)::int AS completed_sessions,
       COUNT(s.id) FILTER (WHERE s.status = 'cancelled')::int AS cancelled_sessions,
       COUNT(s.id) FILTER (WHERE s.status = 'rescheduled')::int AS rescheduled_sessions,
       COUNT(s.id) FILTER (WHERE s.status = 'no_show')::int AS no_show_sessions,
       COUNT(s.id) FILTER (WHERE s.status = 'cancelled_teacher')::int AS teacher_cancelled_sessions
     FROM users u
     LEFT JOIN sessions s
       ON s.teacher_id = u.id
       AND s.scheduled_at >= $1
       AND s.scheduled_at < $2
     WHERE u.role = 'teacher' AND u.is_active = true
     ${req.query.teacher_id ? 'AND u.id = $3' : ''}
     GROUP BY u.id, u.display_name, u.pay_rate_per_hour, u.pay_currency
     ORDER BY total_minutes DESC, u.display_name ASC`,
    req.query.teacher_id
      ? [startDate.toISOString(), endDate.toISOString(), req.query.teacher_id]
      : [startDate.toISOString(), endDate.toISOString()]
  );

  const teachers = result.rows.map(r => ({
    ...r,
    total_hours: Math.round((r.total_minutes / 60) * 10) / 10,
    salary: r.pay_rate_per_hour
      ? Math.round((r.total_minutes / 60) * parseFloat(r.pay_rate_per_hour) * 100) / 100
      : null,
  }));

  res.json({ month, teachers });
}));

// PATCH /admin/teachers/:id/pay-rate
router.patch('/teachers/:id/pay-rate', asyncHandler(async (req, res) => {
  const { pay_rate_per_hour, pay_currency } = req.body;
  const { id } = req.params;

  if (pay_rate_per_hour == null || isNaN(parseFloat(pay_rate_per_hour)) || parseFloat(pay_rate_per_hour) < 0)
    return res.status(400).json({ error: 'pay_rate_per_hour must be a non-negative number' });

  const teacherCheck = await pool.query(
    "SELECT id, display_name FROM users WHERE id = $1 AND role = 'teacher'", [id]
  );
  if (teacherCheck.rows.length === 0)
    return res.status(404).json({ error: 'Teacher not found' });

  const { setClauses, params, nextParamIdx } = buildUpdateClause(
    {
      pay_rate_per_hour: parseFloat(pay_rate_per_hour),
      pay_currency: pay_currency || undefined,
    },
    1
  );

  params.push(id);
  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${nextParamIdx} RETURNING id, display_name, pay_rate_per_hour, pay_currency`,
    params
  );

  res.json({ teacher: result.rows[0] });
}));

module.exports = router;
