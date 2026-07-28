const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../lib/notify');
const { canStudentCancel } = require('../lib/cancellation');
const { formatSessionTime } = require('../lib/datetime');
const { v4: uuidv4 } = require('uuid');
const { generateAllSchedules, VALID_SUBJECTS } = require('../lib/schedule-generator');
const { asyncHandler } = require('../middleware/errors');
const { validateDuration } = require('../lib/validators');
const { safeGenerate } = require('../lib/queries');
const { markAttendance } = require('../services/attendance');

const router = express.Router();
router.use(requireAuth);

// GET /sessions
router.get('/', asyncHandler(async (req, res) => {
  // On-demand session generation — idempotent, fills any gaps in the 4-week window
  await safeGenerate(() => generateAllSchedules(), 'GET /sessions');

  let result;
  if (req.userRole === 'student') {
    result = await pool.query(
      `SELECT s.*, u.display_name AS teacher_name,
              ws.lessons_remaining AS schedule_lessons_remaining
       FROM sessions s
       JOIN users u ON u.id = s.teacher_id
       LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
       WHERE s.student_id = $1
       ORDER BY s.scheduled_at DESC`,
      [req.userId]
    );
  } else if (req.userRole === 'teacher') {
    result = await pool.query(
      `SELECT s.*, u.display_name AS student_name,
              ws.lessons_remaining AS schedule_lessons_remaining
       FROM sessions s
       JOIN users u ON u.id = s.student_id
       LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
       WHERE s.teacher_id = $1
       ORDER BY s.scheduled_at DESC`,
      [req.userId]
    );
  } else {
    // admin / supervisor
    result = await pool.query(
      `SELECT s.*,
              st.display_name AS student_name,
              t.display_name  AS teacher_name,
              ws.lessons_remaining AS schedule_lessons_remaining
       FROM sessions s
       JOIN users st ON st.id = s.student_id
       JOIN users t  ON t.id  = s.teacher_id
       LEFT JOIN weekly_schedules ws ON ws.id = s.schedule_id
       ORDER BY s.scheduled_at DESC`
    );
  }
  res.json({ sessions: result.rows, server_time: new Date().toISOString() });
}));

// POST /sessions  (admin / supervisor only)
router.post('/', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { student_id, teacher_id, scheduled_at, duration_minutes, subject, zoom_link } = req.body;
  if (!student_id || !teacher_id || !scheduled_at)
    return res.status(400).json({ error: 'student_id, teacher_id and scheduled_at are required' });

  const sessionSubject = VALID_SUBJECTS.includes(subject) ? subject : 'quran';

  const durationMinutes = parseInt(duration_minutes) || 60;
  const durationError = validateDuration(durationMinutes);
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
       (id, student_id, teacher_id, scheduled_at, duration_minutes, subject, zoom_link,
        rate_at_creation, currency_at_creation)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, student_id, teacher_id, scheduled_at, durationMinutes, sessionSubject, zoom_link || null, hourly_rate, currency]
  );
  const session = result.rows[0];
  const dateTime = formatSessionTime(scheduled_at);

  await notify(student_id, 'session_scheduled', 'Session Scheduled',
    `A session has been booked for ${dateTime}`, '/student/sessions');
  await notify(teacher_id, 'session_scheduled', 'Session Scheduled',
    `A session has been scheduled for ${dateTime}`, '/teacher/dashboard');

  res.status(201).json({ session });
}));

// PATCH /sessions/:id — update zoom link (admin / supervisor / teacher)
router.patch('/:id', requireRole('admin', 'supervisor', 'teacher'), asyncHandler(async (req, res) => {
  const { zoom_link } = req.body;
  const { id } = req.params;
  const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

  if (req.userRole === 'teacher' && existing.rows[0].teacher_id !== req.userId)
    return res.status(403).json({ error: 'Forbidden' });

  const result = await pool.query(
    `UPDATE sessions SET zoom_link = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [zoom_link || null, id]
  );
  res.json({ session: result.rows[0] });
}));

// DELETE /sessions/:id  (admin / supervisor only)
router.delete('/:id', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const session = existing.rows[0];
  // Atomic: nullify reschedule children then delete (prevents FK violation)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE sessions SET rescheduled_from = NULL WHERE rescheduled_from = $1', [id]);
    await client.query('DELETE FROM sessions WHERE id=$1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const dateTime = formatSessionTime(session.scheduled_at);
  await notify(session.student_id, 'session_cancelled', 'Session Removed',
    `Your session on ${dateTime} has been removed by admin`, '/student/sessions');
  await notify(session.teacher_id, 'session_cancelled', 'Session Removed',
    `A session on ${dateTime} has been removed`, '/teacher/dashboard');
  res.json({ message: 'Session deleted' });
}));

// PATCH /sessions/:id/cancel
router.patch('/:id/cancel', requireRole('student', 'teacher', 'admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { cancellation_reason } = req.body;
  const { id } = req.params;

  const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
  const session = existing.rows[0];

  if (req.userRole === 'student' && session.student_id !== req.userId)
    return res.status(403).json({ error: 'Forbidden' });
  if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
    return res.status(403).json({ error: 'Forbidden' });

  // 12-hour buffer for students only
  if (req.userRole === 'student') {
    const check = canStudentCancel(session);
    if (!check.allowed)
      return res.status(403).json({ error: check.reason, code: check.code });
  }

  const result = await pool.query(
    `UPDATE sessions SET status='cancelled', cancellation_reason=$1, updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [cancellation_reason || null, id]
  );

  const dateTime = formatSessionTime(session.scheduled_at);
  if (req.userRole === 'student') {
    await notify(session.teacher_id, 'session_cancelled', 'Session Cancelled',
      `Session on ${dateTime} was cancelled by the student`, '/teacher/dashboard');
  } else {
    await notify(session.student_id, 'session_cancelled', 'Session Cancelled',
      `Your session on ${dateTime} was cancelled`, '/student/sessions');
  }
  await notifyAdmins('session_cancelled', 'Session Cancelled',
    `Session on ${dateTime} was cancelled`, '/supervisor');

  res.json({ session: result.rows[0] });
}));

// PATCH /sessions/:id/reschedule  (admin / supervisor only — students use /reschedule-requests)
router.patch('/:id/reschedule', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { scheduled_at } = req.body;
  const { id } = req.params;
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required' });

  const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
  const session = existing.rows[0];

  await pool.query(
    `UPDATE sessions SET status='rescheduled', last_modified_by=$1, updated_at=NOW() WHERE id=$2`,
    [req.userId, id]
  );

  const newId = uuidv4();
  const result = await pool.query(
    `INSERT INTO sessions (id, student_id, teacher_id, scheduled_at, duration_minutes, subject, rescheduled_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [newId, session.student_id, session.teacher_id, scheduled_at,
     session.duration_minutes, session.subject || 'quran', id]
  );

  const newDt = formatSessionTime(scheduled_at);
  await notify(session.student_id, 'session_rescheduled', 'Session Rescheduled',
    `Your session has been rescheduled to ${newDt}`, '/student/sessions');
  await notify(session.teacher_id, 'session_rescheduled', 'Session Rescheduled',
    `A session has been rescheduled to ${newDt}`, '/teacher/dashboard');
  await notifyAdmins('session_rescheduled', 'Session Rescheduled',
    `Session rescheduled to ${newDt}`, '/supervisor');

  res.status(201).json({ session: result.rows[0] });
}));

// PATCH /sessions/:id/attendance  (teacher within time window, admin/supervisor any time)
router.patch('/:id/attendance', requireRole('student', 'teacher', 'admin', 'supervisor'), asyncHandler(async (req, res) => {
  // Students cannot mark attendance
  if (req.userRole === 'student')
    return res.status(403).json({ error: 'Students cannot mark attendance' });

  const { teacher_attended, student_attended } = req.body;
  const { id } = req.params;

  if (typeof teacher_attended !== 'boolean')
    return res.status(400).json({ error: 'teacher_attended (boolean) is required' });
  if (teacher_attended && typeof student_attended !== 'boolean')
    return res.status(400).json({ error: 'student_attended (boolean) is required when teacher attended' });

  const existing = await pool.query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (existing.rows.length === 0)
    return res.status(404).json({ error: 'Session not found' });

  const session = existing.rows[0];

  // Teacher can only mark their own sessions
  if (req.userRole === 'teacher' && session.teacher_id !== req.userId)
    return res.status(403).json({ error: 'Forbidden' });

  const result = await markAttendance(pool, {
    session,
    userId: req.userId,
    userRole: req.userRole,
    teacherAttended: teacher_attended,
    studentAttended: student_attended,
  });
  if (result.error) {
    const { status, error, code } = result;
    return res.status(status).json(code ? { error, code } : { error });
  }

  res.json({ session: result.session });
}));

module.exports = router;
