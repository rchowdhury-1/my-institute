const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../email');
const { generateTempPassword, hashPassword } = require('../utils/password');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'supervisor'));

// ─── Students ────────────────────────────────────────────────────────────────

// GET /admin/students
router.get('/students', async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/students — create a student account
router.post('/students', async (req, res) => {
  const {
    display_name, email, phone, guardian_name, teacher_id,
    password: providedPassword, send_email = true,
    hourly_rate, is_legacy_pricing = false, pricing_notes, currency = 'GBP',
    package_name, total_lessons, expires_at,
  } = req.body;

  if (!display_name || !display_name.trim())
    return res.status(400).json({ error: 'Full name is required' });
  if (!email || !email.trim())
    return res.status(400).json({ error: 'Email address is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Please enter a valid email address' });
  if (hourly_rate == null)
    return res.status(400).json({ error: 'Hourly rate is required' });
  if (isNaN(parseFloat(hourly_rate)) || parseFloat(hourly_rate) <= 0)
    return res.status(400).json({ error: 'Hourly rate must be a positive number' });
  if (!['GBP', 'EGP'].includes(currency))
    return res.status(400).json({ error: 'Currency must be GBP or EGP' });
  if (providedPassword && providedPassword.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  // Bundle fields are all-or-nothing
  const bundleFields = [package_name, total_lessons, expires_at].filter(Boolean);
  if (bundleFields.length > 0 && bundleFields.length < 3)
    return res.status(400).json({ error: 'To add a prepaid bundle, fill in bundle label, total lessons, and expiry date' });
  if (total_lessons != null && (isNaN(parseInt(total_lessons)) || parseInt(total_lessons) < 1))
    return res.status(400).json({ error: 'Total lessons must be a positive number' });

  try {
    // Duplicate email check
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Someone with this email address already exists' });

    // Validate teacher_id if provided
    if (teacher_id) {
      const teacherCheck = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'teacher'", [teacher_id]
      );
      if (teacherCheck.rows.length === 0)
        return res.status(400).json({ error: 'Assigned teacher not found' });
    }

    const tempPassword = providedPassword || generateTempPassword();
    const hash = await hashPassword(tempPassword);

    const result = await pool.query(
      `INSERT INTO users
         (display_name, email, password_hash, role, phone, guardian_name, teacher_id,
          hourly_rate, currency, is_legacy_pricing, pricing_notes,
          email_verified, must_change_password)
       VALUES ($1,$2,$3,'student',$4,$5,$6,$7,$8,$9,$10,true,true)
       RETURNING id, display_name, email, role`,
      [
        display_name.trim(), email.trim().toLowerCase(), hash,
        phone || null, guardian_name || null, teacher_id || null,
        parseFloat(hourly_rate), currency, is_legacy_pricing || false,
        pricing_notes || null,
      ]
    );
    const student = result.rows[0];

    // Optionally create a prepaid bundle
    if (package_name && total_lessons && expires_at) {
      await pool.query(
        `INSERT INTO packages (user_id, package_name, total_lessons, sessions_remaining, expires_at)
         VALUES ($1,$2,$3,$3,$4)`,
        [student.id, package_name.trim(), parseInt(total_lessons), expires_at]
      );
    }

    // Fire-and-forget welcome email
    if (send_email) {
      sendWelcomeEmail({
        to: student.email, name: student.display_name,
        email: student.email, tempPassword, role: 'student',
      }).catch(() => {});
    }

    res.status(201).json({ student, tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/students/:id — edit a student
router.patch('/students/:id', async (req, res) => {
  const {
    display_name, email, phone, guardian_name, teacher_id, is_active,
    hourly_rate, is_legacy_pricing, pricing_notes, currency,
  } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM users WHERE id=$1 AND role=$2', [req.params.id, 'student']);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Student not found' });

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return res.status(400).json({ error: 'Please enter a valid email address' });
      const dup = await pool.query('SELECT id FROM users WHERE email=$1 AND id!=$2', [email.trim().toLowerCase(), req.params.id]);
      if (dup.rows.length > 0)
        return res.status(409).json({ error: 'Someone with this email address already exists' });
    }

    if (teacher_id) {
      const teacherCheck = await pool.query("SELECT id FROM users WHERE id=$1 AND role='teacher'", [teacher_id]);
      if (teacherCheck.rows.length === 0)
        return res.status(400).json({ error: 'Assigned teacher not found' });
    }

    if (hourly_rate != null && (isNaN(parseFloat(hourly_rate)) || parseFloat(hourly_rate) <= 0))
      return res.status(400).json({ error: 'Hourly rate must be a positive number' });
    if (currency && !['GBP', 'EGP'].includes(currency))
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/students/:id/reset-password
router.post('/students/:id/reset-password', async (req, res) => {
  const { send_email = true } = req.body;
  try {
    const existing = await pool.query("SELECT * FROM users WHERE id=$1 AND role='student'", [req.params.id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Student not found' });
    const user = existing.rows[0];

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    await pool.query(
      'UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2',
      [hash, req.params.id]
    );

    if (send_email) {
      sendWelcomeEmail({
        to: user.email, name: user.display_name,
        email: user.email, tempPassword, role: 'student',
      }).catch(() => {});
    }

    res.json({ tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Teachers ────────────────────────────────────────────────────────────────

// GET /admin/teachers
router.get('/teachers', async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/teachers — create a teacher account
router.post('/teachers', async (req, res) => {
  const {
    display_name, email, phone, bio, specialisation,
    password: providedPassword, send_email = true,
  } = req.body;

  if (!display_name || !display_name.trim())
    return res.status(400).json({ error: 'Full name is required' });
  if (!email || !email.trim())
    return res.status(400).json({ error: 'Email address is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Please enter a valid email address' });
  if (providedPassword && providedPassword.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Someone with this email address already exists' });

    const tempPassword = providedPassword || generateTempPassword();
    const hash = await hashPassword(tempPassword);

    const result = await pool.query(
      `INSERT INTO users
         (display_name, email, password_hash, role, phone, bio, specialisation,
          email_verified, must_change_password)
       VALUES ($1,$2,$3,'teacher',$4,$5,$6,true,true)
       RETURNING id, display_name, email, role`,
      [display_name.trim(), email.trim().toLowerCase(), hash, phone || null, bio || null, specialisation || null]
    );
    const teacher = result.rows[0];

    if (send_email) {
      sendWelcomeEmail({
        to: teacher.email, name: teacher.display_name,
        email: teacher.email, tempPassword, role: 'teacher',
      }).catch(() => {});
    }

    res.status(201).json({ teacher, tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/teachers/:id — edit a teacher
router.patch('/teachers/:id', async (req, res) => {
  const { display_name, email, phone, bio, specialisation, is_active } = req.body;

  try {
    const existing = await pool.query("SELECT * FROM users WHERE id=$1 AND role='teacher'", [req.params.id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Teacher not found' });

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
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

    const result = await pool.query(
      `UPDATE users
       SET display_name  = COALESCE($1, display_name),
           email         = COALESCE($2, email),
           phone         = COALESCE($3, phone),
           bio           = COALESCE($4, bio),
           specialisation = COALESCE($5, specialisation),
           is_active     = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING id, display_name, email, phone, bio, specialisation, is_active, must_change_password`,
      [
        display_name?.trim() || null,
        email ? email.trim().toLowerCase() : null,
        phone !== undefined ? (phone || null) : null,
        bio !== undefined ? (bio || null) : null,
        specialisation !== undefined ? (specialisation || null) : null,
        is_active != null ? is_active : null,
        req.params.id,
      ]
    );
    res.json({ teacher: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/teachers/:id/reset-password
router.post('/teachers/:id/reset-password', async (req, res) => {
  const { send_email = true } = req.body;
  try {
    const existing = await pool.query("SELECT * FROM users WHERE id=$1 AND role='teacher'", [req.params.id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Teacher not found' });
    const user = existing.rows[0];

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    await pool.query(
      'UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2',
      [hash, req.params.id]
    );

    if (send_email) {
      sendWelcomeEmail({
        to: user.email, name: user.display_name,
        email: user.email, tempPassword, role: 'teacher',
      }).catch(() => {});
    }

    res.json({ tempPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Packages ────────────────────────────────────────────────────────────────

// POST /admin/packages — create/assign a prepaid bundle for a student
router.post('/packages', async (req, res) => {
  const { student_id, package_name, total_lessons, expires_at } = req.body;
  if (!student_id || !package_name || !total_lessons)
    return res.status(400).json({ error: 'student_id, package_name and total_lessons are required' });

  try {
    const result = await pool.query(
      `INSERT INTO packages (user_id, package_name, total_lessons, sessions_remaining, expires_at)
       VALUES ($1, $2, $3, $3, $4)
       RETURNING *`,
      [student_id, package_name, parseInt(total_lessons), expires_at || null]
    );
    res.status(201).json({ package: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/packages/:id — update bundle details and/or renewal date
router.patch('/packages/:id', async (req, res) => {
  const { package_name, total_lessons, sessions_remaining, expires_at } = req.body;

  try {
    const result = await pool.query(
      `UPDATE packages
       SET package_name       = COALESCE($1, package_name),
           total_lessons      = COALESCE($2, total_lessons),
           sessions_remaining = COALESCE($3, sessions_remaining),
           expires_at         = COALESCE($4, expires_at)
       WHERE id = $5
       RETURNING *`,
      [
        package_name || null,
        total_lessons != null ? parseInt(total_lessons) : null,
        sessions_remaining != null ? parseInt(sessions_remaining) : null,
        expires_at || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Bundle not found' });
    res.json({ package: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Student Payments ────────────────────────────────────────────────────────

// GET /admin/payments/student — view all student payments
router.get('/payments/student', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sp.*, u.display_name AS student_name, a.display_name AS logged_by_name
       FROM student_payments sp
       JOIN users u ON u.id = sp.student_id
       LEFT JOIN users a ON a.id = sp.logged_by
       ORDER BY sp.created_at DESC`
    );
    res.json({ payments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/payments/student — log a student payment manually
router.post('/payments/student', async (req, res) => {
  const { student_id, amount, currency, payment_method, notes } = req.body;
  if (!student_id || !amount)
    return res.status(400).json({ error: 'student_id and amount are required' });

  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Free Trials ─────────────────────────────────────────────────────────────

// GET /admin/free-trials
router.get('/free-trials', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM free_trials ORDER BY created_at DESC');
    res.json({ free_trials: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/free-trials/:id
router.patch('/free-trials/:id', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'contacted', 'converted'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const result = await pool.query(
      'UPDATE free_trials SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ free_trial: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Scholarships ────────────────────────────────────────────────────────────

// GET /admin/scholarships
router.get('/scholarships', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scholarship_applications ORDER BY created_at DESC');
    res.json({ scholarships: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/scholarships/:id
router.patch('/scholarships/:id', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'approved', 'rejected'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const result = await pool.query(
      'UPDATE scholarship_applications SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ scholarship: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Sessions ────────────────────────────────────────────────────────────────

// GET /admin/sessions — all sessions with student + teacher names
router.get('/sessions', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT s.*,
                        st.display_name AS student_name,
                        t.display_name  AS teacher_name
                 FROM sessions s
                 JOIN users st ON st.id = s.student_id
                 JOIN users t  ON t.id  = s.teacher_id`;
    const params = [];
    if (status) {
      query += ` WHERE s.status = $1`;
      params.push(status);
    }
    query += ` ORDER BY s.scheduled_at DESC`;
    const result = await pool.query(query, params);
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/lessons — schedule a session (with rate snapshot)
router.post('/lessons', async (req, res) => {
  const { student_id, teacher_id, subject, scheduled_at, duration_minutes, notes, zoom_link } = req.body;
  if (!student_id || !teacher_id || !subject || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id, subject and scheduled_at are required' });

  const validSubjects = ['quran', 'arabic', 'islamic_studies'];
  if (!validSubjects.includes(subject))
    return res.status(400).json({ error: 'Invalid subject' });

  const dur = parseInt(duration_minutes) || 60;
  if (dur % 30 !== 0 || dur < 30)
    return res.status(400).json({ error: 'Duration must be 30, 60, 90, or 120 minutes' });

  try {
    // Snapshot the student's current rate at session creation time
    const studentResult = await pool.query(
      "SELECT hourly_rate, currency FROM users WHERE id=$1 AND role='student'",
      [student_id]
    );
    const { hourly_rate = null, currency = null } = studentResult.rows[0] || {};

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO sessions
         (id, student_id, teacher_id, subject, scheduled_at, duration_minutes, zoom_link,
          rate_at_creation, currency_at_creation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, student_id, teacher_id, subject, scheduled_at, dur, zoom_link || null, hourly_rate, currency]
    );
    res.status(201).json({ lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
