const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// GET /admin/students
router.get('/students', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.display_name, u.email, u.phone, u.created_at,
              p.package_name, p.total_lessons, p.used_lessons, p.expires_at
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

// POST /admin/lessons — schedule a lesson
router.post('/lessons', async (req, res) => {
  const { student_id, teacher_id, subject, scheduled_at, duration_minutes, notes } = req.body;
  if (!student_id || !teacher_id || !subject || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id, subject and scheduled_at are required' });

  const validSubjects = ['quran', 'arabic', 'islamic_studies'];
  if (!validSubjects.includes(subject))
    return res.status(400).json({ error: 'Invalid subject' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO lessons (id, student_id, teacher_id, subject, scheduled_at, duration_minutes, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, student_id, teacher_id, subject, scheduled_at, duration_minutes || 30, notes || null]
    );
    res.status(201).json({ lesson: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
