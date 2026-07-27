const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { isValidEmail } = require('../../lib/validators');
const { assertTeacherExists } = require('../../lib/queries');
const { createUser, resetPassword } = require('../../lib/users');
const { SUPPORTED_CURRENCIES } = require('../../config');

const router = express.Router();

// ─── Students ────────────────────────────────────────────────────────────────

// GET /admin/students
router.get('/students', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.display_name, u.email, u.phone, u.created_at,
            u.is_active, u.must_change_password,
            u.guardian_name, u.teacher_id,
            u.hourly_rate, u.currency, u.is_legacy_pricing, u.pricing_notes,
            p.id AS package_id, p.package_name, p.total_lessons, p.used_lessons,
            p.sessions_remaining, p.expires_at
     FROM users u
     LEFT JOIN LATERAL (
       SELECT * FROM packages WHERE user_id = u.id ORDER BY purchased_at DESC LIMIT 1
     ) p ON true
     WHERE u.role = 'student'
     ORDER BY u.created_at DESC`
  );
  res.json({ students: result.rows });
}));

// POST /admin/students — create a student account
router.post('/students', asyncHandler(async (req, res) => {
  const result = await createUser('student', req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(result.status).json({ student: result.user, tempPassword: result.tempPassword, ...result.emailResult });
}));

// PATCH /admin/students/:id — edit a student
router.patch('/students/:id', asyncHandler(async (req, res) => {
  const {
    display_name, email, phone, guardian_name, teacher_id, is_active,
    hourly_rate, is_legacy_pricing, pricing_notes, currency,
  } = req.body;

  const existing = await pool.query('SELECT * FROM users WHERE id=$1 AND role=$2', [req.params.id, 'student']);
  if (existing.rows.length === 0)
    return res.status(404).json({ error: 'Student not found' });

  if (email) {
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Please enter a valid email address' });
    const dup = await pool.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [email.trim().toLowerCase(), req.params.id]);
    if (dup.rows.length > 0)
      return res.status(409).json({ error: 'Someone with this email address already exists' });
  }

  if (teacher_id) {
    const teacher = await assertTeacherExists(pool, teacher_id);
    if (!teacher)
      return res.status(400).json({ error: 'Assigned teacher not found' });
  }

  if (hourly_rate != null && (isNaN(parseFloat(hourly_rate)) || parseFloat(hourly_rate) <= 0))
    return res.status(400).json({ error: 'Hourly rate must be a positive number' });
  if (currency && !SUPPORTED_CURRENCIES.includes(currency))
    return res.status(400).json({ error: 'Currency must be GBP or EGP' });

  const result = await pool.query(
    `UPDATE users
     SET display_name       = COALESCE($1, display_name),
         email              = COALESCE($2, email),
         phone              = COALESCE($3, phone),
         guardian_name      = COALESCE($4, guardian_name),
         teacher_id         = COALESCE($5, teacher_id),
         is_active          = COALESCE($6, is_active),
         hourly_rate        = COALESCE($7, hourly_rate),
         is_legacy_pricing  = COALESCE($8, is_legacy_pricing),
         pricing_notes      = COALESCE($9, pricing_notes),
         currency           = COALESCE($10, currency)
     WHERE id = $11
     RETURNING id, display_name, email, phone, guardian_name, teacher_id,
               is_active, must_change_password, hourly_rate, currency,
               is_legacy_pricing, pricing_notes`,
    [
      display_name?.trim() || null,
      email ? email.trim().toLowerCase() : null,
      phone !== undefined ? (phone || null) : null,
      guardian_name !== undefined ? (guardian_name || null) : null,
      teacher_id !== undefined ? (teacher_id || null) : null,
      is_active != null ? is_active : null,
      hourly_rate != null ? parseFloat(hourly_rate) : null,
      is_legacy_pricing != null ? is_legacy_pricing : null,
      pricing_notes !== undefined ? (pricing_notes || null) : null,
      currency || null,
      req.params.id,
    ]
  );
  res.json({ student: result.rows[0] });
}));

// POST /admin/students/:id/reset-password
router.post('/students/:id/reset-password', asyncHandler(async (req, res) => {
  const result = await resetPassword('student', req.params.id, req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ tempPassword: result.tempPassword, ...result.emailResult });
}));

module.exports = router;
