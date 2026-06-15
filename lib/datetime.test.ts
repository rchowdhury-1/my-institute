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

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
