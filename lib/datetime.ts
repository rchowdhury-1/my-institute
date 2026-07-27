import { format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  LONDON_TZ,
  CAIRO_TZ,
  OPERATIONAL_TZ,
  JOIN_WINDOW_HOURS,
  EARLY_JOIN_MINUTES,
  UPCOMING_BUFFER_HOURS,
  CANCELLATION_BUFFER_HOURS,
  ATTENDANCE_EARLY_MS,
  ATTENDANCE_LATE_MS,
} from "./shared/constants";
import { toDate, dualTime, datePart, timeIn, formatSessionTime } from "./shared/datetime";

export const LONDON = LONDON_TZ;
export const CAIRO = CAIRO_TZ;

// Cross-tier source of truth: lib/shared/constants.ts (backend consumes a
// generated copy — see scripts/sync-shared.js). Re-exported here so every
// existing `@/lib/datetime` import site keeps working unchanged.
export {
  OPERATIONAL_TZ,
  JOIN_WINDOW_HOURS,
  EARLY_JOIN_MINUTES,
  UPCOMING_BUFFER_HOURS,
  CANCELLATION_BUFFER_HOURS,
  ATTENDANCE_EARLY_MS,
  ATTENDANCE_LATE_MS,
  timeIn,
  formatSessionTime,
};

/** Human label for OPERATIONAL_TZ, shown on time inputs. */
export const OPERATIONAL_TZ_LABEL = OPERATIONAL_TZ === CAIRO ? "Egypt time" : "UK time";
/** The "other" zone shown as a live hint next to time inputs. */
const HINT_TZ = OPERATIONAL_TZ === CAIRO ? LONDON : CAIRO;
const HINT_TZ_LABEL = OPERATIONAL_TZ === CAIRO ? "UK" : "Cairo";

/**
 * Date only: "Mon 22 Jun" (or "Mon 22 Jun 2027")
 */
export function formatSessionDate(
  date: Date | string | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return datePart(d);
}

/**
 * Time only with dual timezone: "14:00 BST · 16:00 Cairo"
 */
export function formatTimeOnly(
  date: Date | string | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return dualTime(d);
}

/**
 * Relative time: "in 2 hours", "yesterday", "3 days ago"
 */
export function formatRelative(
  date: Date | string | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  const now = Date.now();
  const diff = d.getTime() - now;
  const absDiff = Math.abs(diff);
  const future = diff > 0;

  const minutes = Math.round(absDiff / 60_000);
  const hours = Math.round(absDiff / 3_600_000);
  const days = Math.round(absDiff / 86_400_000);
  const weeks = Math.round(absDiff / 604_800_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`;
  if (hours < 24) return future ? `in ${hours} hours` : `${hours} hours ago`;
  if (days === 1) return future ? "tomorrow" : "yesterday";
  if (days < 7) return future ? `in ${days} days` : `${days} days ago`;
  if (weeks < 5) return future ? `in ${weeks} weeks` : `${weeks} weeks ago`;

  return formatSimpleDate(d);
}

/**
 * Simple date for non-session contexts: "22 Jun 2026"
 */
export function formatSimpleDate(
  date: Date | string | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return format(toZonedTime(d, LONDON), "d MMM yyyy");
}

/**
 * Device-clock skew against the server, in ms. Positive = device clock is
 * behind the server. Returns 0 for missing/invalid input so pages work
 * unchanged while the backend field rolls out.
 */
export function computeClockSkew(serverTimeIso?: string | null): number {
  if (!serverTimeIso) return 0;
  const serverMs = Date.parse(serverTimeIso);
  return isNaN(serverMs) ? 0 : serverMs - Date.now();
}

/**
 * The Join button is active from `earlyMinutes` before the session's start
 * (default 15, matching the backend attendance window) until
 * `joinWindowHours` after the start (default 3h).
 *
 * Pass `skewMs` (from computeClockSkew) so the check uses server time
 * rather than trusting the device clock.
 *
 * Distinct from isSessionStillUpcoming: that predicate anchors on the
 * session END (+3h) and controls list visibility; this one anchors on the
 * START and controls only whether the join link is live. A session can be
 * visible in "upcoming" while its join window is closed — that is intended.
 */
export function isSessionJoinable(
  scheduledAt: Date | string | null | undefined,
  joinWindowHours: number = JOIN_WINDOW_HOURS,
  opts: { earlyMinutes?: number; skewMs?: number } = {}
): boolean {
  const { earlyMinutes = EARLY_JOIN_MINUTES, skewMs = 0 } = opts;
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  const now = Date.now() + skewMs;
  return (
    now >= start - earlyMinutes * 60 * 1000 &&
    now <= start + joinWindowHours * 60 * 60 * 1000
  );
}

/** True while the session's join window has not opened yet (start − 15 min). */
export function isSessionBeforeStart(
  scheduledAt: Date | string | null | undefined,
  skewMs: number = 0,
  earlyMinutes: number = EARLY_JOIN_MINUTES
): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  return Date.now() + skewMs < start - earlyMinutes * 60 * 1000;
}

/**
 * Parse a datetime-local input value ("YYYY-MM-DDTHH:mm") as OPERATIONAL_TZ
 * wall-clock and return the UTC ISO instant. Deterministic — the admin's
 * device timezone plays no part.
 */
export function zonedInputToISO(value: string): string {
  return fromZonedTime(value, OPERATIONAL_TZ).toISOString();
}

/**
 * Format a UTC instant as an OPERATIONAL_TZ wall-clock datetime-local value
 * ("YYYY-MM-DDTHH:mm") for filling an input. Inverse of zonedInputToISO.
 */
export function isoToZonedInput(iso: Date | string): string {
  return format(toZonedTime(iso, OPERATIONAL_TZ), "yyyy-MM-dd'T'HH:mm");
}

/**
 * Live hint for a time entered in OPERATIONAL_TZ: the equivalent wall-clock
 * in the other audience's zone, e.g. "= 17:00 UK". `value` is either a
 * datetime-local string or a bare "HH:mm" (resolved against `onDate`,
 * default today) as used by schedule slot inputs.
 */
export function otherZoneHint(value: string, onDate?: string): string {
  if (!value) return "";
  const dateTime = value.includes("T")
    ? value
    : `${onDate ?? format(new Date(), "yyyy-MM-dd")}T${value}`;
  const instant = fromZonedTime(dateTime, OPERATIONAL_TZ);
  if (isNaN(instant.getTime())) return "";
  return `= ${format(toZonedTime(instant, HINT_TZ), "HH:mm")} ${HINT_TZ_LABEL}`;
}

/**
 * Format an hours balance for display: "2.5", "2", "0.5" (no trailing zeros).
 */
export function formatHours(hours: number): string {
  return String(Math.round(hours * 100) / 100);
}

/**
 * A session is "still upcoming" until 3 hours after its scheduled end.
 * Sessions stay visible so late students can still join.
 */
export function isSessionStillUpcoming(
  scheduledAt: Date | string | null | undefined,
  durationMinutes: number,
  bufferHours: number = UPCOMING_BUFFER_HOURS
): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  const sessionEnd = start + durationMinutes * 60 * 1000;
  const cutoff = Date.now() - bufferHours * 60 * 60 * 1000;
  return sessionEnd > cutoff;
}

/**
 * True if `iso` falls on the device's current local calendar date. Not
 * timezone-aware (compares raw Date fields) — distinct from date-fns'
 * `isToday`, which SessionCalendar uses on already zone-adjusted Dates for
 * calendar-grid day comparisons.
 */
export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
