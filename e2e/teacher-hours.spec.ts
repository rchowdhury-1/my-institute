/**
 * Teacher Hours page acceptance tests
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Backend running on http://localhost:5001
 */

import { test, expect, APIRequestContext, Page } from "@playwright/test";
import { API, getAdminToken, loginAndNavigate, ADMIN_PASSWORD, BASE } from "./helpers";

async function loginAsAdmin(page: Page) {
  await loginAndNavigate(page, "/supervisor");
}

interface SeededHoursData {
  teacherId: string;
  studentId: string;
  sessionIds: string[];
}

// Creates a disposable teacher + student + 4 sessions (3 completed totalling
// 2.5h, 1 cancelled) for this month, via the current (non-deprecated)
// attendance flow. Runs once in beforeAll rather than as a "test".
async function seedTeacherHoursData(
  request: APIRequestContext,
  token: string
): Promise<SeededHoursData> {
  const teacherRes = await request.post(`${API}/admin/teachers`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      display_name: "E2E Hours Teacher",
      email: `hours-teacher-${Date.now()}@test.com`,
      password: ADMIN_PASSWORD,
      send_email: false,
    },
  });
  const teacherId = (await teacherRes.json()).teacher.id;

  const studentRes = await request.post(`${API}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      display_name: "E2E Hours Student",
      email: `hours-student-${Date.now()}@test.com`,
      password: ADMIN_PASSWORD,
      send_email: false,
      hourly_rate: 10,
      teacher_id: teacherId,
    },
  });
  const studentId = (await studentRes.json()).student.id;

  const sessionIds: string[] = [];
  const now = new Date();

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

    const sessionRes = await request.post(`${API}/admin/lessons`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        student_id: studentId,
        teacher_id: teacherId,
        subject: "quran",
        scheduled_at: scheduledAt,
        duration_minutes: duration,
      },
    });
    const sid = (await sessionRes.json()).lesson.id;
    sessionIds.push(sid);

    if (status === "completed") {
      const attRes = await request.patch(`${API}/sessions/${sid}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { teacher_attended: true, student_attended: true },
      });
      if (!attRes.ok()) {
        throw new Error(`Failed to mark session ${sid} completed: ${attRes.status()} ${await attRes.text()}`);
      }
    } else if (status === "cancelled") {
      const cancelRes = await request.patch(`${API}/sessions/${sid}/cancel`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { cancellation_reason: "Test cancellation" },
      });
      if (!cancelRes.ok()) {
        throw new Error(`Failed to cancel session ${sid}: ${cancelRes.status()} ${await cancelRes.text()}`);
      }
    }
  }

  return { teacherId, studentId, sessionIds };
}

test.describe.serial("Teacher Hours page", () => {
  let token: string;
  let teacherId: string;
  const sessionIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    token = await getAdminToken(request);
    const seeded = await seedTeacherHoursData(request, token);
    teacherId = seeded.teacherId;
    sessionIds.push(...seeded.sessionIds);
  });

  test.afterAll(async ({ request }) => {
    // Cancel any remaining scheduled sessions, then deactivate the teacher
    // so disposable test data doesn't clutter future runs.
    for (const sid of sessionIds) {
      await request.patch(`${API}/sessions/${sid}/cancel`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { cancellation_reason: "test cleanup" },
      }).catch((e) => console.warn(`cleanup failed for session ${sid}: ${e}`));
    }
    await request.patch(`${API}/admin/teachers/${teacherId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { is_active: false },
    }).catch((e) => console.warn(`cleanup failed deactivating teacher ${teacherId}: ${e}`));
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
    await expect(page.getByTestId("current-month")).not.toHaveText(initialMonth ?? "");
    const newMonth = await page.getByTestId("current-month").textContent();
    expect(newMonth).not.toBe(initialMonth);

    // Go forward again
    await page.getByTestId("next-month").click();
    await expect(page.getByTestId("current-month")).toHaveText(initialMonth ?? "");
  });

  test("teacher shows correct hours and cancelled count", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/teacher-hours`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="teacher-list"]', { timeout: 10000 });

    // Find the teacher row
    const row = page.getByTestId("teacher-row").filter({ hasText: "E2E Hours Teacher" });
    // 2x60 + 1x30 = 150min = 2.5h
    await expect(row.getByTestId("teacher-hours")).toHaveText("2.5h");
    // 1 cancelled
    await expect(row.getByTestId("cancelled-count")).toContainText("1 cancelled");
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
});
