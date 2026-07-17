import { format } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const LONDON = "Europe/London";
const CAIRO = "Africa/Cairo";

/**
 * The single timezone admin-entered wall-clock times are anchored to
 * (schedule slots, one-off session create/edit). Must stay in sync with
 * OPERATIONAL_TZ in backend/src/lib/schedule-generator.js. If this value
 * changes, all active schedules must be wiped and regenerated
 * (POST /cron/regenerate-all).
 */
export const OPERATIONAL_TZ = CAIRO;
/** Human label for OPERATIONAL_TZ, shown on time inputs. */
export const OPERATIONAL_TZ_LABEL = OPERATIONAL_TZ === CAIRO ? "Egypt time" : "UK time";
/** The "other" zone shown as a live hint next to time inputs. */
const HINT_TZ = OPERATIONAL_TZ === CAIRO ? LONDON : CAIRO;
const HINT_TZ_LABEL = OPERATIONAL_TZ === CAIRO ? "UK" : "Cairo";

function toDate(input: Date | string | null | undefined): Date | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

/** Short timezone label for Europe/London: "BST" in summer, "GMT" in winter */
function londonLabel(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    timeZoneName: "short",
  }).formatToParts(d);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
}

/** Format time in a given IANA timezone as "HH:mm" */
function timeIn(d: Date, tz: string): string {
  return format(toZonedTime(d, tz), "HH:mm");
}

/** "14:00 BST · 16:00 Cairo" */
function dualTime(d: Date): string {
  return `${timeIn(d, LONDON)} ${londonLabel(d)} · ${timeIn(d, CAIRO)} Cairo`;
}

/** Date portion: "Mon 22 Jun" or "Mon 22 Jun 2027" if not current year */
function datePart(d: Date): string {
  const zoned = toZonedTime(d, LONDON);
  const base = format(zoned, "EEE d MMM");
  return zoned.getFullYear() === new Date().getFullYear()
    ? base
    : `${base} ${zoned.getFullYear()}`;
}

/**
 * Full session display: "Mon 22 Jun · 14:00 BST · 16:00 Cairo"
 */
export function formatSessionTime(
  date: Date | string | null | undefined
): string {
  const d = toDate(date);
  if (!d) return "";
  return `${datePart(d)} · ${dualTime(d)}`;
}

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
  joinWindowHours: number = 3,
  opts: { earlyMinutes?: number; skewMs?: number } = {}
): boolean {
  const { earlyMinutes = 15, skewMs = 0 } = opts;
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
  earlyMinutes: number = 15
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
  bufferHours: number = 3
): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  const sessionEnd = start + durationMinutes * 60 * 1000;
  const cutoff = Date.now() - bufferHours * 60 * 60 * 1000;
  return sessionEnd > cutoff;
}
