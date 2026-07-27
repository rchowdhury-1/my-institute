/**
 * Centralised backend config constants. Values only — do not change any of
 * these without checking every consumer listed in the smell-fix roadmap's
 * H10a/M4/M7 register, since several are directly asserted on by CI.
 */

const { ATTENDANCE_EARLY_MS, ATTENDANCE_LATE_MS, RENEWAL_REMINDER_HOURS } = require('./lib/shared.generated');

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ─── Auth ────────────────────────────────────────────────────────────────────
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const REFRESH_TOKEN_TTL_JWT = `${REFRESH_TOKEN_TTL_DAYS}d`;
const REFRESH_TOKEN_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * MS_PER_DAY;
const MIN_PASSWORD_LENGTH = 8;

// ─── Sessions / attendance ───────────────────────────────────────────────────
// ATTENDANCE_EARLY_MS, ATTENDANCE_LATE_MS, RENEWAL_REMINDER_HOURS: cross-tier
// shared values — see lib/shared/constants.ts (source of truth) and
// scripts/sync-shared.js (regenerates ./lib/shared.generated.js).

// ─── Scheduling ──────────────────────────────────────────────────────────────
const HORIZON_DAYS = 28; // 4-week rolling window

// ─── Payments ────────────────────────────────────────────────────────────────
const SUPPORTED_CURRENCIES = ['GBP', 'EGP'];
const DEFAULT_RATE_PER_SESSION = 5.00;

// ─── Email guard ─────────────────────────────────────────────────────────────
const EMAIL_WINDOW_MS = 60_000;
const EMAIL_MAX_SENDS = 20;

module.exports = {
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TTL_JWT,
  REFRESH_TOKEN_MAX_AGE_MS,
  MIN_PASSWORD_LENGTH,
  ATTENDANCE_EARLY_MS,
  ATTENDANCE_LATE_MS,
  RENEWAL_REMINDER_HOURS,
  HORIZON_DAYS,
  SUPPORTED_CURRENCIES,
  DEFAULT_RATE_PER_SESSION,
  EMAIL_WINDOW_MS,
  EMAIL_MAX_SENDS,
};
