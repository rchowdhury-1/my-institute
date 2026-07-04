const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../lib/notify');
const { formatSessionTime } = require('../lib/datetime');
const {
  generateForScheduleId,
  generateAllSchedules,
  wipeAndRegenerate,
  wipeFutureSessions,
} = require('../lib/schedule-generator');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'supervisor'));

const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function validateSlots(slots) {
  if (!Array.isArray(slots)) return 'slots must be an array';
  for (const slot of slots) {
    if (!slot.day || !VALID_DAYS.includes(slot.day))
      return `Invalid day: ${slot.day}. Must be one of ${VALID_DAYS.join(', ')}`;
    if (!slot.time || !/^\d{2}:\d{2}$/.test(slot.time))
      return `Invalid time for ${slot.day}: ${slot.time}. Must be HH:MM`;
    if (slot.duration != null) {
      const d = parseInt(slot.duration);
      if (isNaN(d) || d < 30 || d % 30 !== 0)
        return `Invalid duration for ${slot.day}: ${slot.duration}. Must be 30/60/90/120`;
    }
  }
  if (slots.length === 0) return 'At least one slot is required';
  return null;
}

// Hours balance: required on create, steps of 0.5, minimum 0.5.
function validateHours(value) {
  const hours = parseFloat(value);
  if (value == null || isNaN(hours)) return 'lessons_remaining (hours) is required';
  if (hours < 0.5 || hours > 1000 || !Number.isInteger(hours * 2))
    return 'Hours must be in steps of 0.5 (minimum 0.5)';
  return null;
}

// GET /admin/weekly-schedules
router.get('/', async (req, res) => {
  try {
    // On-demand generation — idempotent, fills gaps
    try {
      await generateAllSchedules();
    } catch (genErr) {
      console.error('[ON-DEMAND] Generation failed (non-blocking):', genErr.message);
    }

    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.query.student_id) {
      conditions.push(`ws.student_id = $${idx++}`);
      params.push(req.query.student_id);
    }
    if (req.query.teacher_id) {
      conditions.push(`ws.teacher_id = $${idx++}`);
      params.push(req.query.teacher_id);
    }
    if (req.query.active_only === 'true') {
      conditions.push('ws.is_active = true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ws.*,
              s.display_name AS student_name,
              t.display_name AS teacher_name
       FROM weekly_schedules ws
       JOIN users s ON s.id = ws.student_id
       JOIN users t ON t.id = ws.teacher_id
       ${where}
       ORDER BY ws.is_active DESC, ws.updated_at DESC`,
      params
    );

    res.json({ schedules: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/weekly-schedules/:id
router.get('/:id', async (req, res) => {
  try {
    // On-demand generation for this specific schedule
    try {
      await generateForScheduleId(req.params.id);
    } catch (genErr) {
      console.error('[ON-DEMAND] Generation failed (non-blocking):', genErr.message);
    }

    const result = await pool.query(
      `SELECT ws.*,
              s.display_name AS student_name,
              t.display_name AS teacher_name
       FROM weekly_schedules ws
       JOIN users s ON s.id = ws.student_id
       JOIN users t ON t.id = ws.teacher_id
       WHERE ws.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Schedule not found' });

    const schedule = result.rows[0];

    // Upcoming sessions linked to this schedule
    const sessions = await pool.query(
      `SELECT s.*, u.display_name AS student_name
       FROM sessions s
       JOIN users u ON u.id = s.student_id
       WHERE s.schedule_id = $1
         AND s.scheduled_at + (s.duration_minutes * interval '1 minute') > NOW() - interval '3 hours'
         AND s.status = 'scheduled'
       ORDER BY s.scheduled_at ASC`,
      [req.params.id]
    );

    res.json({ schedule, upcoming_sessions: sessions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/weekly-schedules
router.post('/', async (req, res) => {
  const { student_id, teacher_id, subject, default_duration, slots, lessons_remaining, zoom_link } = req.body;

  if (!student_id || !teacher_id)
    return res.status(400).json({ error: 'student_id and teacher_id are required' });

  const slotError = validateSlots(slots);
  if (slotError) return res.status(400).json({ error: slotError });

  const hoursError = validateHours(lessons_remaining);
  if (hoursError) return res.status(400).json({ error: hoursError });

  const dur = parseInt(default_duration) || 60;
  if (dur % 30 !== 0 || dur < 30)
    return res.status(400).json({ error: 'default_duration must be 30, 60, 90, or 120 minutes' });

  // Validate zoom_link if provided
  if (zoom_link && typeof zoom_link === 'string' && zoom_link.trim() && !zoom_link.startsWith('http')) {
    return res.status(400).json({ error: 'zoom_link must be a valid URL starting with http' });
  }

  try {
    // Validate student exists
    const studentCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'student'", [student_id]
    );
    if (studentCheck.rows.length === 0)
      return res.status(400).json({ error: 'Student not found' });

    // Validate teacher exists and is active
    const teacherCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'teacher' AND is_active = true", [teacher_id]
    );
    if (teacherCheck.rows.length === 0)
      return res.status(400).json({ error: 'Teacher not found or inactive' });

    const cleanZoomLink = zoom_link && zoom_link.trim() ? zoom_link.trim() : null;

    const result = await pool.query(
      `INSERT INTO weekly_schedules
         (student_id, teacher_id, subject, default_duration, slots, lessons_remaining, zoom_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [student_id, teacher_id, subject || 'quran', dur, JSON.stringify(slots),
       parseFloat(lessons_remaining),
       cleanZoomLink]
    );

    const schedule = result.rows[0];

    // Generate sessions immediately
    const generation = await generateForScheduleId(schedule.id);

    // Notify student and teacher
    const studentName = (await pool.query('SELECT display_name FROM users WHERE id=$1', [student_id])).rows[0]?.display_name;
    const teacherName = (await pool.query('SELECT display_name FROM users WHERE id=$1', [teacher_id])).rows[0]?.display_name;
    const slotSummary = slots.map(s => `${s.day.charAt(0).toUpperCase() + s.day.slice(1)} ${s.time}`).join(', ');

    await notify(student_id, 'schedule_created', 'Weekly Schedule Created',
      `A recurring schedule has been set up with ${teacherName}: ${slotSummary}`,
      '/student/sessions');
    await notify(teacher_id, 'schedule_created', 'Weekly Schedule Created',
      `A recurring schedule has been set up with ${studentName}: ${slotSummary}`,
      '/teacher/dashboard');

    if (generation.created > 0) {
      await notify(teacher_id, 'sessions_generated', 'Sessions Generated',
        `${generation.created} sessions generated for the next 4 weeks`,
        '/teacher/dashboard');
    }

    res.status(201).json({ schedule, generation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /admin/weekly-schedules/:id
router.patch('/:id', async (req, res) => {
  const { subject, default_duration, slots, lessons_remaining, teacher_id, zoom_link } = req.body;
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM weekly_schedules WHERE id = $1', [id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Schedule not found' });

    const schedule = existing.rows[0];

    if (slots) {
      const slotError = validateSlots(slots);
      if (slotError) return res.status(400).json({ error: slotError });
    }

    if (default_duration != null) {
      const dur = parseInt(default_duration);
      if (isNaN(dur) || dur < 30 || dur % 30 !== 0)
        return res.status(400).json({ error: 'default_duration must be 30, 60, 90, or 120 minutes' });
    }

    if (teacher_id) {
      const teacherCheck = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'teacher' AND is_active = true",
        [teacher_id]
      );
      if (teacherCheck.rows.length === 0)
        return res.status(400).json({ error: 'Teacher not found or inactive' });
    }

    // Build SET clause
    const sets = ['updated_at = NOW()'];
    const params = [];
    let idx = 1;

    if (subject !== undefined) { sets.push(`subject = $${idx++}`); params.push(subject); }
    if (default_duration !== undefined) { sets.push(`default_duration = $${idx++}`); params.push(parseInt(default_duration)); }
    if (slots !== undefined) { sets.push(`slots = $${idx++}`); params.push(JSON.stringify(slots)); }
    if (lessons_remaining !== undefined) {
      // A schedule can no longer be moved back to unlimited (null)
      const hoursError = validateHours(lessons_remaining);
      if (hoursError) return res.status(400).json({ error: hoursError });
      sets.push(`lessons_remaining = $${idx++}`);
      params.push(parseFloat(lessons_remaining));
    }
    if (teacher_id !== undefined) { sets.push(`teacher_id = $${idx++}`); params.push(teacher_id); }
    if (zoom_link !== undefined) {
      sets.push(`zoom_link = $${idx++}`);
      params.push(zoom_link && zoom_link.trim() ? zoom_link.trim() : null);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE weekly_schedules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    const updated = result.rows[0];

    // If slots, teacher, or zoom_link changed, wipe and regenerate
    let generation = null;
    const slotsChanged = slots !== undefined && JSON.stringify(slots) !== JSON.stringify(schedule.slots);
    const teacherChanged = teacher_id !== undefined && teacher_id !== schedule.teacher_id;
    const zoomChanged = zoom_link !== undefined && (zoom_link || null) !== (schedule.zoom_link || null);

    if (slotsChanged || teacherChanged || zoomChanged) {
      generation = await wipeAndRegenerate(id);
    }

    // Notify affected users
    const effectiveTeacher = teacher_id || schedule.teacher_id;
    const studentName = (await pool.query('SELECT display_name FROM users WHERE id=$1', [schedule.student_id])).rows[0]?.display_name;

    await notify(schedule.student_id, 'schedule_updated', 'Schedule Updated',
      'Your weekly schedule has been updated', '/student/sessions');
    await notify(effectiveTeacher, 'schedule_updated', 'Schedule Updated',
      `Weekly schedule with ${studentName} has been updated`, '/teacher/dashboard');

    // If teacher changed, also notify old teacher
    if (teacherChanged) {
      await notify(schedule.teacher_id, 'schedule_updated', 'Schedule Update',
        `You have been removed from a recurring schedule with ${studentName}`,
        '/teacher/dashboard');
    }

    res.json({ schedule: updated, generation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /admin/weekly-schedules/:id — soft delete (deactivate)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      `SELECT ws.*, s.display_name AS student_name, t.display_name AS teacher_name
       FROM weekly_schedules ws
       JOIN users s ON s.id = ws.student_id
       JOIN users t ON t.id = ws.teacher_id
       WHERE ws.id = $1`,
      [id]
    );
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Schedule not found' });

    const schedule = existing.rows[0];

    // Soft delete
    await pool.query(
      'UPDATE weekly_schedules SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Wipe future scheduled sessions
    const sessionsRemoved = await wipeFutureSessions(id);

    // Notify
    await notify(schedule.student_id, 'schedule_deactivated', 'Schedule Deactivated',
      `Your recurring schedule with ${schedule.teacher_name} has been paused`,
      '/student/sessions');
    await notify(schedule.teacher_id, 'schedule_deactivated', 'Schedule Deactivated',
      `Recurring schedule with ${schedule.student_name} has been paused`,
      '/teacher/dashboard');

    res.json({ message: 'Schedule deactivated', sessions_removed: sessionsRemoved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/weekly-schedules/:id/reactivate
router.post('/:id/reactivate', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM weekly_schedules WHERE id = $1', [id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Schedule not found' });

    if (existing.rows[0].is_active)
      return res.status(400).json({ error: 'Schedule is already active' });

    await pool.query(
      'UPDATE weekly_schedules SET is_active = true, updated_at = NOW() WHERE id = $1',
      [id]
    );

    const generation = await generateForScheduleId(id);

    const schedule = existing.rows[0];
    const studentName = (await pool.query('SELECT display_name FROM users WHERE id=$1', [schedule.student_id])).rows[0]?.display_name;

    await notify(schedule.student_id, 'schedule_reactivated', 'Schedule Reactivated',
      'Your weekly schedule has been reactivated', '/student/sessions');
    await notify(schedule.teacher_id, 'schedule_reactivated', 'Schedule Reactivated',
      `Recurring schedule with ${studentName} has been reactivated`,
      '/teacher/dashboard');

    res.json({ schedule: { ...schedule, is_active: true }, generation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /admin/weekly-schedules/:id/generate — manual trigger
router.post('/:id/generate', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT * FROM weekly_schedules WHERE id = $1', [id]);
    if (existing.rows.length === 0)
      return res.status(404).json({ error: 'Schedule not found' });
    if (!existing.rows[0].is_active)
      return res.status(400).json({ error: 'Cannot generate for inactive schedule' });

    const generation = await generateForScheduleId(id);
    res.json({ generation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
