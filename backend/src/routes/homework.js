const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify } = require('../lib/notify');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(requireAuth);

// POST /homework  (teacher / admin)
router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  const { student_id, title, description, file_url, due_date } = req.body;
  if (!student_id || !title)
    return res.status(400).json({ error: 'student_id and title are required' });

  try {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO homework (id, teacher_id, student_id, title, description, file_url, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, req.userId, student_id, title, description || null, file_url || null, due_date || null]
    );
    await notify(student_id, 'homework_assigned', 'New Homework',
      `You have been assigned: ${title}`, '/student/homework');
    res.status(201).json({ homework: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /homework
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.userRole === 'student') {
      result = await pool.query(
        `SELECT h.*, u.display_name AS teacher_name,
                hs.notes AS submission_notes, hs.file_url AS submission_file, hs.submitted_at
         FROM homework h
         JOIN users u ON u.id = h.teacher_id
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1
         WHERE h.student_id = $1
         ORDER BY h.created_at DESC`,
        [req.userId]
      );
    } else if (req.userRole === 'teacher') {
      result = await pool.query(
        `SELECT h.*, u.display_name AS student_name,
                (SELECT COUNT(*)::int FROM homework_submissions hs WHERE hs.homework_id = h.id) AS submission_count
         FROM homework h
         JOIN users u ON u.id = h.student_id
         WHERE h.teacher_id = $1
         ORDER BY h.created_at DESC`,
        [req.userId]
      );
    } else {
      result = await pool.query(
        `SELECT h.*, st.display_name AS student_name, t.display_name AS teacher_name
         FROM homework h
         JOIN users st ON st.id = h.student_id
         JOIN users t  ON t.id  = h.teacher_id
         ORDER BY h.created_at DESC`
      );
    }
    res.json({ homework: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /homework/:id/submissions  (teacher / admin)
router.get('/:id/submissions', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const hw = await pool.query('SELECT * FROM homework WHERE id=$1', [req.params.id]);
    if (hw.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (req.userRole === 'teacher' && hw.rows[0].teacher_id !== req.userId)
      return res.status(403).json({ error: 'Forbidden' });

    const subs = await pool.query(
      `SELECT hs.*, u.display_name AS student_name
       FROM homework_submissions hs
       JOIN users u ON u.id = hs.student_id
       WHERE hs.homework_id = $1
       ORDER BY hs.submitted_at DESC`,
      [req.params.id]
    );
    res.json({ submissions: subs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /homework/:id/submit  (student)
router.post('/:id/submit', requireRole('student'), async (req, res) => {
  const { notes, file_url } = req.body;
  const { id } = req.params;

  try {
    const hw = await pool.query(
      'SELECT * FROM homework WHERE id=$1 AND student_id=$2', [id, req.userId]
    );
    if (hw.rows.length === 0) return res.status(404).json({ error: 'Homework not found' });

    const subId = uuidv4();
    const result = await pool.query(
      `INSERT INTO homework_submissions (id, homework_id, student_id, notes, file_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [subId, id, req.userId, notes || null, file_url || null]
    );
    await pool.query(`UPDATE homework SET status='submitted' WHERE id=$1`, [id]);
    await notify(hw.rows[0].teacher_id, 'homework_submitted', 'Homework Submitted',
      `A student submitted: ${hw.rows[0].title}`, '/teacher/homework');

    res.status(201).json({ submission: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /homework/:id/grade  (teacher / admin)
router.patch('/:id/grade', requireRole('teacher', 'admin'), async (req, res) => {
  const { grade, teacher_notes } = req.body;
  const { id } = req.params;

  try {
    const hw = await pool.query(
      'SELECT * FROM homework WHERE id=$1 AND teacher_id=$2', [id, req.userId]
    );
    if (hw.rows.length === 0) return res.status(404).json({ error: 'Homework not found' });

    const result = await pool.query(
      `UPDATE homework SET status='graded', grade=$1, teacher_notes=$2 WHERE id=$3 RETURNING *`,
      [grade || null, teacher_notes || null, id]
    );
    await notify(hw.rows[0].student_id, 'homework_graded', 'Homework Graded',
      `Your homework "${hw.rows[0].title}" has been graded${grade ? `: ${grade}` : ''}`,
      '/student/homework');

    res.json({ homework: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
