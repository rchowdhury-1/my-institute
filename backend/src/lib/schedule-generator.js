/**
 * Session generation engine for weekly schedules.
 *
 * Slot times are stored as London time (Europe/London).
 * The generator converts to UTC before inserting sessions.
 * DST transitions are handled by date-fns-tz automatically.
 */
const { pool } = require('../db');
const { fromZonedTime } = require('date-fns-tz');
const { addDays, startOfDay, format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

const LONDON = 'Europe/London';
const HORIZON_DAYS = 28; // 4-week rolling window
const VALID_SUBJECTS = ['quran', 'arabic', 'islamic_studies'];

const DAY_MAP = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Get all dates matching a day-of-week between fromDate and toDate (inclusive).
 */
function getMatchingDates(dayStr, fromDate, toDate) {
  const targetDay = DAY_MAP[dayStr];
  if (targetDay === undefined) return [];

  const dates = [];
  let current = startOfDay(fromDate);
  // Advance to first matching day
  while (current.getDay() !== targetDay) {
    current = addDays(current, 1);
  }
  while (current <= toDate) {
    dates.push(new Date(current));
    current = addDays(current, 7);
  }
  return dates;
}

/**
 * Convert a London-time HH:MM on a specific date to a UTC Date object.
 */
function londonToUTC(date, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Build a date string in London time
  const dateStr = format(date, 'yyyy-MM-dd');
  const londonDateTime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  // fromZonedTime converts a "wall clock" time in a zone to UTC
  return fromZonedTime(londonDateTime, LONDON);
}

/**
 * Generate sessions for a single schedule. Idempotent — safe to call multiple times.
 *
 * @param {Object} schedule - Full schedule row (with student rate info)
 * @param {string} schedule.id
 * @param {string} schedule.student_id
 * @param {string} schedule.teacher_id
 * @param {string} schedule.subject
 * @param {number} schedule.default_duration
 * @param {Array} schedule.slots - [{day, time, duration?}]
 * @param {number|null} schedule.hourly_rate - student's rate (from join)
 * @param {string|null} schedule.currency - student's currency (from join)
 * @returns {{ created: number, skipped: number, conflicts: string[] }}
 */
async function generateSessionsForSchedule(schedule) {
  if (!schedule.is_active) return { created: 0, skipped: 0, conflicts: [] };

  const now = new Date();
  const today = startOfDay(now);
  const horizon = addDays(today, HORIZON_DAYS);

  let created = 0;
  let skipped = 0;
  const conflicts = [];

  const slots = Array.isArray(schedule.slots) ? schedule.slots : [];

  for (const slot of slots) {
    const duration = slot.duration || schedule.default_duration;
    const dates = getMatchingDates(slot.day, today, horizon);

    for (const targetDate of dates) {
      const sessionTimeUTC = londonToUTC(targetDate, slot.time);

      // Skip if in the past
      if (sessionTimeUTC <= now) {
        skipped++;
        continue;
      }

      // Idempotency check: any session (any status except nothing excluded) at this
      // schedule + London date + London time already exists?
      const existing = await pool.query(
        `SELECT id FROM sessions
         WHERE schedule_id = $1
           AND DATE(scheduled_at AT TIME ZONE 'Europe/London') = $2
           AND TO_CHAR(scheduled_at AT TIME ZONE 'Europe/London', 'HH24:MI') = $3`,
        [schedule.id, format(targetDate, 'yyyy-MM-dd'), slot.time]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Teacher conflict check (overlap with any scheduled session)
      const conflict = await pool.query(
        `SELECT id FROM sessions
         WHERE teacher_id = $1
           AND status = 'scheduled'
           AND tstzrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute')
            && tstzrange($2::timestamptz, $2::timestamptz + $3 * interval '1 minute')`,
        [schedule.teacher_id, sessionTimeUTC.toISOString(), duration]
      );

      if (conflict.rows.length > 0) {
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        conflicts.push(`Teacher conflict on ${dateStr} at ${slot.time}`);
        skipped++;
        continue;
      }

      // Create session (map subject to valid enum for sessions table constraint)
      const sessionSubject = VALID_SUBJECTS.includes(schedule.subject) ? schedule.subject : 'quran';
      const id = uuidv4();
      await pool.query(
        `INSERT INTO sessions
           (id, student_id, teacher_id, scheduled_at, duration_minutes,
            subject, schedule_id, rate_at_creation, currency_at_creation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          schedule.student_id,
          schedule.teacher_id,
          sessionTimeUTC.toISOString(),
          duration,
          sessionSubject,
          schedule.id,
          schedule.hourly_rate || null,
          schedule.currency || null,
        ]
      );

      created++;
    }
  }

  return { created, skipped, conflicts };
}

/**
 * Load a schedule with student rate info and generate sessions.
 */
async function generateForScheduleId(scheduleId) {
  const result = await pool.query(
    `SELECT ws.*,
            u.hourly_rate, u.currency
     FROM weekly_schedules ws
     JOIN users u ON u.id = ws.student_id
     WHERE ws.id = $1`,
    [scheduleId]
  );
  if (result.rows.length === 0) {
    return { error: 'Schedule not found', created: 0, skipped: 0, conflicts: [] };
  }
  return generateSessionsForSchedule(result.rows[0]);
}

/**
 * Generate sessions for ALL active schedules. Used by cron.
 */
async function generateAllSchedules() {
  const result = await pool.query(
    `SELECT ws.*,
            u.hourly_rate, u.currency
     FROM weekly_schedules ws
     JOIN users u ON u.id = ws.student_id
     WHERE ws.is_active = true`
  );

  let totalCreated = 0;
  let totalSkipped = 0;
  const allErrors = [];

  for (const schedule of result.rows) {
    try {
      const gen = await generateSessionsForSchedule(schedule);
      totalCreated += gen.created;
      totalSkipped += gen.skipped;
      if (gen.conflicts.length > 0) {
        allErrors.push(...gen.conflicts.map(c => `[${schedule.id}] ${c}`));
      }
    } catch (err) {
      allErrors.push(`[${schedule.id}] Error: ${err.message}`);
    }
  }

  return {
    schedules_processed: result.rows.length,
    total_created: totalCreated,
    total_skipped: totalSkipped,
    errors: allErrors,
  };
}

/**
 * Delete future 'scheduled' sessions for a schedule, then regenerate.
 */
async function wipeAndRegenerate(scheduleId) {
  const deleted = await wipeFutureSessions(scheduleId);
  const generation = await generateForScheduleId(scheduleId);
  return { sessions_removed: deleted, ...generation };
}

/**
 * Delete future 'scheduled' sessions for a schedule. No regeneration.
 */
async function wipeFutureSessions(scheduleId) {
  const result = await pool.query(
    `DELETE FROM sessions
     WHERE schedule_id = $1
       AND status = 'scheduled'
       AND scheduled_at > NOW()`,
    [scheduleId]
  );
  return result.rowCount;
}

module.exports = {
  generateSessionsForSchedule,
  generateForScheduleId,
  generateAllSchedules,
  wipeAndRegenerate,
  wipeFutureSessions,
  // Exported for testing
  getMatchingDates,
  londonToUTC,
};
