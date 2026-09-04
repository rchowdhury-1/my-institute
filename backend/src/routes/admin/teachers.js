const express = require('express');
const { pool } = require('../../db');
const { asyncHandler } = require('../../middleware/errors');
const { isValidEmail } = require('../../lib/validators');
const { buildUpdateClause } = require('../../lib/queries');
const { createUser, resetPassword, deletePerson } = require('../../lib/users');

const router = express.Router();

// ─── Teachers ────────────────────────────────────────────────────────────────

// GET /admin/teachers
router.get('/teachers', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.display_name, u.email, u.phone, u.bio, u.specialisation,
            u.is_active, u.must_change_password, u.created_at,
            COUNT(DISTINCT s.student_id) FILTER (WHERE s.status = 'scheduled') AS active_student_count
     FROM users u
     LEFT JOIN sessions s ON s.teacher_id = u.id
     WHERE u.role = 'teacher'
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  res.json({ teachers: result.rows });
}));

// POST /admin/teachers — create a teacher account
router.post('/teachers', asyncHandler(async (req, res) => {
  const result = await createUser('teacher', req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(result.status).json({ teacher: result.user, tempPassword: result.tempPassword, ...result.emailResult });
}));

// PATCH /admin/teachers/:id — edit a teacher
router.patch('/teachers/:id', asyncHandler(async (req, res) => {
  const { display_name, email, phone, bio, specialisation, is_active } = req.body;

  const existing = await pool.query("SELECT * FROM users WHERE id=$1 AND role='teacher'", [req.params.id]);
  if (existing.rows.length === 0)
    return res.status(404).json({ error: 'Teacher not found' });

  if (email) {
    if (!isValidEmail(email))
      return res.status(400).json({ error: 'Please enter a valid email address' });
    const dup = await pool.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [email.trim().toLowerCase(), req.params.id]);
    if (dup.rows.length > 0)
      return res.status(409).json({ error: 'Someone with this email address already exists' });
  }

  // Block deactivation if teacher has upcoming scheduled sessions
  if (is_active === false) {
    const upcoming = await pool.query(
      "SELECT id FROM sessions WHERE teacher_id=$1 AND status='scheduled' AND scheduled_at > NOW() LIMIT 1",
      [req.params.id]
    );
    if (upcoming.rows.length > 0)
      return res.status(409).json({ error: 'This teacher has upcoming lessons. Reassign or cancel those first.' });
  }

  const dynamic = buildUpdateClause(
    {
      display_name: display_name?.trim() || undefined,
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone || undefined,
      bio: bio || undefined,
      specialisation: specialisation || undefined,
      is_active: is_active != null ? is_active : undefined,
    },
    1
  );
  if (dynamic.setClauses.length === 0) {
    const u = existing.rows[0];
    return res.json({ teacher: {
      id: u.id, display_name: u.display_name, email: u.email, phone: u.phone,
      bio: u.bio, specialisation: u.specialisation, is_active: u.is_active,
      must_change_password: u.must_change_password,
    }});
  }
  const result = await pool.query(
    `UPDATE users
     SET ${dynamic.setClauses.join(', ')}
     WHERE id = $${dynamic.nextParamIdx}
     RETURNING id, display_name, email, phone, bio, specialisation, is_active, must_change_password`,
    [...dynamic.params, req.params.id]
  );
  res.json({ teacher: result.rows[0] });
}));

// POST /admin/teachers/:id/reset-password
router.post('/teachers/:id/reset-password', asyncHandler(async (req, res) => {
  const result = await resetPassword('teacher', req.params.id, req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ tempPassword: result.tempPassword, ...result.emailResult });
}));

// DELETE /admin/teachers/:id — permanently delete a teacher.
// Requires the teacher to already be deactivated (two-step: turn off access, then delete).
router.delete('/teachers/:id', asyncHandler(async (req, res) => {
  const result = await deletePerson('teacher', req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ rescheduleRequestsRemoved: result.rescheduleRequestsRemoved });
}));

module.exports = router;
