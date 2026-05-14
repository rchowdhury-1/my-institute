/**
 * Step 5 acceptance tests — /supervisor page changes
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Backend running on http://localhost:5000
 *   - Admin credentials: razwanul712@gmail.com / Test12345
 */

import { test, expect, Page, APIRequestContext } from "@playwright/test";

const ADMIN_EMAIL = "razwanul712@gmail.com";
const ADMIN_PASSWORD = "Test12345";
const BASE = "http://localhost:3000";
const API_BASE = "http://localhost:5001";

// ── Helper: log in as admin and navigate to /supervisor ─────────────────────

async function loginAndNavigate(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes("/login"), {
    timeout: 20_000,
  });
  await page.goto(`${BASE}/supervisor`);
  await page.waitForURL((url) => url.href.includes("/supervisor"), {
    timeout: 10_000,
  });
  // Wait for the page to load (stats grid renders once data arrives)
  await page.waitForSelector(".grid", { timeout: 10_000 });
}

/** Get admin JWT by posting credentials directly to the backend */
async function getAdminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await res.json();
  return body.accessToken as string;
}

// ────────────────────────────────────────────────────────────────────────────

test.describe("Supervisor Page — Step 5 changes", () => {

  // ── S1: Duration dropdown has exactly 4 options, default 60 min ───────────

  test("S1: duration dropdown has 30/60/90/120 min options and defaults to 60", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    // Open the session creation form
    await page.click("text=Add Session");
    await page.waitForSelector('[data-testid="select-duration"]', {
      timeout: 5_000,
    });

    const select = page.locator('[data-testid="select-duration"]');

    // Verify default value is 60
    await expect(select).toHaveValue("60");

    // Verify exactly 4 options with correct labels
    const options = select.locator("option");
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveText("30 min");
    await expect(options.nth(1)).toHaveText("60 min");
    await expect(options.nth(2)).toHaveText("90 min");
    await expect(options.nth(3)).toHaveText("120 min");
  });

  // ── S2: Create session with 30 min duration, card shows 30 min ────────────

  test("S2: create session with 30 min duration and card shows '30 min'", async ({
    page,
    request,
  }) => {
    await loginAndNavigate(page);

    // Fetch students and teachers from backend to get valid IDs
    const token = await getAdminToken(request);
    const [studRes, teachRes] = await Promise.all([
      request.get(`${API_BASE}/admin/students`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      request.get(`${API_BASE}/admin/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const { students } = await studRes.json();
    const { teachers } = await teachRes.json();

    if (!students?.length || !teachers?.length) {
      test.skip(true, "No students or teachers in DB — skipping session creation test");
      return;
    }

    const student = students[0];
    const teacher = teachers[0];

    // Open session creation form
    await page.click("text=Add Session");
    await page.waitForSelector('[data-testid="select-duration"]', {
      timeout: 5_000,
    });

    // Select student and teacher
    await page.selectOption('[data-testid="select-student"]', student.id);
    await page.selectOption('[data-testid="select-teacher"]', teacher.id);

    // Set date/time ~1 hour from now to avoid conflicts
    const soon = new Date(Date.now() + 3600 * 1000);
    const local = soon.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    await page.fill('input[type="datetime-local"]', local);

    // Change duration to 30 min
    await page.selectOption('[data-testid="select-duration"]', "30");
    await expect(page.locator('[data-testid="select-duration"]')).toHaveValue("30");

    // Submit
    await page.click("text=Create Session");

    // Wait for form to close
    await expect(page.locator('[data-testid="select-duration"]')).not.toBeVisible({
      timeout: 10_000,
    });

    // The new session card should appear in the list showing "30 min"
    await expect(
      page.locator(".space-y-2").locator("text=30 min").first()
    ).toBeVisible({ timeout: 8_000 });
  });

  // ── S3: Backend rejects duration_minutes: 45 with 400 ────────────────────

  test("S3: backend returns 400 for duration_minutes: 45 (bypassing UI)", async ({
    request,
  }) => {
    const token = await getAdminToken(request);

    // Fetch a valid student and teacher to pass required field checks
    const [studRes, teachRes] = await Promise.all([
      request.get(`${API_BASE}/admin/students`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      request.get(`${API_BASE}/admin/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const { students } = await studRes.json();
    const { teachers } = await teachRes.json();

    // Need at least one student and teacher; use real UUIDs so we get past
    // the required-fields check and hit the duration validation.
    const studentId = students?.[0]?.id ?? "00000000-0000-0000-0000-000000000001";
    const teacherId = teachers?.[0]?.id ?? "00000000-0000-0000-0000-000000000002";

    const res = await request.post(`${API_BASE}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        student_id: studentId,
        teacher_id: teacherId,
        scheduled_at: new Date(Date.now() + 7200 * 1000).toISOString(),
        duration_minutes: 45,
        subject: "quran",
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/30.*60.*90.*120|30, 60, 90, or 120/i);
  });

  // ── S4: People tab — Manage Teachers button navigates to /admin/teachers ──

  test("S4: People tab Manage Teachers button navigates to /admin/teachers", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    // Click the People tab
    await page.click("text=people");

    // Manage Teachers button should be visible
    await expect(
      page.locator('[data-testid="link-manage-teachers"]')
    ).toBeVisible();

    // Click it
    await page.click('[data-testid="link-manage-teachers"]');

    // Should land on /admin/teachers with the Teachers heading
    await page.waitForURL((url) => url.href.includes("/admin/teachers"), {
      timeout: 10_000,
    });
    await expect(page.locator("h1")).toHaveText("Teachers");
  });

  // ── S5: People tab — Manage Students button navigates to /admin/students ──

  test("S5: People tab Manage Students button navigates to /admin/students", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    // Click the People tab
    await page.click("text=people");

    // Manage Students button should be visible
    await expect(
      page.locator('[data-testid="link-manage-students"]')
    ).toBeVisible();

    // Click it
    await page.click('[data-testid="link-manage-students"]');

    // Should land on /admin/students with the Students heading
    await page.waitForURL((url) => url.href.includes("/admin/students"), {
      timeout: 10_000,
    });
    await expect(page.locator("h1")).toHaveText("Students");
  });
});
