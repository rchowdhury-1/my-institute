/**
 * Shared e2e test infrastructure — API/browser fixtures, login helpers, and
 * disposable test-account fixtures.
 *
 * Hard rule: every fixture below is a disposable playwright-* account. Never
 * hardcode a real user's id/email as a test fixture — resetting a fixture's
 * password/pay-rate is safe, doing so to a real account locks a real person
 * out of their account and, in one prior incident, overwrote a real
 * teacher's salary rate on every CI run (see change log 8.4).
 */

import { APIRequestContext, Page, expect } from "@playwright/test";

export const API = process.env.API_URL || "http://localhost:5001";
export const BASE = "http://localhost:3000";

function requireAdminCreds(): { email: string; password: string } {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars before running these tests.",
    );
  }
  return { email, password };
}

const adminCreds = requireAdminCreds();
export const ADMIN_EMAIL = adminCreds.email;
export const ADMIN_PASSWORD = adminCreds.password;

export const STUDENT_ID = "3de0a33b-93bf-4041-9ae0-770a290626d9";
export const TEST_TEACHER_EMAIL = "playwright-teacher@phase35test.local";
export const TEST_TEACHER2_EMAIL = "playwright-teacher2@phase35test.local";

// ─── API tokens ──────────────────────────────────────────────────────────

export async function getToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } });
  return (await res.json()).accessToken;
}

export async function getAdminToken(request: APIRequestContext): Promise<string> {
  return getToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function getStudentToken(request: APIRequestContext): Promise<string> {
  // Reset student password — send_email: false prevents welcome email
  const adminToken = await getAdminToken(request);
  const resetRes = await request.post(`${API}/admin/students/${STUDENT_ID}/reset-password`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { send_email: false },
  });
  const { tempPassword } = await resetRes.json();
  return getToken(request, "playwright-student@phase35test.local", tempPassword);
}

// ─── Disposable teacher fixtures, found-or-created by email ─────────────

const testTeacherIdCache = new Map<string, string>();

export async function getTestTeacherId(
  request: APIRequestContext,
  email: string = TEST_TEACHER_EMAIL,
  displayName: string = "Playwright Test Teacher"
): Promise<string> {
  const cached = testTeacherIdCache.get(email);
  if (cached) return cached;

  const adminToken = await getAdminToken(request);
  const findExisting = async () => {
    const listRes = await request.get(`${API}/admin/teachers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { teachers } = await listRes.json();
    return teachers.find((t: { email: string }) => t.email === email);
  };

  let teacher = await findExisting();
  if (!teacher) {
    const createRes = await request.post(`${API}/admin/teachers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { display_name: displayName, email, send_email: false },
    });
    teacher = createRes.status() === 409 ? await findExisting() : (await createRes.json()).teacher;
  }
  testTeacherIdCache.set(email, teacher.id);
  return teacher.id;
}

export async function getTeacherToken(
  request: APIRequestContext,
  email: string = TEST_TEACHER_EMAIL,
  displayName: string = "Playwright Test Teacher"
): Promise<string> {
  const teacherId = await getTestTeacherId(request, email, displayName);
  const adminToken = await getAdminToken(request);
  const resetRes = await request.post(`${API}/admin/teachers/${teacherId}/reset-password`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { send_email: false },
  });
  const { tempPassword } = await resetRes.json();
  return getToken(request, email, tempPassword);
}

// ─── Session fixtures ────────────────────────────────────────────────────

// Random offset generator — avoids collisions between repeated test runs.
// Shared module state means uniqueness holds across every spec file that
// imports these, not just within one file.
const randomBase = Math.floor(Math.random() * 500) + 100; // 100-599 hours from now
let testTimeCounter = 0;
let proposedCounter = 0;

export function uniqueProposedTime(): string {
  const offsetHours = randomBase + 2000 + proposedCounter++;
  return new Date(Date.now() + offsetHours * 3600000).toISOString();
}

// Create a test session. hoursFromNow controls future/past/buffer behaviour.
// For future sessions (hoursFromNow >= 13), uses a random far-future time.
// For past/buffer sessions (hoursFromNow < 13), uses exact offset from now.
export async function createTestSession(request: APIRequestContext, hoursFromNow: number) {
  const token = await getAdminToken(request);
  let time: string;
  if (hoursFromNow >= 13) {
    const offsetHours = randomBase + testTimeCounter++;
    time = new Date(Date.now() + offsetHours * 3600000).toISOString();
  } else {
    time = new Date(Date.now() + hoursFromNow * 3600000).toISOString();
  }
  const teacherId = await getTestTeacherId(request);
  const res = await request.post(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { student_id: STUDENT_ID, teacher_id: teacherId, scheduled_at: time, duration_minutes: 60, subject: "quran" },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).session;
}

// Create a session at an exact time with a custom duration.
export async function createSessionAt(request: APIRequestContext, scheduledAt: string, durationMinutes: number = 60) {
  const token = await getAdminToken(request);
  const teacherId = await getTestTeacherId(request);
  const res = await request.post(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { student_id: STUDENT_ID, teacher_id: teacherId, scheduled_at: scheduledAt, duration_minutes: durationMinutes, subject: "quran" },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).session;
}

export async function deleteSession(request: APIRequestContext, id: string) {
  const token = await getAdminToken(request);
  await request.delete(`${API}/sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
}

// ─── Browser helpers ─────────────────────────────────────────────────────

/**
 * Logs in as admin via the UI. When `path` is given, navigates there and
 * waits for the URL; otherwise just waits for the redirect away from /login.
 */
export async function loginAndNavigate(page: Page, path?: string): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 20_000 });

  if (path) {
    await page.goto(`${BASE}${path}`);
    await page.waitForURL((url) => url.href.includes(path), { timeout: 10_000 });
  }
}

/** Click a potentially off-screen element by scrolling it into view, then clicking */
export async function safeClick(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

export function uniqueEmail(prefix: string = "playwright"): string {
  return `${prefix}+${Date.now()}@test-mi.dev`;
}
