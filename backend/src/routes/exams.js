const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const { submitExam } = require('../services/exams');

// POST /exams — teacher creates exam with questions
router.post('/', requireAuth, requireRole('teacher', 'admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { title, description, time_limit_minutes, questions } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const examRes = await client.query(
      `INSERT INTO exams (teacher_id, title, description, time_limit_minutes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, title, description || null, time_limit_minutes || null]
    );
    const exam = examRes.rows[0];
    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        await client.query(
          `INSERT INTO exam_questions (exam_id, question, options, correct_answer, points)
           VALUES ($1, $2, $3, $4, $5)`,
          [exam.id, q.question, JSON.stringify(q.options), q.correct_answer, q.points || 1]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ exam });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /exams — filtered by role
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  let result;
  if (req.userRole === 'student') {
    result = await pool.query(
      `SELECT ea.id, ea.exam_id, ea.status, ea.score, ea.started_at, ea.completed_at, ea.assigned_at,
              e.title, e.description, e.time_limit_minutes,
              u.display_name as teacher_name,
              (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count,
              (SELECT SUM(points) FROM exam_questions WHERE exam_id = e.id) as max_score
       FROM exam_assignments ea
       JOIN exams e ON ea.exam_id = e.id
       JOIN users u ON e.teacher_id = u.id
       WHERE ea.student_id = $1
       ORDER BY ea.assigned_at DESC`,
      [req.userId]
    );
  } else if (req.userRole === 'teacher') {
    result = await pool.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count,
              (SELECT COUNT(*) FROM exam_assignments WHERE exam_id = e.id) as assigned_count,
              (SELECT COUNT(*) FROM exam_assignments WHERE exam_id = e.id AND status = 'completed') as completed_count
       FROM exams e
       WHERE e.teacher_id = $1
       ORDER BY e.created_at DESC`,
      [req.userId]
    );
  } else {
    result = await pool.query(
      `SELECT e.*, u.display_name as teacher_name,
              (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
       FROM exams e
       JOIN users u ON e.teacher_id = u.id
       ORDER BY e.created_at DESC`
    );
  }
  res.json({ exams: result.rows });
}));

// POST /exams/:id/assign — teacher assigns exam to student
router.post('/:id/assign', requireAuth, requireRole('teacher', 'admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { student_id } = req.body;
  const result = await pool.query(
    `INSERT INTO exam_assignments (exam_id, student_id)
     VALUES ($1, $2)
     ON CONFLICT (exam_id, student_id) DO NOTHING
     RETURNING *`,
    [req.params.id, student_id]
  );

  if (result.rows[0]) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       SELECT $1, 'exam_assigned', 'New Exam Assigned',
              e.title || ' has been assigned to you', '/student/exams'
       FROM exams e WHERE e.id = $2`,
      [student_id, req.params.id]
    );
    return res.status(201).json({ assignment: result.rows[0] });
  }

  // Conflict — already assigned. Return the real existing row instead of
  // a fake object with no exam data, and don't re-notify the student.
  const existing = await pool.query(
    `SELECT * FROM exam_assignments WHERE exam_id = $1 AND student_id = $2`,
    [req.params.id, student_id]
  );
  res.status(200).json({ assignment: { ...existing.rows[0], already_assigned: true } });
}));

// POST /exams/:id/start — student starts exam
router.post('/:id/start', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE exam_assignments
     SET status = 'in_progress', started_at = NOW()
     WHERE exam_id = $1 AND student_id = $2 AND status = 'assigned'
     RETURNING *`,
    [req.params.id, req.userId]
  );

  let assignment = result.rows[0];
  if (!assignment) {
    const existing = await pool.query(
      `SELECT * FROM exam_assignments WHERE exam_id = $1 AND student_id = $2`,
      [req.params.id, req.userId]
    );
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Assignment not found' });
    if (existing.rows[0].status === 'completed') return res.status(400).json({ error: 'Exam already completed' });
    // Already in progress (e.g. the student refreshed the page) — hand
    // back the existing assignment instead of an undefined one.
    assignment = existing.rows[0];
  }

  const questions = await pool.query(
    `SELECT id, question, options, points FROM exam_questions WHERE exam_id = $1 ORDER BY id`,
    [req.params.id]
  );
  res.json({ assignment, questions: questions.rows });
}));

// POST /exams/:id/submit — student submits answers, auto-grade
router.post('/:id/submit', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const { answers } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await submitExam(client, { examId: req.params.id, studentId: req.userId, answers });
    if (result.error) {
      await client.query('ROLLBACK');
      return res.status(result.status).json({ error: result.error });
    }
    await client.query('COMMIT');
    res.json({ score: result.score, max_score: result.max_score });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /exams/:id/results
router.get('/:id/results', requireAuth, asyncHandler(async (req, res) => {
  if (req.userRole === 'student') {
    const result = await pool.query(
      `SELECT eq.id as question_id, eq.question, eq.options, eq.correct_answer, eq.points,
              exa.answer, exa.is_correct,
              ea.score, ea.completed_at,
              (SELECT SUM(points) FROM exam_questions WHERE exam_id = $1) as max_score
       FROM exam_assignments ea
       JOIN exam_questions eq ON eq.exam_id = ea.exam_id
       LEFT JOIN exam_answers exa ON exa.assignment_id = ea.id AND exa.question_id = eq.id
       WHERE ea.exam_id = $1 AND ea.student_id = $2
       ORDER BY eq.id`,
      [req.params.id, req.userId]
    );
    res.json({ results: result.rows });
  } else {
    const result = await pool.query(
      `SELECT ea.id, ea.score, ea.completed_at, ea.assigned_at,
              u.display_name as student_name,
              (SELECT SUM(points) FROM exam_questions WHERE exam_id = $1) as max_score
       FROM exam_assignments ea
       JOIN users u ON ea.student_id = u.id
       WHERE ea.exam_id = $1 AND ea.status = 'completed'
       ORDER BY ea.completed_at DESC`,
      [req.params.id]
    );
    res.json({ results: result.rows });
  }
}));

module.exports = router;
