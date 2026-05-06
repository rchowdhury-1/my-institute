const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'supervisor'));

// ─── Students ────────────────────────────────────────────────────────────────

// GET /admin/students
router.get('/students', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.display_name, u.email, u.phone, u.created_at,
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

// ─── Teachers ────────────────────────────────────────────────────────────────

// GET /admin/teachers
router.get('/teachers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, display_name, email, phone, created_at
       FROM users WHERE role = 'teacher'
       ORDER BY created_at DESC`
    );
    res.json({ teachers: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Packages ────────────────────────────────────────────────────────────────

// POST /admin/packages — create/assign a package for a student
router.post('/packages', async (req, res) => {
  const { student_id, package_name, total_lessons, expires_at } = req.body;
  if (!student_id || !package_name || !total_lessons)
    return res.status(400).json({ error: 'student_id, package_name and total_lessons are required' });

  const validPackages = ['simple', 'pro', 'elite'];
  if (!validPackages.includes(package_name))
    return res.status(400).json({ error: 'Invalid package name. Use: simple, pro, elite' });

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

// PATCH /admin/packages/:id — update package details and/or renewal date
router.patch('/packages/:id', async (req, res) => {
  const { package_name, total_lessons, sessions_remaining, expires_at } = req.body;

  if (package_name) {
    const valid = ['simple', 'pro', 'elite'];
    if (!valid.includes(package_name))
      return res.status(400).json({ error: 'Invalid package name' });
  }

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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Package not found' });
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

// POST /admin/lessons — schedule a lesson (kept for backwards compat; now writes to sessions)
router.post('/lessons', async (req, res) => {
  const { student_id, teacher_id, subject, scheduled_at, duration_minutes, notes, zoom_link } = req.body;
  if (!student_id || !teacher_id || !subject || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id, subject and scheduled_at are required' });

  const validSubjects = ['quran', 'arabic', 'islamic_studies'];
  if (!validSubjects.includes(subject))
    return res.status(400).json({ error: 'Invalid subject' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO sessions (id, student_id, teacher_id, subject, scheduled_at, duration_minutes, zoom_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, student_id, teacher_id, subject, scheduled_at, duration_minutes || 30, zoom_link || null]
    );
    res.status(201).json({ lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
