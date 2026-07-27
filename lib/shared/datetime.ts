import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { LONDON_TZ, CAIRO_TZ } from "./constants";

/**
 * Cross-tier source of truth for the one datetime formatter both tiers need
 * byte-identical (backend sends `formatSessionTime` output directly in
 * notification text). See lib/shared/constants.ts for the sync/drift-check
 * mechanism. This batch moves code; it does not change formatting output.
 */

export function toDate(input: Date | string | null | undefined): Date | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

/** Short timezone label for Europe/London: "BST" in summer, "GMT" in winter */
export function londonLabel(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    timeZoneName: "short",
  }).formatToParts(d);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
}

/** Format time in a given IANA timezone as "HH:mm" */
export function timeIn(d: Date, tz: string): string {
  return format(toZonedTime(d, tz), "HH:mm");
}

/** "14:00 BST · 16:00 Cairo" */
export function dualTime(d: Date): string {
  return `${timeIn(d, LONDON_TZ)} ${londonLabel(d)} · ${timeIn(d, CAIRO_TZ)} Cairo`;
}

/** Date portion: "Mon 22 Jun" or "Mon 22 Jun 2027" if not current year */
export function datePart(d: Date): string {
  const zoned = toZonedTime(d, LONDON_TZ);
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
