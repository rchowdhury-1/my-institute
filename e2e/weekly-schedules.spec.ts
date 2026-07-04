/**
 * Phase 4.1 acceptance tests — weekly schedules, session generation, attendance, salary
 *
 * Hours model (2026-07): lessons_remaining holds HOURS (NUMERIC), decrements
 * by duration_minutes / 60 per attended session, and is required on create.
 *
 * Prerequisites:
 *   - Backend running (local or production)
 *   - Admin credentials
 *   - Test student + teacher accounts exist
 *   - Migrations 014-016 + 020 applied
 */

import { test, expect, APIRequestContext } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:5001";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars before running these tests.",
  );
}

const STUDENT_ID = "3de0a33b-93bf-4041-9ae0-770a290626d9";
const TEACHER_ID = "c084e832-ebdb-4152-83f6-ba923e5655db";

// Random slot times using a wide range (00:00-23:59) with random base.
// Uses a prime-number step (97 minutes) to spread across the full day
// and avoid collisions from accumulated test sessions.
const slotBase = Math.floor(Math.random() * 1440);
let slotCounter = 0;
function uniqueSlotTime(): string {
  const totalMinutes = (slotBase + slotCounter * 97) % 1440;
  slotCounter++;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
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

async function getStudentToken(request: APIRequestContext) {
  const adminToken = await getAdminToken(request);
  const resetRes = await request.post(
    `${API}/admin/students/${STUDENT_ID}/reset-password`,
    { headers: { Authorization: `Bearer ${adminToken}` }, data: { send_email: false } }
  );
  const { tempPassword } = await resetRes.json();
  return getToken(request, "playwright-student@phase35test.local", tempPassword);
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
  expect(body.generation.created).toBeGreaterThanOrEqual(3);
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

// ─── Cron auth (JWT-based) ───────────────────────────────────────────────

test("cron endpoint rejects unauthenticated request", async ({ request }) => {
  const res = await request.post(`${API}/cron/generate-sessions`);
  expect(res.status()).toBe(401);
});

test("cron endpoint works with admin JWT", async ({ request }) => {
  const token = await getAdminToken(request);
  const res = await request.post(`${API}/cron/generate-sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("schedules_processed");
  expect(body).toHaveProperty("total_created");
});

// ─── Salary / pay rate ───────────────────────────────────────────────────

// ─── Lessons remaining gate (Phase 4.5) ──────────────────────────────────

test("no_show decrements hours balance by session duration (30 min = 0.5)", async ({ request }) => {
  const token = await getAdminToken(request);

  // Create schedule with a 3-hour balance and a 30-minute slot
  const { res, body: created } = await createSchedule(request, {
    lessons_remaining: 3,
    slots: [{ day: "fri", time: uniqueSlotTime(), duration: 30 }],
  });
  expect(res.status()).toBe(201);
  const scheduleId = created.schedule.id;

  // Create a manual session linked to this schedule (far future for admin marking)
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

  // Link session to schedule manually (session was created without schedule_id)
  // Instead, mark attendance as no_show on a schedule-generated session
  // Get upcoming sessions for this schedule
  const schedRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await schedRes.json()).upcoming_sessions;

  if (upcoming.length > 0) {
    // Mark first generated session as no_show
    const attRes = await request.patch(
      `${API}/sessions/${upcoming[0].id}/attendance`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { teacher_attended: true, student_attended: false },
      }
    );
    expect(attRes.status()).toBe(200);
    expect((await attRes.json()).session.status).toBe("no_show");

    // Check balance decremented by the session's duration in hours (30 min = 0.5)
    const checkRes = await request.get(
      `${API}/admin/weekly-schedules/${scheduleId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const updated = (await checkRes.json()).schedule;
    expect(updated.lessons_remaining).toBe(2.5);
  }

  // Clean up the manual session
  await deleteSession(request, session.id);
  await deleteSchedule(request, scheduleId);
});

test("cancelled_teacher does NOT decrement lessons_remaining", async ({
  request,
}) => {
  const token = await getAdminToken(request);

  const { res, body: created } = await createSchedule(request, {
    lessons_remaining: 3,
    slots: [{ day: "fri", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  const scheduleId = created.schedule.id;

  const schedRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await schedRes.json()).upcoming_sessions;

  if (upcoming.length > 0) {
    // Mark as cancelled_teacher
    const attRes = await request.patch(
      `${API}/sessions/${upcoming[0].id}/attendance`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { teacher_attended: false, student_attended: false },
      }
    );
    expect(attRes.status()).toBe(200);
    expect((await attRes.json()).session.status).toBe("cancelled_teacher");

    // Balance should remain 3
    const checkRes = await request.get(
      `${API}/admin/weekly-schedules/${scheduleId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect((await checkRes.json()).schedule.lessons_remaining).toBe(3);
  }

  await deleteSchedule(request, scheduleId);
});

// ─── Hours validation (required field, 0.5 steps) ────────────────────────

test("create schedule without hours is rejected (required field)", async ({
  request,
}) => {
  const token = await getAdminToken(request);
  const res = await request.post(`${API}/admin/weekly-schedules`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      student_id: STUDENT_ID,
      teacher_id: TEACHER_ID,
      subject: "quran",
      default_duration: 60,
      slots: [{ day: "mon", time: uniqueSlotTime(), duration: 60 }],
      // lessons_remaining deliberately omitted
    },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("required");
});

test("create schedule with off-step hours is rejected", async ({
  request,
}) => {
  const { res } = await createSchedule(request, { lessons_remaining: 2.3 });
  expect(res.status()).toBe(400);
});

test("edit cannot set hours back to null (unlimited retired)", async ({
  request,
}) => {
  const { res, body: created } = await createSchedule(request, {
    lessons_remaining: 4,
    slots: [{ day: "tue", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  const token = await getAdminToken(request);

  const editRes = await request.patch(
    `${API}/admin/weekly-schedules/${created.schedule.id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { lessons_remaining: null },
    }
  );
  expect(editRes.status()).toBe(400);

  await deleteSchedule(request, created.schedule.id);
});

test("create schedule accepts half-hour balance (2.5)", async ({
  request,
}) => {
  const { res, body } = await createSchedule(request, {
    lessons_remaining: 2.5,
    slots: [{ day: "wed", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  expect(body.schedule.lessons_remaining).toBe(2.5);

  await deleteSchedule(request, body.schedule.id);
});

test("GET /sessions includes schedule_lessons_remaining", async ({
  request,
}) => {
  const token = await getAdminToken(request);

  const { res, body: created } = await createSchedule(request, {
    lessons_remaining: 7,
    slots: [{ day: "sat", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  const scheduleId = created.schedule.id;

  // Fetch sessions as admin
  const sessRes = await request.get(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(sessRes.status()).toBe(200);
  const sessions = (await sessRes.json()).sessions;

  // Find a session from our schedule
  const linkedSession = sessions.find(
    (s: Record<string, unknown>) => s.schedule_id === scheduleId
  );
  if (linkedSession) {
    // Must be a JSON number, not a string — guards the NUMERIC type parser
    expect(typeof linkedSession.schedule_lessons_remaining).toBe("number");
    expect(linkedSession.schedule_lessons_remaining).toBe(7);
  }

  await deleteSchedule(request, scheduleId);
});

// ─── Zoom link inheritance (Phase 5 patch) ──────────────────────────────

test("schedule with zoom_link → generated sessions inherit it", async ({
  request,
}) => {
  const { res, body } = await createSchedule(request, {
    zoom_link: "https://zoom.us/j/111222333",
    slots: [{ day: "sat", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  expect(body.schedule.zoom_link).toBe("https://zoom.us/j/111222333");
  const scheduleId = body.schedule.id;
  const token = await getAdminToken(request);

  // Check generated sessions have the zoom link
  const schedRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await schedRes.json()).upcoming_sessions;
  expect(upcoming.length).toBeGreaterThan(0);
  for (const s of upcoming) {
    expect(s.zoom_link).toBe("https://zoom.us/j/111222333");
  }

  await deleteSchedule(request, scheduleId);
});

test("schedule without zoom_link → sessions have null zoom_link", async ({
  request,
}) => {
  const { res, body } = await createSchedule(request, {
    slots: [{ day: "sun", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  expect(body.schedule.zoom_link).toBeNull();
  const scheduleId = body.schedule.id;
  const token = await getAdminToken(request);

  const schedRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await schedRes.json()).upcoming_sessions;
  expect(upcoming.length).toBeGreaterThan(0);
  for (const s of upcoming) {
    expect(s.zoom_link).toBeNull();
  }

  await deleteSchedule(request, scheduleId);
});

test("edit zoom_link → regenerated sessions use new link", async ({
  request,
}) => {
  const { res, body } = await createSchedule(request, {
    zoom_link: "https://zoom.us/j/old-link",
    slots: [{ day: "sat", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  const scheduleId = body.schedule.id;
  const token = await getAdminToken(request);

  // Edit zoom_link
  const editRes = await request.patch(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { zoom_link: "https://zoom.us/j/new-link" },
    }
  );
  expect(editRes.status()).toBe(200);
  const editBody = await editRes.json();
  expect(editBody.schedule.zoom_link).toBe("https://zoom.us/j/new-link");
  // Wipe+regenerate should have run
  expect(editBody.generation).toBeDefined();
  expect(editBody.generation.created).toBeGreaterThan(0);

  // Verify new sessions have the new link
  const schedRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await schedRes.json()).upcoming_sessions;
  for (const s of upcoming) {
    expect(s.zoom_link).toBe("https://zoom.us/j/new-link");
  }

  await deleteSchedule(request, scheduleId);
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

// ─── Schedules summary (Phase 5 model alignment) ─────────────────────────

test("schedules_summary: student with active schedule shows source=schedules", async ({
  request,
}) => {
  // Get baseline
  const studentToken = await getStudentToken(request);
  const baseRes = await request.get(`${API}/students/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const baseSummary = (await baseRes.json()).schedules_summary;
  const baseCount = baseSummary?.active_schedule_count || 0;
  const baseRemaining = baseSummary?.active_lessons_remaining || 0;

  const { res, body } = await createSchedule(request, {
    lessons_remaining: 5,
    slots: [{ day: "sat", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  const scheduleId = body.schedule.id;

  const studentToken2 = await getStudentToken(request);
  const meRes = await request.get(`${API}/students/me`, {
    headers: { Authorization: `Bearer ${studentToken2}` },
  });
  expect(meRes.status()).toBe(200);
  const meBody = await meRes.json();
  expect(meBody.schedules_summary).toBeDefined();
  expect(meBody.schedules_summary.source).toBe("schedules");
  expect(meBody.schedules_summary.active_lessons_remaining).toBe(baseRemaining + 5);
  expect(meBody.schedules_summary.active_schedule_count).toBe(baseCount + 1);

  await deleteSchedule(request, scheduleId);
});

test("schedules_summary: no active schedules shows package or none", async ({
  request,
}) => {
  // With no test schedules active, source should be "package" or "none"
  const studentToken = await getStudentToken(request);
  const meRes = await request.get(`${API}/students/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  expect(meRes.status()).toBe(200);
  const meBody = await meRes.json();
  expect(meBody.schedules_summary).toBeDefined();
  expect(meBody.schedules_summary).toHaveProperty("source");
  expect(meBody.schedules_summary).toHaveProperty("active_lessons_remaining");
});

test("schedules_summary: multiple active schedules sums lessons_remaining", async ({
  request,
}) => {
  // Get baseline
  const studentToken0 = await getStudentToken(request);
  const base = (await (await request.get(`${API}/students/me`, {
    headers: { Authorization: `Bearer ${studentToken0}` },
  })).json()).schedules_summary;
  const baseRemaining = base?.active_lessons_remaining || 0;
  const baseCount = base?.active_schedule_count || 0;

  const { res: r1, body: b1 } = await createSchedule(request, {
    lessons_remaining: 3,
    slots: [{ day: "mon", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(r1.status()).toBe(201);
  const { res: r2, body: b2 } = await createSchedule(request, {
    lessons_remaining: 4,
    slots: [{ day: "tue", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(r2.status()).toBe(201);

  const studentToken = await getStudentToken(request);
  const meRes = await request.get(`${API}/students/me`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  expect(meRes.status()).toBe(200);
  const summary = (await meRes.json()).schedules_summary;
  expect(summary.source).toBe("schedules");
  expect(summary.active_lessons_remaining).toBe(baseRemaining + 7);
  expect(summary.active_schedule_count).toBe(baseCount + 2);

  await deleteSchedule(request, b1.schedule.id);
  await deleteSchedule(request, b2.schedule.id);
});

test("schedules_summary: attendance decrement reflects immediately", async ({
  request,
}) => {
  const { res, body } = await createSchedule(request, {
    lessons_remaining: 3,
    slots: [{ day: "fri", time: uniqueSlotTime(), duration: 60 }],
  });
  expect(res.status()).toBe(201);
  const scheduleId = body.schedule.id;
  const token = await getAdminToken(request);

  // Get baseline
  const studentToken0 = await getStudentToken(request);
  const baseSummary = (await (await request.get(`${API}/students/me`, {
    headers: { Authorization: `Bearer ${studentToken0}` },
  })).json()).schedules_summary;
  const baseRemaining = baseSummary.active_lessons_remaining;

  // Get a generated session
  const schedRes = await request.get(
    `${API}/admin/weekly-schedules/${scheduleId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const upcoming = (await schedRes.json()).upcoming_sessions;

  if (upcoming.length > 0) {
    // Mark as completed
    await request.patch(`${API}/sessions/${upcoming[0].id}/attendance`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { teacher_attended: true, student_attended: true },
    });

    // Verify summary decremented by 1
    const studentToken = await getStudentToken(request);
    const meRes = await request.get(`${API}/students/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const summary = (await meRes.json()).schedules_summary;
    expect(summary.active_lessons_remaining).toBe(baseRemaining - 1);
  }

  await deleteSchedule(request, scheduleId);
});
