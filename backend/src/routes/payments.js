const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /payments — teacher sees own history, admin sees all
router.get('/', requireAuth, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'teacher') {
      result = await pool.query(
        `SELECT * FROM teacher_payments WHERE teacher_id = $1 ORDER BY year DESC, created_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT tp.*, u.display_name as teacher_name
         FROM teacher_payments tp
         JOIN users u ON tp.teacher_id = u.id
         ORDER BY tp.year DESC, tp.created_at DESC`
      );
    }
    res.json({ payments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /payments/generate — admin auto-calculates monthly payment
router.post('/generate', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  const { teacher_id, month, year, rate_per_session } = req.body;
  if (!teacher_id || !month || !year) return res.status(400).json({ error: 'teacher_id, month, year required' });
  try {
    const sessionsRes = await pool.query(
      `SELECT COUNT(*) as count FROM sessions
       WHERE teacher_id = $1
         AND status = 'completed'
         AND EXTRACT(MONTH FROM scheduled_at) = $2
         AND EXTRACT(YEAR FROM scheduled_at) = $3`,
      [teacher_id, parseInt(month), parseInt(year)]
    );
    const sessions_completed = parseInt(sessionsRes.rows[0].count);
    const rate = parseFloat(rate_per_session) || 5.00;
    const total_amount = sessions_completed * rate;

    const result = await pool.query(
      `INSERT INTO teacher_payments (teacher_id, month, year, sessions_completed, rate_per_session, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [teacher_id, month, parseInt(year), sessions_completed, rate, total_amount]
    );
    res.status(201).json({ payment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate payment' });
  }
});

// PATCH /payments/:id/mark-paid — admin
router.patch('/:id/mark-paid', requireAuth, requireRole('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE teacher_payments SET status = 'paid' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
});

module.exports = router;
