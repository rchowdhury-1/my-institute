/**
 * Session generation engine for weekly schedules.
 *
 * Slot times are wall-clock times in OPERATIONAL_TZ — the single timezone
 * the admin thinks in when entering schedule times. The generator converts
 * to UTC before inserting sessions. DST transitions are handled by
 * date-fns-tz automatically.
 *
 * OPERATIONAL_TZ is the cross-tier shared value (lib/shared/constants.ts is
 * the source of truth; see scripts/sync-shared.js). Changing it changes the
 * meaning of every stored slot time — all active schedules must be wiped and
 * regenerated afterwards (POST /cron/regenerate-all), otherwise on-demand
 * generation creates duplicate sessions at the shifted instants.
 */
const { pool } = require('../db');
const { fromZonedTime, toZonedTime } = require('date-fns-tz');
const { addDays, subDays, startOfDay, format } = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const { HORIZON_DAYS } = require('../config');
const { OPERATIONAL_TZ } = require('./shared.generated');
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
 * Convert an OPERATIONAL_TZ wall-clock HH:MM on a specific date to a UTC Date.
 */
function slotToUTC(date, timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateStr = format(date, 'yyyy-MM-dd');
  // Pass the string straight to fromZonedTime — a Date intermediate would be
  // parsed in the server's own zone before reinterpretation
  return fromZonedTime(
    `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
    OPERATIONAL_TZ
  );
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

  let skipped = 0;
  const conflicts = [];

  const slots = Array.isArray(schedule.slots) ? schedule.slots : [];

  // 1. Compute every candidate instant up front (same slot-then-date order as
  // the original nested loop, so tie-breaking between two candidates that
  // conflict with each other is unchanged).
  const candidates = [];
  for (const slot of slots) {
    const duration = slot.duration || schedule.default_duration;
    const dates = getMatchingDates(slot.day, today, horizon);

    for (const targetDate of dates) {
      const sessionTimeUTC = slotToUTC(targetDate, slot.time);

      // Skip if in the past
      if (sessionTimeUTC <= now) {
        skipped++;
        continue;
      }

      candidates.push({ slot, duration, targetDate, sessionTimeUTC });
    }
  }

  if (candidates.length === 0) {
    return { created: 0, skipped, conflicts };
  }

  // 2. One query for idempotency: every existing session for this schedule
  // (any status — decision 3.9/8.1, no exclusion), bounded to a window that
  // can't miss a match (any session outside [today, horizon] can never share
  // a candidate's operational-zone date, so this bound is exact, not
  // approximate). Match key mirrors the original per-candidate SQL:
  // DATE(scheduled_at AT TIME ZONE OPERATIONAL_TZ) + TO_CHAR(..., 'HH24:MI').
  const existingRes = await pool.query(
    `SELECT scheduled_at FROM sessions
     WHERE schedule_id = $1 AND scheduled_at >= $2 AND scheduled_at <= $3`,
    [schedule.id, subDays(today, 1).toISOString(), addDays(horizon, 1).toISOString()]
  );
  const existingKeys = new Set(
    existingRes.rows.map((r) => {
      const zoned = toZonedTime(r.scheduled_at, OPERATIONAL_TZ);
      return `${format(zoned, 'yyyy-MM-dd')} ${format(zoned, 'HH:mm')}`;
    })
  );

  // 3. One query for teacher conflicts: every 'scheduled' session for this
  // teacher, unbounded by date (matches the original — it never restricted
  // by date either, only by teacher_id + status).
  const conflictRes = await pool.query(
    `SELECT scheduled_at, duration_minutes FROM sessions
     WHERE teacher_id = $1 AND status = 'scheduled'`,
    [schedule.teacher_id]
  );
  const existingIntervals = conflictRes.rows.map((r) => {
    const start = new Date(r.scheduled_at).getTime();
    return { start, end: start + r.duration_minutes * 60_000 };
  });

  // 4. Decide create/skip per candidate in order, checking each against both
  // pre-existing DB conflicts and conflicts newly created earlier in this
  // same pass — the original caught the latter because it inserted before
  // moving to the next candidate, so a later candidate's conflict query saw
  // the earlier candidate's row already committed.
  const newIntervals = [];
  const toInsert = [];
  let created = 0;

  const overlaps = (a, b) => a.start < b.end && b.start < a.end;

  for (const { slot, duration, targetDate, sessionTimeUTC } of candidates) {
    const key = `${format(targetDate, 'yyyy-MM-dd')} ${slot.time}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const interval = { start: sessionTimeUTC.getTime(), end: sessionTimeUTC.getTime() + duration * 60_000 };
    const hasConflict =
      existingIntervals.some((iv) => overlaps(interval, iv)) ||
      newIntervals.some((iv) => overlaps(interval, iv));

    if (hasConflict) {
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      conflicts.push(`Teacher conflict on ${dateStr} at ${slot.time}`);
      skipped++;
      continue;
    }

    // Map subject to valid enum for sessions table constraint
    if (!VALID_SUBJECTS.includes(schedule.subject)) {
      console.warn(`[generation] schedule ${schedule.id} has invalid subject "${schedule.subject}" — defaulting to "quran"`);
    }
    const sessionSubject = VALID_SUBJECTS.includes(schedule.subject) ? schedule.subject : 'quran';

    newIntervals.push(interval);
    toInsert.push({
      id: uuidv4(),
      scheduledAt: sessionTimeUTC.toISOString(),
      duration,
      subject: sessionSubject,
    });
    created++;
  }

  // 5. Bulk-insert the survivors in one query.
  if (toInsert.length > 0) {
    const valueRows = [];
    const params = [];
    let i = 1;
    for (const s of toInsert) {
      valueRows.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(
        s.id,
        schedule.student_id,
        schedule.teacher_id,
        s.scheduledAt,
        s.duration,
        s.subject,
        schedule.id,
        schedule.hourly_rate || null,
        schedule.currency || null,
        schedule.zoom_link || null
      );
    }
    await pool.query(
      `INSERT INTO sessions
         (id, student_id, teacher_id, scheduled_at, duration_minutes,
          subject, schedule_id, rate_at_creation, currency_at_creation, zoom_link)
       VALUES ${valueRows.join(', ')}`,
      params
    );
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
      console.error(`[generation] schedule ${schedule.id} failed:`, err);
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
  OPERATIONAL_TZ,
  // Exported for testing
  getMatchingDates,
  slotToUTC,
};
