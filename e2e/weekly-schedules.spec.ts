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

// Use unique early-morning UTC times that are always in the future
// (03:00-04:59 UTC — future for London which is UTC+0/+1)
let slotCounter = 0;
function uniqueSlotTime(): string {
  const h = 3 + Math.floor(slotCounter / 60);
  const m = slotCounter % 60;
  slotCounter++;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Use unique far-future dates for attendance tests to avoid teacher conflicts
let attendanceCounter = 0;
function uniqueAttendanceTime(): string {
  const day = 10 + attendanceCounter++;
  return `2026-08-${String(day).padStart(2, "0")}T03:00:00Z`;
}

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

// Helpers
async function createSchedule(
  request: APIRequestContext,
  overrides: Record<string, any> = {}
) {
  const token = await getAdminToken(request);
  const t1 = uniqueSlotTime();
  const t2 = uniqueSlotTime();
  const data = {
    student_id: STUDENT_ID,
    teacher_id: TEACHER_ID,
    subject: "quran",
    default_duration: 60,
    slots: [
      { day: "mon", time: t1, duration: 60 },
      { day: "wed", time: t2, duration: 60 },
    ],
    lessons_remaining: 10,
    ...overrides,
  };
  const res = await request.post(`${API}/admin/weekly-schedules`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  const body = await res.json();
  return { res, body };
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
  expect(body.generation.created).toBeGreaterThanOrEqual(4);
  expect(body.generation.created).toBeLessThanOrEqual(10);

  await deleteSchedule(request, body.schedule.id);
});

test("edit schedule wipes and regenerates sessions", async ({ request }) => {
  const { res, body: created } = await createSchedule(request);
  expect(res.status()).toBe(201);
  const scheduleId = created.schedule.id;

  const token = await getAdminToken(request);
  const newTime = uniqueSlotTime();

  const editRes = await request.patch(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        slots: [
          { day: "mon", time: newTime, duration: 60 },
          { day: "thu", time: uniqueSlotTime(), duration: 60 },
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
  const { res, body: created } = await createSchedule(request);
  expect(res.status()).toBe(201);
  const scheduleId = created.schedule.id;
  expect(created.generation.created).toBeGreaterThan(0);

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
  const { res, body: created } = await createSchedule(request);
  expect(res.status()).toBe(201);
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
  const { res: firstRes, body: first } = await createSchedule(request, {
    subject: "quran",
    slots: [{ day: "mon", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(firstRes.status()).toBe(201);

  const { res: secondRes, body: second } = await createSchedule(request, {
    subject: "arabic",
    slots: [{ day: "tue", time: uniqueSlotTime(), duration: 60 }],
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
  const { res, body: created } = await createSchedule(request);
  expect(res.status()).toBe(201);
  const scheduleId = created.schedule.id;
  const token = await getAdminToken(request);

  // Call generate again
  const genRes = await request.post(
    `${API}/admin/weekly-schedules/${scheduleId}/generate`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(genRes.status()).toBe(200);
  const genBody = await genRes.json();
  expect(genBody.generation.created).toBe(0);

  await deleteSchedule(request, scheduleId);
});

// ─── Cancelled session non-regeneration ─────────────────────────────────

test("cancelled auto-generated session is NOT re-generated", async ({
  request,
}) => {
  const t = uniqueSlotTime();
  const { res, body: created } = await createSchedule(request, {
    slots: [{ day: "thu", time: t, duration: 60 }],
  });
  expect(res.status()).toBe(201);
  expect(created.generation.created).toBeGreaterThan(0);
  const scheduleId = created.schedule.id;
  const token = await getAdminToken(request);

  // Get the generated sessions
  const sessionsRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const sessBody = await sessionsRes.json();
  const upcoming = sessBody.upcoming_sessions;
  expect(upcoming).toBeDefined();
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
  const token = await getAdminToken(request);
  const sessionTime = uniqueAttendanceTime();
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
  expect(createRes.status()).toBe(201);
  const session = (await createRes.json()).session;

  // Admin marks attendance (admin can mark at any time)
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
  const sessionTime = uniqueAttendanceTime();
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
  expect(createRes.status()).toBe(201);
  const session = (await createRes.json()).session;

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
  const sessionTime = uniqueAttendanceTime();
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
  expect(createRes.status()).toBe(201);
  const session = (await createRes.json()).session;

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
  // Session 48h in the future — teacher can't mark yet
  const sessionTime = new Date(Date.now() + 48 * 3600000).toISOString();
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
  expect(createRes.status()).toBe(201);
  const session = (await createRes.json()).session;

  // Get teacher token
  const adminToken = token;
  const resetRes = await request.post(
    `${API}/admin/teachers/${TEACHER_ID}/reset-password`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { send_email: false },
    }
  );
  const resetBody = await resetRes.json();
  if (!resetBody.tempPassword) {
    // Teacher password reset not supported — skip test
    await deleteSession(request, session.id);
    test.skip();
    return;
  }

  // Get teacher email
  const teachersRes = await request.get(`${API}/admin/teachers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const teachers = (await teachersRes.json()).teachers || [];
  const teacher = teachers.find((t: any) => t.id === TEACHER_ID);
  if (!teacher) {
    await deleteSession(request, session.id);
    test.skip();
    return;
  }

  const teacherToken = await getToken(
    request,
    teacher.email,
    resetBody.tempPassword
  );

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
      headers: { Authorization: `Bearer ${adminToken}` },
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

  const hoursRes = await request.get(
    `${API}/admin/teacher-hours?teacher_id=${TEACHER_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  expect(hoursRes.status()).toBe(200);
  const hoursBody = await hoursRes.json();
  expect(hoursBody.teachers.length).toBeGreaterThan(0);
  const teacherData = hoursBody.teachers[0];
  expect(teacherData.pay_rate_per_hour).toBeDefined();
  expect(teacherData.pay_currency).toBe("GBP");
  expect(teacherData).toHaveProperty("salary");
});
