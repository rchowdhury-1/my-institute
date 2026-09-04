const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { isValidEmail } = require('../../lib/validators');
const { assertTeacherExists, buildUpdateClause } = require('../../lib/queries');
const { createUser, resetPassword, deletePerson } = require('../../lib/users');
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

// Checks email format/uniqueness, teacher existence, hourly-rate bounds, and
// currency whitelist for a student edit. Returns { status, error } on
// failure, null when the edit may proceed.
async function validateStudentEdit(body, existingStudent) {
  const { email, teacher_id, hourly_rate, currency } = body;

  if (email) {
    if (!isValidEmail(email))
      return { status: 400, error: 'Please enter a valid email address' };
    const dup = await pool.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [email.trim().toLowerCase(), existingStudent.id]);
    if (dup.rows.length > 0)
      return { status: 409, error: 'Someone with this email address already exists' };
  }

  if (teacher_id) {
    const teacher = await assertTeacherExists(pool, teacher_id);
    if (!teacher)
      return { status: 400, error: 'Assigned teacher not found' };
  }

  if (hourly_rate != null && (isNaN(parseFloat(hourly_rate)) || parseFloat(hourly_rate) <= 0))
    return { status: 400, error: 'Hourly rate must be a positive number' };
  if (currency && !SUPPORTED_CURRENCIES.includes(currency))
    return { status: 400, error: 'Currency must be GBP or EGP' };

  return null;
}

// PATCH /admin/students/:id — edit a student
router.patch('/students/:id', asyncHandler(async (req, res) => {
  const {
    display_name, email, phone, guardian_name, teacher_id, is_active,
    hourly_rate, is_legacy_pricing, pricing_notes, currency,
  } = req.body;

  const existing = await pool.query('SELECT * FROM users WHERE id=$1 AND role=$2', [req.params.id, 'student']);
  if (existing.rows.length === 0)
    return res.status(404).json({ error: 'Student not found' });

  const validationError = await validateStudentEdit(req.body, existing.rows[0]);
  if (validationError)
    return res.status(validationError.status).json({ error: validationError.error });

  const dynamic = buildUpdateClause(
    {
      display_name: display_name?.trim() || undefined,
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone || undefined,
      guardian_name: guardian_name || undefined,
      teacher_id: teacher_id || undefined,
      is_active: is_active != null ? is_active : undefined,
      hourly_rate: hourly_rate != null ? parseFloat(hourly_rate) : undefined,
      is_legacy_pricing: is_legacy_pricing != null ? is_legacy_pricing : undefined,
      pricing_notes: pricing_notes || undefined,
      currency: currency || undefined,
    },
    1
  );
  if (dynamic.setClauses.length === 0) {
    const u = existing.rows[0];
    return res.json({ student: {
      id: u.id, display_name: u.display_name, email: u.email, phone: u.phone,
      guardian_name: u.guardian_name, teacher_id: u.teacher_id, is_active: u.is_active,
      must_change_password: u.must_change_password, hourly_rate: u.hourly_rate,
      currency: u.currency, is_legacy_pricing: u.is_legacy_pricing, pricing_notes: u.pricing_notes,
    }});
  }
  const result = await pool.query(
    `UPDATE users
     SET ${dynamic.setClauses.join(', ')}
     WHERE id = $${dynamic.nextParamIdx}
     RETURNING id, display_name, email, phone, guardian_name, teacher_id,
               is_active, must_change_password, hourly_rate, currency,
               is_legacy_pricing, pricing_notes`,
    [...dynamic.params, req.params.id]
  );
  res.json({ student: result.rows[0] });
}));

// POST /admin/students/:id/reset-password
router.post('/students/:id/reset-password', asyncHandler(async (req, res) => {
  const result = await resetPassword('student', req.params.id, req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ tempPassword: result.tempPassword, ...result.emailResult });
}));

// DELETE /admin/students/:id — permanently delete a student.
// Requires the student to already be deactivated (two-step: turn off access, then delete).
router.delete('/students/:id', asyncHandler(async (req, res) => {
  const result = await deletePerson('student', req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ rescheduleRequestsRemoved: result.rescheduleRequestsRemoved });
}));

module.exports = router;
