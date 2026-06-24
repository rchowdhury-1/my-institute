const { format } = require("date-fns");
const { toZonedTime } = require("date-fns-tz");

const LONDON = "Europe/London";
const CAIRO = "Africa/Cairo";

function toDate(input) {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

function londonLabel(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    timeZoneName: "short",
  }).formatToParts(d);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
}

function timeIn(d, tz) {
  return format(toZonedTime(d, tz), "HH:mm");
}

function dualTime(d) {
  return `${timeIn(d, LONDON)} ${londonLabel(d)} · ${timeIn(d, CAIRO)} Cairo`;
}

function datePart(d) {
  const zoned = toZonedTime(d, LONDON);
  const base = format(zoned, "EEE d MMM");
  return zoned.getFullYear() === new Date().getFullYear()
    ? base
    : `${base} ${zoned.getFullYear()}`;
}

function formatSessionTime(date) {
  const d = toDate(date);
  if (!d) return "";
  return `${datePart(d)} · ${dualTime(d)}`;
}

function formatSessionDate(date) {
  const d = toDate(date);
  if (!d) return "";
  return datePart(d);
}

function formatTimeOnly(date) {
  const d = toDate(date);
  if (!d) return "";
  return dualTime(d);
}

function formatRelative(date) {
  const d = toDate(date);
  if (!d) return "";
  const now = Date.now();
  const diff = d.getTime() - now;
  const absDiff = Math.abs(diff);
  const future = diff > 0;

  const minutes = Math.round(absDiff / 60000);
  const hours = Math.round(absDiff / 3600000);
  const days = Math.round(absDiff / 86400000);
  const weeks = Math.round(absDiff / 604800000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`;
  if (hours < 24) return future ? `in ${hours} hours` : `${hours} hours ago`;
  if (days === 1) return future ? "tomorrow" : "yesterday";
  if (days < 7) return future ? `in ${days} days` : `${days} days ago`;
  if (weeks < 5) return future ? `in ${weeks} weeks` : `${weeks} weeks ago`;

  return formatSimpleDate(d);
}

function formatSimpleDate(date) {
  const d = toDate(date);
  if (!d) return "";
  return format(toZonedTime(d, LONDON), "d MMM yyyy");
}

/**
 * A session is "still upcoming" until 24 hours after its scheduled end.
 */
function isSessionStillUpcoming(scheduledAt, durationMinutes, bufferHours = 24) {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (isNaN(start)) return false;
  const sessionEnd = start + durationMinutes * 60 * 1000;
  const cutoff = Date.now() - bufferHours * 60 * 60 * 1000;
  return sessionEnd > cutoff;
}

module.exports = {
  formatSessionTime,
  formatSessionDate,
  formatTimeOnly,
  formatRelative,
  formatSimpleDate,
  isSessionStillUpcoming,
};
