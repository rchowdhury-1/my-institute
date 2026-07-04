import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const LONDON = "Europe/London";
const CAIRO = "Africa/Cairo";

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
 * The Join button is active from the session's start time until
 * `joinWindowHours` after the start (default 3h).
 *
 * Distinct from isSessionStillUpcoming: that predicate anchors on the
 * session END (+3h) and controls list visibility; this one anchors on the
 * START and controls only whether the join link is live. A session can be
 * visible in "upcoming" while its join window is closed — that is intended.
 */
export function isSessionJoinable(
  scheduledAt: Date | string | null | undefined,
  joinWindowHours: number = 3
): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  const now = Date.now();
  return now >= start && now <= start + joinWindowHours * 60 * 60 * 1000;
}

/** True while the session has not started yet (join window not open). */
export function isSessionBeforeStart(
  scheduledAt: Date | string | null | undefined
): boolean {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  return Date.now() < start;
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
