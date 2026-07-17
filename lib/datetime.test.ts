/**
 * Datetime utility unit tests.
 * Run with: npx tsx lib/datetime.test.ts
 */
import { strict as assert } from "node:assert";
import {
  formatSessionTime,
  formatSessionDate,
  formatTimeOnly,
  formatRelative,
  formatSimpleDate,
  isSessionJoinable,
  isSessionBeforeStart,
  computeClockSkew,
  zonedInputToISO,
  isoToZonedInput,
  otherZoneHint,
  OPERATIONAL_TZ,
} from "./datetime";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  FAIL  ${name}: ${msg}`);
    failed++;
  }
}

console.log("Datetime utility tests\n");

// ── BST (summer) ──
test("formatSessionTime — June date renders BST + Cairo", () => {
  // 2026-06-22 13:00 UTC = 14:00 BST (UTC+1) = 16:00 EEST (UTC+3, Egypt DST)
  const result = formatSessionTime("2026-06-22T13:00:00Z");
  assert.equal(result, "Mon 22 Jun · 14:00 BST · 16:00 Cairo");
});

test("formatSessionDate — June date, current year, no year shown", () => {
  const result = formatSessionDate("2026-06-22T13:00:00Z");
  assert.equal(result, "Mon 22 Jun");
});

test("formatTimeOnly — dual timezone in BST", () => {
  const result = formatTimeOnly("2026-06-22T13:00:00Z");
  assert.equal(result, "14:00 BST · 16:00 Cairo");
});

// ── GMT (winter) ──
test("formatSessionTime — January 2027 renders GMT + year", () => {
  // 2027-01-15 14:00 UTC = 14:00 GMT = 16:00 Cairo
  const result = formatSessionTime("2027-01-15T14:00:00Z");
  assert.equal(result, "Fri 15 Jan 2027 · 14:00 GMT · 16:00 Cairo");
});

test("formatSessionDate — different year includes year", () => {
  const result = formatSessionDate("2027-01-15T14:00:00Z");
  assert.equal(result, "Fri 15 Jan 2027");
});

// ── null / undefined / invalid ──
test("null returns empty string", () => {
  assert.equal(formatSessionTime(null), "");
  assert.equal(formatSessionDate(null), "");
  assert.equal(formatTimeOnly(null), "");
  assert.equal(formatRelative(null), "");
  assert.equal(formatSimpleDate(null), "");
});

test("undefined returns empty string", () => {
  assert.equal(formatSessionTime(undefined), "");
});

test("invalid date string returns empty string", () => {
  assert.equal(formatSessionTime("not-a-date"), "");
});

// ── formatSimpleDate ──
test("formatSimpleDate — renders d MMM yyyy", () => {
  assert.equal(formatSimpleDate("2026-06-22T13:00:00Z"), "22 Jun 2026");
});

// ── formatRelative ──
test("formatRelative — future date shows 'in X'", () => {
  const future = new Date(Date.now() + 3 * 3600_000).toISOString();
  const result = formatRelative(future);
  assert.ok(result.startsWith("in "), `Expected 'in ...', got '${result}'`);
});

test("formatRelative — past date shows 'X ago'", () => {
  const past = new Date(Date.now() - 3 * 3600_000).toISOString();
  const result = formatRelative(past);
  assert.ok(result.endsWith(" ago"), `Expected '... ago', got '${result}'`);
});

// ── join gate: early window + skew ──
test("isSessionJoinable — opens 15 min before start", () => {
  const start = new Date(Date.now() + 10 * 60_000).toISOString(); // starts in 10 min
  assert.equal(isSessionJoinable(start), true);
});

test("isSessionJoinable — closed 20 min before start", () => {
  const start = new Date(Date.now() + 20 * 60_000).toISOString();
  assert.equal(isSessionJoinable(start), false);
});

test("isSessionJoinable — closes after joinWindowHours", () => {
  const start = new Date(Date.now() - 4 * 3_600_000).toISOString(); // started 4h ago
  assert.equal(isSessionJoinable(start, 3), false);
  assert.equal(isSessionJoinable(start, 5), true);
});

test("isSessionJoinable — skew corrects a slow device clock", () => {
  const start = new Date(Date.now() + 60 * 60_000).toISOString(); // starts in 1h (true time)
  // device clock 2h behind → without skew the gate thinks start is 1h away: closed
  assert.equal(isSessionJoinable(start, 3, { skewMs: 0 }), false);
  // skew says server is ~65 min ahead of device → now + skew is inside the window
  assert.equal(isSessionJoinable(start, 3, { skewMs: 65 * 60_000 }), true);
});

test("isSessionBeforeStart — false once early window opens", () => {
  const start = new Date(Date.now() + 10 * 60_000).toISOString();
  assert.equal(isSessionBeforeStart(start), false); // within 15-min early window
  const farStart = new Date(Date.now() + 60 * 60_000).toISOString();
  assert.equal(isSessionBeforeStart(farStart), true);
  assert.equal(isSessionBeforeStart(farStart, 50 * 60_000), false); // skewed past the window opening
});

// ── computeClockSkew ──
test("computeClockSkew — server ahead gives positive skew", () => {
  const skew = computeClockSkew(new Date(Date.now() + 120_000).toISOString());
  assert.ok(skew > 115_000 && skew < 125_000, `Expected ~120000, got ${skew}`);
});

test("computeClockSkew — missing/garbage input gives 0", () => {
  assert.equal(computeClockSkew(undefined), 0);
  assert.equal(computeClockSkew(null), 0);
  assert.equal(computeClockSkew(""), 0);
  assert.equal(computeClockSkew("not-a-date"), 0);
});

// ── operational-zone form parsing (expectations assume Africa/Cairo) ──
test("OPERATIONAL_TZ is a known zone", () => {
  assert.ok(["Africa/Cairo", "Europe/London"].includes(OPERATIONAL_TZ));
});

test("zonedInputToISO — Cairo summer (EEST, UTC+3)", () => {
  assert.equal(zonedInputToISO("2026-07-20T19:00"), "2026-07-20T16:00:00.000Z");
});

test("zonedInputToISO — Cairo winter (EET, UTC+2)", () => {
  assert.equal(zonedInputToISO("2027-01-18T19:00"), "2027-01-18T17:00:00.000Z");
});

test("isoToZonedInput — inverse of zonedInputToISO", () => {
  assert.equal(isoToZonedInput("2026-07-20T16:00:00.000Z"), "2026-07-20T19:00");
  assert.equal(isoToZonedInput(zonedInputToISO("2027-01-18T09:30")), "2027-01-18T09:30");
});

test("otherZoneHint — July: 19:00 Egypt = 17:00 UK", () => {
  assert.equal(otherZoneHint("2026-07-20T19:00"), "= 17:00 UK");
});

test("otherZoneHint — January: 19:00 Egypt = 17:00 UK (both off DST)", () => {
  assert.equal(otherZoneHint("2027-01-18T19:00"), "= 17:00 UK");
});

test("otherZoneHint — empty/garbage gives empty string", () => {
  assert.equal(otherZoneHint(""), "");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
