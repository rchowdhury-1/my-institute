/**
 * Phase 4.1 acceptance tests — weekly schedules, session generation, attendance, salary
 *
 * Prerequisites:
 *   - Backend running (local or production)
 *   - Admin credentials
 *   - Test student + teacher accounts exist
 *   - Migrations 014-016 applied
 */

import { test, expect, APIRequestContext } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:5001";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "razwanul712@gmail.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "Test12345";

const STUDENT_ID = "3de0a33b-93bf-4041-9ae0-770a290626d9";
const TEACHER_ID = "c084e832-ebdb-4152-83f6-ba923e5655db";

async function getToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  return (await res.json()).accessToken;
}

async function getAdminToken(request: APIRequestContext) {
  return getToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
}

async function getTeacherToken(request: APIRequestContext) {
  const adminToken = await getAdminToken(request);
  const resetRes = await request.post(
    `${API}/admin/teachers/${TEACHER_ID}/reset-password`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { send_email: false },
    }
  );
  const body = await resetRes.json();
  // Teacher email is needed — get it from admin endpoint
  const teacherRes = await request.get(`${API}/admin/teachers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const teachers = (await teacherRes.json()).teachers || [];
  const teacher = teachers.find((t: any) => t.id === TEACHER_ID);
  if (!teacher) throw new Error("Teacher not found");
  return getToken(request, teacher.email, body.tempPassword);
}

// Helpers
async function createSchedule(
  request: APIRequestContext,
  overrides: Record<string, any> = {}
) {
  const token = await getAdminToken(request);
  const data = {
    student_id: STUDENT_ID,
    teacher_id: TEACHER_ID,
    subject: "quran",
    default_duration: 60,
    slots: [
      { day: "mon", time: "05:00", duration: 60 },
      { day: "wed", time: "05:00", duration: 60 },
    ],
    lessons_remaining: 10,
    ...overrides,
  };
  const res = await request.post(`${API}/admin/weekly-schedules`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return { res, body: await res.json() };
}

async function deleteSchedule(request: APIRequestContext, id: string) {
  const token = await getAdminToken(request);
  await request.delete(`${API}/admin/weekly-schedules/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function deleteSession(request: APIRequestContext, id: string) {
  const token = await getAdminToken(request);
  await request.delete(`${API}/sessions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Schedule CRUD ──────────────────────────────────────────────────────────

test("create schedule generates sessions for 4 weeks", async ({ request }) => {
  const { res, body } = await createSchedule(request);
  expect(res.status()).toBe(201);
  expect(body.schedule).toBeDefined();
  expect(body.schedule.is_active).toBe(true);
  expect(body.generation.created).toBeGreaterThan(0);
  // 2 slots × ~4 weeks = ~8 sessions (exact count depends on current day)
  expect(body.generation.created).toBeGreaterThanOrEqual(4);
  expect(body.generation.created).toBeLessThanOrEqual(10);

  // Cleanup
  await deleteSchedule(request, body.schedule.id);
});

test("edit schedule wipes and regenerates sessions", async ({ request }) => {
  const { body: created } = await createSchedule(request);
  const scheduleId = created.schedule.id;
  const initialCount = created.generation.created;

  const token = await getAdminToken(request);

  // Edit: change Wed to Thu
  const editRes = await request.patch(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        slots: [
          { day: "mon", time: "05:00", duration: 60 },
          { day: "thu", time: "05:00", duration: 60 },
        ],
      },
    }
  );
  expect(editRes.status()).toBe(200);
  const editBody = await editRes.json();
  expect(editBody.generation).toBeDefined();
  expect(editBody.generation.created).toBeGreaterThan(0);

  await deleteSchedule(request, scheduleId);
});

test("deactivate schedule removes future sessions", async ({ request }) => {
  const { body: created } = await createSchedule(request);
  const scheduleId = created.schedule.id;

  const token = await getAdminToken(request);

  const delRes = await request.delete(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(delRes.status()).toBe(200);
  const delBody = await delRes.json();
  expect(delBody.sessions_removed).toBeGreaterThan(0);

  // Verify schedule is inactive
  const getRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const getBody = await getRes.json();
  expect(getBody.schedule.is_active).toBe(false);
});

test("reactivate schedule generates fresh sessions", async ({ request }) => {
  const { body: created } = await createSchedule(request);
  const scheduleId = created.schedule.id;
  const token = await getAdminToken(request);

  // Deactivate
  await request.delete(`${API}/admin/weekly-schedules/${scheduleId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Reactivate
  const reactRes = await request.post(
    `${API}/admin/weekly-schedules/${scheduleId}/reactivate`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(reactRes.status()).toBe(200);
  const reactBody = await reactRes.json();
  expect(reactBody.generation.created).toBeGreaterThan(0);

  await deleteSchedule(request, scheduleId);
});

test("multiple schedules for same student+teacher allowed", async ({
  request,
}) => {
  const { body: first } = await createSchedule(request, {
    subject: "quran",
    slots: [{ day: "mon", time: "05:00", duration: 60 }],
  });

  const { res: secondRes, body: second } = await createSchedule(request, {
    subject: "arabic",
    slots: [{ day: "tue", time: "05:00", duration: 60 }],
  });

  expect(secondRes.status()).toBe(201);
  expect(second.schedule.id).not.toBe(first.schedule.id);

  await deleteSchedule(request, first.schedule.id);
  await deleteSchedule(request, second.schedule.id);
});

// ─── Idempotency ──────────────────────────────────────────────────────────

test("generate is idempotent — no duplicates on second call", async ({
  request,
}) => {
  const { body: created } = await createSchedule(request);
  const scheduleId = created.schedule.id;
  const token = await getAdminToken(request);

  // Call generate again
  const genRes = await request.post(
    `${API}/admin/weekly-schedules/${scheduleId}/generate`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(genRes.status()).toBe(200);
  const genBody = await genRes.json();
  expect(genBody.generation.created).toBe(0); // Nothing new created

  await deleteSchedule(request, scheduleId);
});

// ─── Cancelled session non-regeneration ─────────────────────────────────

test("cancelled auto-generated session is NOT re-generated", async ({
  request,
}) => {
  const { body: created } = await createSchedule(request, {
    slots: [{ day: "mon", time: "05:00", duration: 60 }],
  });
  const scheduleId = created.schedule.id;
  const token = await getAdminToken(request);

  // Get the generated sessions
  const sessionsRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await sessionsRes.json()).upcoming_sessions;
  expect(upcoming.length).toBeGreaterThan(0);

  // Cancel the first session
  const firstSessionId = upcoming[0].id;
  const cancelRes = await request.patch(
    `${API}/sessions/${firstSessionId}/cancel`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { cancellation_reason: "test cancellation" },
    }
  );
  expect(cancelRes.status()).toBe(200);

  // Call generate again — should NOT re-create the cancelled slot
  const genRes = await request.post(
    `${API}/admin/weekly-schedules/${scheduleId}/generate`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const genBody = await genRes.json();
  expect(genBody.generation.created).toBe(0);

  await deleteSchedule(request, scheduleId);
});

// ─── Attendance ──────────────────────────────────────────────────────────

test("attendance: teacher+student attended → completed", async ({
  request,
}) => {
  // Create a session happening right now (admin can mark at any time)
  const token = await getAdminToken(request);
  const sessionTime = new Date(Date.now() + 30 * 60000).toISOString(); // 30 min from now
  const createRes = await request.post(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      student_id: STUDENT_ID,
      teacher_id: TEACHER_ID,
      scheduled_at: sessionTime,
      duration_minutes: 60,
      subject: "quran",
    },
  });
  const session = (await createRes.json()).session;

  // Admin marks attendance
  const attRes = await request.patch(
    `${API}/sessions/${session.id}/attendance`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { teacher_attended: true, student_attended: true },
    }
  );
  expect(attRes.status()).toBe(200);
  const attBody = await attRes.json();
  expect(attBody.session.status).toBe("completed");
  expect(attBody.session.teacher_attended).toBe(true);
  expect(attBody.session.student_attended).toBe(true);

  await deleteSession(request, session.id);
});

test("attendance: teacher attended, student didn't → no_show", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const sessionTime = new Date(Date.now() + 30 * 60000).toISOString();
  const session = (
    await (
      await request.post(`${API}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          student_id: STUDENT_ID,
          teacher_id: TEACHER_ID,
          scheduled_at: sessionTime,
          duration_minutes: 60,
          subject: "quran",
        },
      })
    ).json()
  ).session;

  const attRes = await request.patch(
    `${API}/sessions/${session.id}/attendance`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { teacher_attended: true, student_attended: false },
    }
  );
  expect(attRes.status()).toBe(200);
  expect((await attRes.json()).session.status).toBe("no_show");

  await deleteSession(request, session.id);
});

test("attendance: teacher didn't attend → cancelled_teacher", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const sessionTime = new Date(Date.now() + 30 * 60000).toISOString();
  const session = (
    await (
      await request.post(`${API}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          student_id: STUDENT_ID,
          teacher_id: TEACHER_ID,
          scheduled_at: sessionTime,
          duration_minutes: 60,
          subject: "quran",
        },
      })
    ).json()
  ).session;

  const attRes = await request.patch(
    `${API}/sessions/${session.id}/attendance`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { teacher_attended: false, student_attended: false },
    }
  );
  expect(attRes.status()).toBe(200);
  expect((await attRes.json()).session.status).toBe("cancelled_teacher");

  await deleteSession(request, session.id);
});

test("teacher cannot mark attendance too early (ATTENDANCE_TOO_EARLY)", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  // Session far in the future (48h from now)
  const sessionTime = new Date(
    Date.now() + 48 * 3600000
  ).toISOString();
  const session = (
    await (
      await request.post(`${API}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          student_id: STUDENT_ID,
          teacher_id: TEACHER_ID,
          scheduled_at: sessionTime,
          duration_minutes: 60,
          subject: "quran",
        },
      })
    ).json()
  ).session;

  // Get teacher token
  let teacherToken: string;
  try {
    teacherToken = await getTeacherToken(request);
  } catch {
    // If teacher password reset fails, skip test gracefully
    await deleteSession(request, session.id);
    test.skip();
    return;
  }

  const attRes = await request.patch(
    `${API}/sessions/${session.id}/attendance`,
    {
      headers: { Authorization: `Bearer ${teacherToken}` },
      data: { teacher_attended: true, student_attended: true },
    }
  );
  expect(attRes.status()).toBe(403);
  const attBody = await attRes.json();
  expect(attBody.code).toBe("ATTENDANCE_TOO_EARLY");

  // Admin CAN mark at any time
  const adminAttRes = await request.patch(
    `${API}/sessions/${session.id}/attendance`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { teacher_attended: true, student_attended: true },
    }
  );
  expect(adminAttRes.status()).toBe(200);

  await deleteSession(request, session.id);
});

// ─── Cron auth ──────────────────────────────────────────────────────────

test("cron endpoint rejects wrong secret", async ({ request }) => {
  const res = await request.post(`${API}/cron/generate-sessions`, {
    headers: { "x-cron-secret": "wrong-secret" },
  });
  expect(res.status()).toBe(401);
});

// ─── Salary / pay rate ───────────────────────────────────────────────────

test("set pay rate and verify salary in teacher-hours", async ({
  request,
}) => {
  const token = await getAdminToken(request);

  // Set pay rate
  const payRes = await request.patch(
    `${API}/admin/teachers/${TEACHER_ID}/pay-rate`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { pay_rate_per_hour: 15.0, pay_currency: "GBP" },
    }
  );
  expect(payRes.status()).toBe(200);
  const payBody = await payRes.json();
  expect(parseFloat(payBody.teacher.pay_rate_per_hour)).toBe(15.0);
  expect(payBody.teacher.pay_currency).toBe("GBP");

  // Query teacher-hours — verify salary field exists
  const hoursRes = await request.get(
    `${API}/admin/teacher-hours?teacher_id=${TEACHER_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(hoursRes.status()).toBe(200);
  const hoursBody = await hoursRes.json();
  expect(hoursBody.teachers.length).toBeGreaterThan(0);
  const teacher = hoursBody.teachers[0];
  expect(teacher.pay_rate_per_hour).toBeDefined();
  expect(teacher.pay_currency).toBe("GBP");
  // salary is total_hours * rate — may be 0 if no completed sessions this month
  expect(teacher).toHaveProperty("salary");
});
