const express = require('express');
const { pool } = require('../../db');
const { v4: uuidv4 } = require('uuid');
const { notify } = require('../../lib/notify');
const { formatSessionTime } = require('../../lib/datetime');
const { asyncHandler } = require('../../middleware/errors');
const { validateDuration } = require('../../lib/validators');
const { assertTeacherExists, hasTeacherConflict } = require('../../lib/queries');

const router = express.Router();

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
// Vocabulary debt: this route path and its `lesson` response key predate the
// `sessions` table/entity naming used everywhere else. Left as-is — the
// frontend depends on this exact path and key — renaming is tracked as
// deferred debt (smell roadmap L1), not fixed here.
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

// ─── PATCH /admin/sessions/:id — edit a session ────────────────────────────

// Checks duration/teacher/date validity and teacher-conflict for a session
// edit. Returns { status, error, code? } on failure, null when the edit may
// proceed.
async function validateSessionEdit(body, session, sessionId) {
  const { scheduled_at, duration_minutes, teacher_id } = body;

  if (duration_minutes != null) {
    const durationError = validateDuration(parseInt(duration_minutes));
    if (durationError) return { status: 400, error: durationError };
  }

  if (teacher_id) {
    const teacher = await assertTeacherExists(pool, teacher_id, { requireActive: true });
    if (!teacher) return { status: 400, error: 'Teacher not found or inactive' };
  }

  if (scheduled_at) {
    if (isNaN(new Date(scheduled_at).getTime()))
      return { status: 400, error: 'Invalid date' };
    if (new Date(scheduled_at) <= new Date())
      return { status: 400, error: 'Scheduled time must be in the future' };
  }

  if (scheduled_at || teacher_id) {
    const effectiveTeacher = teacher_id || session.teacher_id;
    const effectiveTime = scheduled_at ? new Date(scheduled_at).toISOString() : session.scheduled_at;
    const effectiveDuration = duration_minutes != null ? parseInt(duration_minutes) : session.duration_minutes;
    const conflict = await hasTeacherConflict(pool, {
      teacherId: effectiveTeacher,
      scheduledAt: effectiveTime,
      durationMinutes: effectiveDuration,
      excludeSessionId: sessionId,
    });
    if (conflict)
      return {
        status: 409,
        error: 'The chosen teacher already has a session overlapping this time. Please pick a different time or teacher.',
        code: 'TEACHER_CONFLICT',
      };
  }

  return null;
}

// Builds the dynamic UPDATE SET clause + params for a session edit.
function buildSessionUpdate(body, userId) {
  const { scheduled_at, duration_minutes, subject, teacher_id, zoom_link, notes } = body;
  const setClauses = ['last_modified_by = $1', 'updated_at = now()'];
  const params = [userId];
  let paramIdx = 2;

  if (scheduled_at !== undefined) {
    setClauses.push(`scheduled_at = $${paramIdx++}`);
    params.push(new Date(scheduled_at).toISOString());
  }
  if (duration_minutes !== undefined) {
    setClauses.push(`duration_minutes = $${paramIdx++}`);
    params.push(parseInt(duration_minutes));
  }
  if (subject !== undefined) {
    setClauses.push(`subject = $${paramIdx++}`);
    params.push(subject);
  }
  if (teacher_id !== undefined) {
    setClauses.push(`teacher_id = $${paramIdx++}`);
    params.push(teacher_id);
  }
  if (zoom_link !== undefined) {
    setClauses.push(`zoom_link = $${paramIdx++}`);
    params.push(zoom_link || null);
  }
  if (notes !== undefined) {
    setClauses.push(`notes = $${paramIdx++}`);
    params.push(notes || null);
  }

  return { setClauses, params, nextParamIdx: paramIdx };
}

// Diffs the request body against the existing session for the response's
// `changes` summary and to decide whether a notification is warranted.
// scheduled_at is always recorded once provided (front-end/back-end string
// formats aren't reliably comparable); other fields only when they actually
// differ from the stored value.
function diffChanges(body, session) {
  const { scheduled_at, duration_minutes, subject, teacher_id, zoom_link, notes } = body;
  const changes = {};

  if (scheduled_at !== undefined)
    changes.scheduled_at = { from: session.scheduled_at, to: scheduled_at };
  if (duration_minutes !== undefined && parseInt(duration_minutes) !== session.duration_minutes)
    changes.duration_minutes = { from: session.duration_minutes, to: parseInt(duration_minutes) };
  if (subject !== undefined && subject !== session.subject)
    changes.subject = { from: session.subject, to: subject };
  if (teacher_id !== undefined && teacher_id !== session.teacher_id)
    changes.teacher_id = { from: session.teacher_id, to: teacher_id };
  if (zoom_link !== undefined && (zoom_link || null) !== session.zoom_link)
    changes.zoom_link = true;
  if (notes !== undefined && (notes || null) !== session.notes)
    changes.notes = true;

  return changes;
}

// Sends the batched student/teacher notifications for a visible session
// change. Notes-only edits never reach here (see hasVisibleChange below).
async function notifySessionChange(session, changes) {
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

router.patch('/sessions/:id', asyncHandler(async (req, res) => {
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

  const validationError = await validateSessionEdit(req.body, session, id);
  if (validationError) {
    const { status, error, code } = validationError;
    return res.status(status).json(code ? { error, code } : { error });
  }

  const changes = diffChanges(req.body, session);
  const { setClauses, params, nextParamIdx } = buildSessionUpdate(req.body, req.userId);
  params.push(id);
  const result = await pool.query(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = $${nextParamIdx} RETURNING *`,
    params
  );
  const updated = result.rows[0];

  const hasVisibleChange = changes.scheduled_at || changes.duration_minutes ||
    changes.subject || changes.teacher_id || changes.zoom_link;
  if (hasVisibleChange) {
    await notifySessionChange(session, changes);
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
