/**
 * Teacher Hours page acceptance tests
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Backend running on http://localhost:5001
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const API = "http://localhost:5001";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars before running these tests.",
  );
}

// Helper: login as admin and get token
async function getAdminToken(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  const data = await res.json();
  return data.accessToken;
}

// Helper: login in browser
async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/supervisor");
}

test.describe.serial("Teacher Hours page", () => {
  let token: string;
  let teacherId: string;
  let studentId: string;
  const sessionIds: string[] = [];

  test.beforeAll(async () => {
    token = await getAdminToken();
  });

  test("page loads for admin and shows title", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);
    await expect(page.getByTestId("page-title")).toHaveText("Teacher Hours");
    await expect(page.getByTestId("month-selector")).toBeVisible();
  });

  test("redirects non-admin to login", async ({ page }) => {
    // Clear any stored auth
    await page.goto(`${BASE}/admin/teacher-hours`);
    await page.evaluate(() => {
      localStorage.removeItem("userRole");
      localStorage.removeItem("accessToken");
    });
    await page.reload();
    await page.waitForURL("**/login");
  });

  test("current month shown by default", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);
    const now = new Date();
    const expected = now.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    await expect(page.getByTestId("current-month")).toHaveText(expected);
  });

  test("month selector changes data displayed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);

    const initialMonth = await page.getByTestId("current-month").textContent();

    // Go to previous month
    await page.getByTestId("prev-month").click();
    await page.waitForTimeout(500);
    const newMonth = await page.getByTestId("current-month").textContent();
    expect(newMonth).not.toBe(initialMonth);

    // Go forward again
    await page.getByTestId("next-month").click();
    await page.waitForTimeout(500);
    const backMonth = await page.getByTestId("current-month").textContent();
    expect(backMonth).toBe(initialMonth);
  });

  test("create test data: teacher + student + sessions", async () => {
    // Create a teacher
    const teacherRes = await fetch(`${API}/admin/teachers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        display_name: "E2E Hours Teacher",
        email: `hours-teacher-${Date.now()}@test.com`,
        password: ADMIN_PASSWORD,
        send_email: false,
      }),
    });
    const teacherData = await teacherRes.json();
    teacherId = teacherData.teacher.id;

    // Create a student
    const studentRes = await fetch(`${API}/admin/students`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        display_name: "E2E Hours Student",
        email: `hours-student-${Date.now()}@test.com`,
        password: ADMIN_PASSWORD,
        send_email: false,
        hourly_rate: 10,
        teacher_id: teacherId,
      }),
    });
    const studentData = await studentRes.json();
    studentId = studentData.student.id;

    // Create sessions: 2x60min + 1x30min completed, 1x60min cancelled
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    for (const { duration, status } of [
      { duration: 60, status: "completed" },
      { duration: 60, status: "completed" },
      { duration: 30, status: "completed" },
      { duration: 60, status: "cancelled" },
    ]) {
      const scheduledAt = new Date(
        now.getFullYear(),
        now.getMonth(),
        10 + sessionIds.length,
        10,
        0
      ).toISOString();

      const sessionRes = await fetch(`${API}/admin/lessons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          teacher_id: teacherId,
          subject: "quran",
          scheduled_at: scheduledAt,
          duration_minutes: duration,
        }),
      });
      const sessionData = await sessionRes.json();
      const sid = sessionData.lesson.id;
      sessionIds.push(sid);

      // Mark status
      if (status === "completed") {
        const completeRes = await fetch(`${API}/sessions/${sid}/complete`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!completeRes.ok) {
          const err = await completeRes.text();
          throw new Error(`Failed to complete session ${sid}: ${completeRes.status} ${err}`);
        }
      } else if (status === "cancelled") {
        const cancelRes = await fetch(`${API}/sessions/${sid}/cancel`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cancellation_reason: "Test cancellation" }),
        });
        if (!cancelRes.ok) {
          const err = await cancelRes.text();
          throw new Error(`Failed to cancel session ${sid}: ${cancelRes.status} ${err}`);
        }
      }
    }
  });

  test("teacher shows correct hours and cancelled count", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="teacher-list"]', { timeout: 10000 });

    // Find the teacher row
    const rows = page.getByTestId("teacher-row");
    const count = await rows.count();
    let found = false;

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = await row.getByTestId("teacher-name").textContent();
      if (name === "E2E Hours Teacher") {
        found = true;
        // 2x60 + 1x30 = 150min = 2.5h
        await expect(row.getByTestId("teacher-hours")).toHaveText("2.5h");
        // 1 cancelled
        await expect(row.getByTestId("cancelled-count")).toContainText("1 cancelled");
        break;
      }
    }
    expect(found).toBe(true);
  });

  test("summary total equals sum of all teacher hours", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="teacher-list"]', { timeout: 10000 });

    // Get individual hours
    const hourElements = await page.getByTestId("teacher-hours").allTextContents();
    const sum =
      Math.round(
        hourElements.reduce((acc, h) => acc + parseFloat(h.replace("h", "")), 0) * 10
      ) / 10;

    // Get summary total
    const totalText = await page.getByTestId("total-hours").textContent();
    const total = parseFloat(totalText!.replace("h", ""));

    expect(total).toBe(sum);
  });

  test("empty state when month has no sessions", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);

    // Navigate far back to a month with no sessions
    for (let i = 0; i < 12; i++) {
      await page.getByTestId("prev-month").click();
    }

    // Wait for the empty state to appear
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("empty-state")).toContainText(
      "No teaching hours recorded for"
    );
  });

  // Cleanup test data
  test.afterAll(async () => {
    // Deactivate the teacher so they don't clutter future test runs
    // First cancel any remaining scheduled sessions
    for (const sid of sessionIds) {
      await fetch(`${API}/sessions/${sid}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "test cleanup" }),
      }).catch(() => {});
    }

    // Deactivate teacher
    await fetch(`${API}/admin/teachers/${teacherId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_active: false }),
    }).catch(() => {});
  });
});
