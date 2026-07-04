/**
 * Unit tests for the session join window (start → start + 3h) and hours formatting.
 * Pure functions — no backend required.
 */

import { test, expect } from "@playwright/test";
import { isSessionJoinable, isSessionBeforeStart, isSessionStillUpcoming, formatHours } from "../lib/datetime";

const HOUR = 60 * 60 * 1000;

test("not joinable before start", () => {
  const start = new Date(Date.now() + 10 * 60 * 1000); // starts in 10 min
  expect(isSessionJoinable(start)).toBe(false);
  expect(isSessionBeforeStart(start)).toBe(true);
});

test("joinable just after start", () => {
  const start = new Date(Date.now() - 60 * 1000); // started 1 min ago
  expect(isSessionJoinable(start)).toBe(true);
  expect(isSessionBeforeStart(start)).toBe(false);
});

test("joinable near the end of the window", () => {
  const start = new Date(Date.now() - (3 * HOUR - 60 * 1000)); // 2h59m ago
  expect(isSessionJoinable(start)).toBe(true);
});

test("not joinable after start + 3h", () => {
  const start = new Date(Date.now() - (3 * HOUR + 60 * 1000)); // 3h01m ago
  expect(isSessionJoinable(start)).toBe(false);
  expect(isSessionBeforeStart(start)).toBe(false);
});

test("null/invalid input is never joinable", () => {
  expect(isSessionJoinable(null)).toBe(false);
  expect(isSessionJoinable(undefined)).toBe(false);
  expect(isSessionJoinable("not-a-date")).toBe(false);
});

test("join window is independent of visibility window", () => {
  // A 30-min session that ended 4h ago: join window closed (start+3h passed)
  // AND no longer visible (end+3h passed).
  const start = new Date(Date.now() - 4.5 * HOUR);
  expect(isSessionJoinable(start)).toBe(false);
  expect(isSessionStillUpcoming(start, 30)).toBe(false);

  // A 120-min session that started 3.5h ago: join window closed,
  // but still visible in upcoming (end was 1.5h ago, within the 3h buffer).
  const start2 = new Date(Date.now() - 3.5 * HOUR);
  expect(isSessionJoinable(start2)).toBe(false);
  expect(isSessionStillUpcoming(start2, 120)).toBe(true);
});

test("formatHours trims trailing zeros", () => {
  expect(formatHours(2)).toBe("2");
  expect(formatHours(2.5)).toBe("2.5");
  expect(formatHours(0.5)).toBe("0.5");
  expect(formatHours(10)).toBe("10");
});
