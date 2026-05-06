const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /exams — teacher creates exam with questions
router.post('/', requireAuth, requireRole('teacher', 'admin', 'supervisor'), async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: 'Failed to create exam' });
  } finally {
    client.release();
  }
});

// GET /exams — filtered by role
router.get('/', requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// POST /exams/:id/assign — teacher assigns exam to student
router.post('/:id/assign', requireAuth, requireRole('teacher', 'admin', 'supervisor'), async (req, res) => {
  const { student_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO exam_assignments (exam_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (exam_id, student_id) DO NOTHING
       RETURNING *`,
      [req.params.id, student_id]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       SELECT $1, 'exam_assigned', 'New Exam Assigned',
              e.title || ' has been assigned to you', '/student/exams'
       FROM exams e WHERE e.id = $2`,
      [student_id, req.params.id]
    );
    res.status(201).json({ assignment: result.rows[0] ?? { already_assigned: true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign exam' });
  }
});

// POST /exams/:id/start — student starts exam
router.post('/:id/start', requireAuth, requireRole('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE exam_assignments
       SET status = 'in_progress', started_at = NOW()
       WHERE exam_id = $1 AND student_id = $2 AND status = 'assigned'
       RETURNING *`,
      [req.params.id, req.userId]
    );
    if (result.rowCount === 0) {
      const existing = await pool.query(
        `SELECT * FROM exam_assignments WHERE exam_id = $1 AND student_id = $2`,
        [req.params.id, req.userId]
      );
      if (existing.rowCount === 0) return res.status(404).json({ error: 'Assignment not found' });
      if (existing.rows[0].status === 'completed') return res.status(400).json({ error: 'Exam already completed' });
    }
    const questions = await pool.query(
      `SELECT id, question, options, points FROM exam_questions WHERE exam_id = $1 ORDER BY id`,
      [req.params.id]
    );
    res.json({ assignment: result.rows[0], questions: questions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start exam' });
  }
});

// POST /exams/:id/submit — student submits answers, auto-grade
router.post('/:id/submit', requireAuth, requireRole('student'), async (req, res) => {
  const { answers } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assignRes = await client.query(
      `SELECT * FROM exam_assignments WHERE exam_id = $1 AND student_id = $2`,
      [req.params.id, req.userId]
    );
    if (assignRes.rowCount === 0) return res.status(404).json({ error: 'Assignment not found' });
    const assignment = assignRes.rows[0];
    if (assignment.status === 'completed') return res.status(400).json({ error: 'Already submitted' });

    const questionsRes = await client.query(
      `SELECT id, correct_answer, points FROM exam_questions WHERE exam_id = $1`,
      [req.params.id]
    );
    const questionMap = {};
    questionsRes.rows.forEach(q => { questionMap[q.id] = q; });

    let totalScore = 0;
    let maxScore = 0;
    for (const q of questionsRes.rows) maxScore += q.points;

    for (const ans of (answers || [])) {
      const q = questionMap[ans.question_id];
      if (!q) continue;
      const isCorrect = String(ans.answer).toUpperCase() === String(q.correct_answer).toUpperCase();
      if (isCorrect) totalScore += q.points;
      await client.query(
        `INSERT INTO exam_answers (assignment_id, question_id, answer, is_correct)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (assignment_id, question_id) DO UPDATE SET answer = EXCLUDED.answer, is_correct = EXCLUDED.is_correct`,
        [assignment.id, ans.question_id, ans.answer, isCorrect]
      );
    }

    await client.query(
      `UPDATE exam_assignments SET status = 'completed', score = $1, completed_at = NOW() WHERE id = $2`,
      [totalScore, assignment.id]
    );
    await client.query('COMMIT');
    res.json({ score: totalScore, max_score: maxScore });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to submit exam' });
  } finally {
    client.release();
  }
});

// GET /exams/:id/results
router.get('/:id/results', requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

module.exports = router;
