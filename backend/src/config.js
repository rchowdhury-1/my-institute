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

// ─── Auth rate limiting ──────────────────────────────────────────────────────
// LOGIN_RATE_LIMIT_MAX has headroom above the ~16 logins the CI Playwright
// suite (auth.spec.ts + reschedule-and-buffer.spec.ts) makes against the real
// admin account on PRODUCTION per run, daily + on every push — set this too
// low and CI locks out the real admin, not just itself. Sized for ~3
// back-to-back CI runs (e.g. a few quick pushes) inside one window.
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * MS_PER_MINUTE;
const LOGIN_RATE_LIMIT_MAX = 50;
const REGISTER_RATE_LIMIT_MAX = 10;

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
  AUTH_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  REGISTER_RATE_LIMIT_MAX,
};
