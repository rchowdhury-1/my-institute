const { pool } = require('../db');
const { generateTempPassword, hashPassword } = require('../utils/password');
const { sendWelcomeEmail } = require('../email');
const { isValidEmail } = require('./validators');
const { assertTeacherExists } = require('./queries');

/**
 * Sends the welcome email and reports the outcome, or reports "skipped"
 * without sending if send_email is false. Verbatim port of the identical
 * block that was duplicated across student/teacher create + reset-password.
 */
async function sendWelcomeAndReport({ to, name, tempPassword, role, send_email }) {
  if (!send_email) return { email_sent: false, email_status: 'skipped', email_error: null };
  return sendWelcomeEmail({ to, name, email: to, tempPassword, role })
    .catch(err => ({ email_sent: false, email_status: 'failed', email_error: err.message }));
}

const ROLE_CONFIG = {
  student: {
    // Preserves the exact original check order: hourly_rate, currency,
    // password length, then bundle fields.
    validateExtra(body) {
      const { hourly_rate, currency = 'GBP', package_name, total_lessons, expires_at, password: providedPassword } = body;
      if (hourly_rate == null) return 'Hourly rate is required';
      if (isNaN(parseFloat(hourly_rate)) || parseFloat(hourly_rate) <= 0)
        return 'Hourly rate must be a positive number';
      if (!['GBP', 'EGP'].includes(currency)) return 'Currency must be GBP or EGP';
      if (providedPassword && providedPassword.length < 8)
        return 'Password must be at least 8 characters';
      const bundleFields = [package_name, total_lessons, expires_at].filter(Boolean);
      if (bundleFields.length > 0 && bundleFields.length < 3)
        return 'To add a prepaid bundle, fill in bundle label, total lessons, and expiry date';
      if (total_lessons != null && (isNaN(parseInt(total_lessons)) || parseInt(total_lessons) < 1))
        return 'Total lessons must be a positive number';
      return null;
    },
    async validateAfterDuplicateCheck(body) {
      if (body.teacher_id) {
        const teacher = await assertTeacherExists(pool, body.teacher_id);
        if (!teacher) return 'Assigned teacher not found';
      }
      return null;
    },
    async insert({ display_name, email, hash, phone, body }) {
      const { guardian_name, teacher_id, hourly_rate, is_legacy_pricing = false, pricing_notes, currency = 'GBP' } = body;
      const result = await pool.query(
        `INSERT INTO users
           (display_name, email, password_hash, role, phone, guardian_name, teacher_id,
            hourly_rate, currency, is_legacy_pricing, pricing_notes,
            email_verified, must_change_password)
         VALUES ($1,$2,$3,'student',$4,$5,$6,$7,$8,$9,$10,true,true)
         RETURNING id, display_name, email, role`,
        [
          display_name, email, hash,
          phone || null, guardian_name || null, teacher_id || null,
          parseFloat(hourly_rate), currency, is_legacy_pricing || false,
          pricing_notes || null,
        ]
      );
      return result.rows[0];
    },
    async afterInsert(user, body) {
      const { package_name, total_lessons, expires_at } = body;
      if (package_name && total_lessons && expires_at) {
        await pool.query(
          `INSERT INTO packages (user_id, package_name, total_lessons, sessions_remaining, expires_at)
           VALUES ($1,$2,$3,$3,$4)`,
          [user.id, package_name.trim(), parseInt(total_lessons), expires_at]
        );
      }
    },
  },
  teacher: {
    validateExtra(body) {
      const { password: providedPassword } = body;
      if (providedPassword && providedPassword.length < 8)
        return 'Password must be at least 8 characters';
      return null;
    },
    async validateAfterDuplicateCheck() {
      return null;
    },
    async insert({ display_name, email, hash, phone, body }) {
      const { bio, specialisation } = body;
      const result = await pool.query(
        `INSERT INTO users
           (display_name, email, password_hash, role, phone, bio, specialisation,
            email_verified, must_change_password)
         VALUES ($1,$2,$3,'teacher',$4,$5,$6,true,true)
         RETURNING id, display_name, email, role`,
        [display_name, email, hash, phone || null, bio || null, specialisation || null]
      );
      return result.rows[0];
    },
    async afterInsert() {},
  },
};

/**
 * Shared create-account skeleton for /admin/students and /admin/teachers.
 * Returns { status, error } on failure or { status, user, tempPassword,
 * emailResult } on success — the route decides the response shape (the
 * entity key differs: `student` vs `teacher`).
 */
async function createUser(role, body) {
  const cfg = ROLE_CONFIG[role];
  const { display_name, email, phone, password: providedPassword, send_email = true } = body;

  if (!display_name || !display_name.trim())
    return { status: 400, error: 'Full name is required' };
  if (!email || !email.trim())
    return { status: 400, error: 'Email address is required' };
  if (!isValidEmail(email))
    return { status: 400, error: 'Please enter a valid email address' };

  const extraError = cfg.validateExtra(body);
  if (extraError) return { status: 400, error: extraError };

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  if (existing.rows.length > 0)
    return { status: 409, error: 'Someone with this email address already exists' };

  const dupError = await cfg.validateAfterDuplicateCheck(body);
  if (dupError) return { status: 400, error: dupError };

  const tempPassword = providedPassword || generateTempPassword();
  const hash = await hashPassword(tempPassword);

  const user = await cfg.insert({
    display_name: display_name.trim(),
    email: email.trim().toLowerCase(),
    hash, phone, body,
  });

  await cfg.afterInsert(user, body);

  const emailResult = await sendWelcomeAndReport({
    to: user.email, name: user.display_name, tempPassword, role, send_email,
  });

  return { status: 201, user, tempPassword, emailResult };
}

/**
 * Shared reset-password skeleton for /admin/students/:id/reset-password and
 * /admin/teachers/:id/reset-password.
 */
async function resetPassword(role, userId, { send_email = true } = {}) {
  const existing = await pool.query('SELECT * FROM users WHERE id=$1 AND role=$2', [userId, role]);
  if (existing.rows.length === 0)
    return { status: 404, error: `${role === 'teacher' ? 'Teacher' : 'Student'} not found` };
  const user = existing.rows[0];

  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);

  await pool.query(
    'UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2',
    [hash, userId]
  );

  const emailResult = await sendWelcomeAndReport({
    to: user.email, name: user.display_name, tempPassword, role, send_email,
  });

  return { status: 200, tempPassword, emailResult };
}

module.exports = { sendWelcomeAndReport, createUser, resetPassword };
