/**
 * Cross-tier source of truth for timezone + threshold constants that both
 * the frontend and backend need to agree on. The backend consumes these via
 * a generated file (backend/src/lib/shared.generated.js) — run
 * `node scripts/sync-shared.js` after editing this file, or the drift check
 * (`node scripts/sync-shared.js --check`) will fail CI.
 *
 * Do not change any value here without checking every consumer on both
 * tiers — see the smell-fix roadmap's H8/H17 register and change log 8.x
 * (the July timezone incident this unification exists to prevent a repeat
 * of). This batch moves code; it does not change a single value.
 */

export const LONDON_TZ = "Europe/London";
export const CAIRO_TZ = "Africa/Cairo";

/**
 * The single timezone admin-entered wall-clock times are anchored to
 * (schedule slots, one-off session create/edit). If this value changes, all
 * active schedules must be wiped and regenerated (POST /cron/regenerate-all).
 */
export const OPERATIONAL_TZ = CAIRO_TZ;

export const JOIN_WINDOW_HOURS = 3;
export const EARLY_JOIN_MINUTES = 15;
export const UPCOMING_BUFFER_HOURS = 3;
export const CANCELLATION_BUFFER_HOURS = 12;
export const RENEWAL_REMINDER_HOURS = 2;

export const ATTENDANCE_EARLY_MS = EARLY_JOIN_MINUTES * 60 * 1000;
export const ATTENDANCE_LATE_MS = 24 * 60 * 60 * 1000;
