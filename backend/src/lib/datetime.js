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

module.exports = {
  formatSessionTime,
};
