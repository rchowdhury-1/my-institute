const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { notify } = require('../lib/notify');
const { formatSessionTime } = require('../lib/datetime');
const { asyncHandler } = require('../middleware/errors');
const { isValidEmail, validateDuration, validateEnum } = require('../lib/validators');
const { getDisplayName, assertTeacherExists, hasTeacherConflict } = require('../lib/queries');
const { createUser, resetPassword } = require('../lib/users');
const { SUPPORTED_CURRENCIES } = require('../config');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'supervisor'));

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
}));

// POST /admin/teachers/:id/reset-password
router.post('/teachers/:id/reset-password', asyncHandler(async (req, res) => {
  const result = await resetPassword('teacher', req.params.id, req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ tempPassword: result.tempPassword, ...result.emailResult });
}));

// ─── Packages ────────────────────────────────────────────────────────────────

// POST /admin/packages — create/assign a prepaid bundle for a student
router.post('/packages', asyncHandler(async (req, res) => {
  const { student_id, package_name, total_lessons, expires_at } = req.body;
  if (!student_id || !package_name || !total_lessons)
    return res.status(400).json({ error: 'student_id, package_name and total_lessons are required' });

  const result = await pool.query(
    `INSERT INTO packages (user_id, package_name, total_lessons, sessions_remaining, expires_at)
     VALUES ($1, $2, $3, $3, $4)
     RETURNING *`,
    [student_id, package_name, parseInt(total_lessons), expires_at || null]
  );
  res.status(201).json({ package: result.rows[0] });
}));

// PATCH /admin/packages/:id — update bundle details and/or renewal date
router.patch('/packages/:id', asyncHandler(async (req, res) => {
  const { package_name, total_lessons, sessions_remaining, expires_at } = req.body;

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
}));

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

// ─── Free Trials ─────────────────────────────────────────────────────────────

// GET /admin/free-trials
router.get('/free-trials', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM free_trials ORDER BY created_at DESC');
  res.json({ free_trials: result.rows });
}));

// PATCH /admin/free-trials/:id
router.patch('/free-trials/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const statusError = validateEnum(status, ['pending', 'contacted', 'converted']);
  if (statusError) return res.status(400).json({ error: statusError });

  const result = await pool.query(
    'UPDATE free_trials SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ free_trial: result.rows[0] });
}));

// ─── Scholarships ────────────────────────────────────────────────────────────

// GET /admin/scholarships
router.get('/scholarships', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM scholarship_applications ORDER BY created_at DESC');
  res.json({ scholarships: result.rows });
}));

// PATCH /admin/scholarships/:id
router.patch('/scholarships/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const statusError = validateEnum(status, ['pending', 'approved', 'rejected']);
  if (statusError) return res.status(400).json({ error: statusError });

  const result = await pool.query(
    'UPDATE scholarship_applications SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ scholarship: result.rows[0] });
}));

// ─── Sessions ────────────────────────────────────────────────────────────────

// GET /admin/sessions — all sessions with student + teacher names
router.get('/sessions', asyncHandler(async (req, res) => {
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
}));

// POST /admin/lessons — schedule a session (with rate snapshot)
router.post('/lessons', asyncHandler(async (req, res) => {
  const { student_id, teacher_id, subject, scheduled_at, duration_minutes, notes, zoom_link } = req.body;
  if (!student_id || !teacher_id || !subject || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id, subject and scheduled_at are required' });

  const validSubjects = ['quran', 'arabic', 'islamic_studies'];
  if (!validSubjects.includes(subject))
    return res.status(400).json({ error: 'Invalid subject' });

  const dur = parseInt(duration_minutes) || 60;
  const durationError = validateDuration(dur);
  if (durationError) return res.status(400).json({ error: durationError });

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
}));

// ─── Revert Applications ────────────────────────────────────────────────────

// GET /admin/revert-applications — list all, newest first
router.get('/revert-applications', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM revert_applications ORDER BY created_at DESC'
  );
  res.json({ applications: result.rows });
}));

// PATCH /admin/revert-applications/:id — update status
router.patch('/revert-applications/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const statusError = validateEnum(status, ['new', 'contacted', 'enrolled', 'archived']);
  if (statusError) return res.status(400).json({ error: statusError });

  const result = await pool.query(
    'UPDATE revert_applications SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Not found' });
  res.json({ application: result.rows[0] });
}));

// ─── Teacher Hours ──────────────────────────────────────────────────────────

// GET /admin/teacher-hours — monthly teaching hours + salary per teacher
router.get('/teacher-hours', asyncHandler(async (req, res) => {
  const now = new Date();
  const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Validate YYYY-MM format
  if (!/^\d{4}-\d{2}$/.test(month))
    return res.status(400).json({ error: 'month must be in YYYY-MM format' });

  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 1));

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

  const sets = ['pay_rate_per_hour = $1'];
  const params = [parseFloat(pay_rate_per_hour)];
  let idx = 2;

  if (pay_currency) {
    sets.push(`pay_currency = $${idx++}`);
    params.push(pay_currency);
  }

  params.push(id);
  const result = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, display_name, pay_rate_per_hour, pay_currency`,
    params
  );

  res.json({ teacher: result.rows[0] });
}));

// ─── Newsfeed ───────────────────────────────────────────────────────────────

// GET /admin/newsfeed — all posts, newest first, paginated
router.get('/newsfeed', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const countResult = await pool.query('SELECT COUNT(*) FROM newsfeed_posts');
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(
    `SELECT * FROM newsfeed_posts ORDER BY published_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  res.json({
    posts: result.rows,
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
}));

// POST /admin/newsfeed — create post
router.post('/newsfeed', asyncHandler(async (req, res) => {
  const { type, title, body, image_url, show_on_homepage = false } = req.body;

  if (!type || !title || !body)
    return res.status(400).json({ error: 'type, title, and body are required' });

  const typeError = validateEnum(type, ['quote', 'honour_list', 'general'], 'type must be quote, honour_list, or general');
  if (typeError) return res.status(400).json({ error: typeError });

  const result = await pool.query(
    `INSERT INTO newsfeed_posts (type, title, body, image_url, show_on_homepage, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [type, title.trim(), body.trim(), image_url || null, show_on_homepage, req.userId]
  );
  res.status(201).json({ post: result.rows[0] });
}));

// PATCH /admin/newsfeed/:id — update post
router.patch('/newsfeed/:id', asyncHandler(async (req, res) => {
  const { type, title, body, image_url, show_on_homepage } = req.body;

  if (type) {
    const typeError = validateEnum(type, ['quote', 'honour_list', 'general'], 'type must be quote, honour_list, or general');
    if (typeError) return res.status(400).json({ error: typeError });
  }

  const result = await pool.query(
    `UPDATE newsfeed_posts
     SET type             = COALESCE($1, type),
         title            = COALESCE($2, title),
         body             = COALESCE($3, body),
         image_url        = COALESCE($4, image_url),
         show_on_homepage = COALESCE($5, show_on_homepage),
         updated_at       = NOW()
     WHERE id = $6
     RETURNING *`,
    [
      type || null,
      title?.trim() || null,
      body?.trim() || null,
      image_url !== undefined ? (image_url || null) : null,
      show_on_homepage != null ? show_on_homepage : null,
      req.params.id,
    ]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Post not found' });
  res.json({ post: result.rows[0] });
}));

// DELETE /admin/newsfeed/:id — hard delete
router.delete('/newsfeed/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'DELETE FROM newsfeed_posts WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (result.rows.length === 0)
    return res.status(404).json({ error: 'Post not found' });
  res.json({ deleted: true });
}));

// ─── PATCH /admin/sessions/:id — edit a session ────────────────────────────
router.patch('/sessions/:id', asyncHandler(async (req, res) => {
  const { scheduled_at, duration_minutes, subject, teacher_id, zoom_link, notes } = req.body;
  const { id } = req.params;

  const existing = await pool.query(
    `SELECT s.*,
            st.display_name AS student_name, st.phone AS student_phone,
            t.display_name  AS teacher_name
     FROM sessions s
     JOIN users st ON st.id = s.student_id
     JOIN users t  ON t.id  = s.teacher_id
     WHERE s.id = $1`, [id]
  );
  if (existing.rows.length === 0)
    return res.status(404).json({ error: 'Session not found' });
  const session = existing.rows[0];

  // Validate inputs
  if (duration_minutes != null) {
    const dur = parseInt(duration_minutes);
    const durationError = validateDuration(dur);
    if (durationError) return res.status(400).json({ error: durationError });
  }

  if (teacher_id) {
    const teacher = await assertTeacherExists(pool, teacher_id, { requireActive: true });
    if (!teacher)
      return res.status(400).json({ error: 'Teacher not found or inactive' });
  }

  if (scheduled_at) {
    if (isNaN(new Date(scheduled_at).getTime()))
      return res.status(400).json({ error: 'Invalid date' });
    if (new Date(scheduled_at) <= new Date())
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
  }

  // Overlap check if time or teacher changed
  const effectiveTeacher = teacher_id || session.teacher_id;
  const effectiveTime = scheduled_at ? new Date(scheduled_at).toISOString() : session.scheduled_at;
  const effectiveDuration = duration_minutes != null ? parseInt(duration_minutes) : session.duration_minutes;

  if (scheduled_at || teacher_id) {
    const conflict = await hasTeacherConflict(pool, {
      teacherId: effectiveTeacher,
      scheduledAt: effectiveTime,
      durationMinutes: effectiveDuration,
      excludeSessionId: id,
    });
    if (conflict)
      return res.status(409).json({
        error: 'The chosen teacher already has a session overlapping this time. Please pick a different time or teacher.',
        code: 'TEACHER_CONFLICT',
      });
  }

  // Build SET clause dynamically
  const sets = ['last_modified_by = $1', 'updated_at = now()'];
  const params = [req.userId];
  let paramIdx = 2;

  const changes = {};

  if (scheduled_at !== undefined) {
    sets.push(`scheduled_at = $${paramIdx++}`);
    params.push(new Date(scheduled_at).toISOString());
    changes.scheduled_at = { from: session.scheduled_at, to: scheduled_at };
  }
  if (duration_minutes !== undefined) {
    sets.push(`duration_minutes = $${paramIdx++}`);
    params.push(parseInt(duration_minutes));
    if (parseInt(duration_minutes) !== session.duration_minutes)
      changes.duration_minutes = { from: session.duration_minutes, to: parseInt(duration_minutes) };
  }
  if (subject !== undefined) {
    sets.push(`subject = $${paramIdx++}`);
    params.push(subject);
    if (subject !== session.subject)
      changes.subject = { from: session.subject, to: subject };
  }
  if (teacher_id !== undefined) {
    sets.push(`teacher_id = $${paramIdx++}`);
    params.push(teacher_id);
    if (teacher_id !== session.teacher_id)
      changes.teacher_id = { from: session.teacher_id, to: teacher_id };
  }
  if (zoom_link !== undefined) {
    sets.push(`zoom_link = $${paramIdx++}`);
    params.push(zoom_link || null);
    if ((zoom_link || null) !== session.zoom_link)
      changes.zoom_link = true;
  }
  if (notes !== undefined) {
    sets.push(`notes = $${paramIdx++}`);
    params.push(notes || null);
    if ((notes || null) !== session.notes)
      changes.notes = true;
  }

  params.push(id);
  const result = await pool.query(
    `UPDATE sessions SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
  const updated = result.rows[0];

  // ── Batched notifications ──
  const hasVisibleChange = changes.scheduled_at || changes.duration_minutes ||
    changes.subject || changes.teacher_id || changes.zoom_link;

  if (hasVisibleChange) {
    // Build change summary parts
    const parts = [];
    if (changes.scheduled_at)
      parts.push(`New time: ${formatSessionTime(changes.scheduled_at.to)}`);
    if (changes.duration_minutes)
      parts.push(`New duration: ${changes.duration_minutes.to} min`);
    if (changes.subject) {
      const label = (s) => s === 'quran' ? 'Quran' : s === 'arabic' ? 'Arabic' : 'Islamic Studies';
      parts.push(`New subject: ${label(changes.subject.to)}`);
    }
    if (changes.zoom_link)
      parts.push('Zoom link updated');

    if (changes.teacher_id) {
      // Get names for old and new teacher
      const newTeacherRes = await pool.query('SELECT display_name FROM users WHERE id = $1', [changes.teacher_id.to]);
      const newTeacherName = newTeacherRes.rows[0]?.display_name || 'a new teacher';
      const changeSummary = parts.length > 0 ? ' ' + parts.join('. ') + '.' : '';

      // Student: full summary with new teacher name
      await notify(session.student_id, 'session_updated', 'Session Updated',
        `Your session has been updated. New teacher: ${newTeacherName}.${changeSummary}`,
        '/student/sessions');

      // Old teacher: reassignment notice
      await notify(session.teacher_id, 'session_updated', 'Session Reassigned',
        'A session has been reassigned to a different teacher.',
        '/teacher/dashboard');

      // New teacher: assignment notice with changes
      await notify(changes.teacher_id.to, 'session_updated', 'Session Assigned',
        `A session with ${session.student_name} has been assigned to you.${changeSummary}`,
        '/teacher/dashboard');
    } else {
      // No teacher change — notify student + current teacher
      const changeSummary = parts.join('. ') + '.';
      await notify(session.student_id, 'session_updated', 'Session Updated',
        `Your session has been updated. ${changeSummary}`,
        '/student/sessions');
      await notify(session.teacher_id, 'session_updated', 'Session Updated',
        `A session with ${session.student_name} has been updated. ${changeSummary}`,
        '/teacher/dashboard');
    }
  }
  // notes-only change: no notifications

  // Return with joined names
  const nameRes = await pool.query(
    `SELECT st.display_name AS student_name, t.display_name AS teacher_name,
            st.phone AS student_phone
     FROM users st, users t
     WHERE st.id = $1 AND t.id = $2`,
    [updated.student_id, updated.teacher_id]
  );
  const names = nameRes.rows[0] || {};

  res.json({
    session: { ...updated, ...names },
    changes: Object.keys(changes).filter(k => k !== 'notes'),
  });
}));

module.exports = router;
