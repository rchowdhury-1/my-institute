// Owns the exam-submission transaction: lookup the assignment, grade every
// answer against the question bank, persist per-answer rows, and mark the
// assignment completed — all inside the caller's transaction (the route
// owns BEGIN/COMMIT/ROLLBACK/client.release, matching the pattern used by
// reschedule.js / attendance.js where the service takes a client/pool and
// returns a plain result object rather than managing the transaction
// itself).
//
// Returns { status, error } on failure (assignment not found / already
// submitted), or { score, max_score } on success.
async function submitExam(client, { examId, studentId, answers }) {
  const assignRes = await client.query(
    `SELECT * FROM exam_assignments WHERE exam_id = $1 AND student_id = $2`,
    [examId, studentId]
  );
  if (assignRes.rowCount === 0) return { status: 404, error: 'Assignment not found' };
  const assignment = assignRes.rows[0];
  if (assignment.status === 'completed') return { status: 400, error: 'Already submitted' };

  const questionsRes = await client.query(
    `SELECT id, correct_answer, points FROM exam_questions WHERE exam_id = $1`,
    [examId]
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

  return { score: totalScore, max_score: maxScore };
}

module.exports = { submitExam };
