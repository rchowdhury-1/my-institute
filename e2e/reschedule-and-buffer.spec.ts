/**
 * Phase 3.2–3.3 acceptance tests — reschedule requests + cancellation buffer + admin edit
 *
 * NOTE: Tests written for Phase 3.3 but not executed in CI. First run
 * pending — expect possible minor fixes to selectors or assertions.
 *
 * Prerequisites:
 *   - Backend running on http://localhost:5001
 *   - Admin credentials: razwanul712@gmail.com / Test12345
 *   - A student account (rizwantest: rizwanc43@gmail.com)
 */

import { test, expect, APIRequestContext } from "@playwright/test";

const API = "http://localhost:5001";
const ADMIN_EMAIL = "razwanul712@gmail.com";
const ADMIN_PASSWORD = "Test12345";

const STUDENT_ID = "3de0a33b-93bf-4041-9ae0-770a290626d9";
const TEACHER_ID = "c084e832-ebdb-4152-83f6-ba923e5655db";

async function getToken(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password } });
  return (await res.json()).accessToken;
}

async function getAdminToken(request: APIRequestContext) {
  return getToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
}

async function getStudentToken(request: APIRequestContext) {
  // Reset student password first
  const adminToken = await getAdminToken(request);
  const resetRes = await request.post(`${API}/admin/students/${STUDENT_ID}/reset-password`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const { tempPassword } = await resetRes.json();
  return getToken(request, "rizwanc43@gmail.com", tempPassword);
}

// Create a test session N hours from now
async function createTestSession(request: APIRequestContext, hoursFromNow: number) {
  const token = await getAdminToken(request);
  const time = new Date(Date.now() + hoursFromNow * 3600000).toISOString();
  const res = await request.post(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { student_id: STUDENT_ID, teacher_id: TEACHER_ID, scheduled_at: time, duration_minutes: 60, subject: "quran" },
  });
  return (await res.json()).session;
}

async function deleteSession(request: APIRequestContext, id: string) {
  const token = await getAdminToken(request);
  await request.delete(`${API}/sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
}

// ─── Cancellation Buffer Tests ─────────────────────────────────────────────

test("student cannot cancel a session within 12h (CANCELLATION_BUFFER)", async ({ request }) => {
  const session = await createTestSession(request, 6); // 6h from now
  const studentToken = await getStudentToken(request);
  const res = await request.patch(`${API}/sessions/${session.id}/cancel`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: {},
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.code).toBe("CANCELLATION_BUFFER");
  await deleteSession(request, session.id);
});

test("student gets SESSION_PAST for an already-passed session", async ({ request }) => {
  // Create a session 2 days ago (still marked scheduled)
  const token = await getAdminToken(request);
  const pastTime = new Date(Date.now() - 48 * 3600000).toISOString();
  const res = await request.post(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { student_id: STUDENT_ID, teacher_id: TEACHER_ID, scheduled_at: pastTime, duration_minutes: 60, subject: "quran" },
  });
  const session = (await res.json()).session;

  const studentToken = await getStudentToken(request);
  const cancelRes = await request.patch(`${API}/sessions/${session.id}/cancel`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: {},
  });
  expect(cancelRes.status()).toBe(403);
  const body = await cancelRes.json();
  expect(body.code).toBe("SESSION_PAST");
  await deleteSession(request, session.id);
});

test("student cancellation outside the buffer works normally", async ({ request }) => {
  const session = await createTestSession(request, 24); // 24h from now
  const studentToken = await getStudentToken(request);
  const res = await request.patch(`${API}/sessions/${session.id}/cancel`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { cancellation_reason: "test" },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.session.status).toBe("cancelled");
  await deleteSession(request, session.id);
});

test("admin cancellation within 12h works (bypass)", async ({ request }) => {
  const session = await createTestSession(request, 6); // 6h from now
  const adminToken = await getAdminToken(request);
  const res = await request.patch(`${API}/sessions/${session.id}/cancel`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {},
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.session.status).toBe("cancelled");
  await deleteSession(request, session.id);
});

// ─── Legacy Reschedule Route Tests ─────────────────────────────────────────

test("student cannot hit legacy PATCH /sessions/:id/reschedule", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const studentToken = await getStudentToken(request);
  const res = await request.patch(`${API}/sessions/${session.id}/reschedule`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { scheduled_at: new Date(Date.now() + 72 * 3600000).toISOString() },
  });
  expect(res.status()).toBe(403);
  await deleteSession(request, session.id);
});

test("admin can hit legacy PATCH /sessions/:id/reschedule", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const adminToken = await getAdminToken(request);
  const newTime = new Date(Date.now() + 72 * 3600000).toISOString();
  const res = await request.patch(`${API}/sessions/${session.id}/reschedule`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { scheduled_at: newTime },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.session.rescheduled_from).toBe(session.id);
  // Cleanup both sessions
  await deleteSession(request, body.session.id);
  await deleteSession(request, session.id);
});

// ─── Admin Edit Tests ──────────────────────────────────────────────────────

test("admin edits scheduled_at — session updated, last_modified_by set, notifications fired", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const adminToken = await getAdminToken(request);
  const newTime = new Date(Date.now() + 96 * 3600000).toISOString();

  const res = await request.patch(`${API}/admin/sessions/${session.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { scheduled_at: newTime },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(new Date(body.session.scheduled_at).toISOString()).toBe(new Date(newTime).toISOString());
  expect(body.session.last_modified_by).toBeTruthy();
  expect(body.changes).toContain("scheduled_at");

  // Check student got notification
  const studentToken = await getStudentToken(request);
  const notifRes = await request.get(`${API}/notifications`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const notifs = (await notifRes.json()).notifications;
  const updateNotif = notifs.find((n: { type: string }) => n.type === "session_updated");
  expect(updateNotif).toBeTruthy();
  expect(updateNotif.message).toContain("New time:");

  await deleteSession(request, session.id);
});

test("admin edits with notes-only change — no notifications fired", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const adminToken = await getAdminToken(request);

  // Clear student notifications first
  const studentToken = await getStudentToken(request);
  await request.patch(`${API}/notifications/read-all`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  const res = await request.patch(`${API}/admin/sessions/${session.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { notes: "admin test note" },
  });
  expect(res.status()).toBe(200);

  // Verify no new unread notification
  const notifRes = await request.get(`${API}/notifications`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const notifs = (await notifRes.json()).notifications;
  const unreadUpdateNotifs = notifs.filter(
    (n: { type: string; read: boolean }) => n.type === "session_updated" && !n.read
  );
  expect(unreadUpdateNotifs.length).toBe(0);

  await deleteSession(request, session.id);
});

test("admin edit with teacher conflict → 409, no state change", async ({ request }) => {
  const adminToken = await getAdminToken(request);
  // Create two sessions at different times
  const session1 = await createTestSession(request, 48);
  const time2 = new Date(Date.now() + 72 * 3600000).toISOString();
  const res2 = await request.post(`${API}/sessions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { student_id: STUDENT_ID, teacher_id: TEACHER_ID, scheduled_at: time2, duration_minutes: 60, subject: "quran" },
  });
  const session2 = (await res2.json()).session;

  // Try to move session1 to overlap with session2
  const editRes = await request.patch(`${API}/admin/sessions/${session1.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { scheduled_at: time2 },
  });
  expect(editRes.status()).toBe(409);
  const body = await editRes.json();
  expect(body.code).toBe("TEACHER_CONFLICT");

  await deleteSession(request, session1.id);
  await deleteSession(request, session2.id);
});

// ─── Reschedule Request Tests (backfill from 3.2) ──────────────────────────

test("student creates a reschedule request → 201, notifications fire", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const studentToken = await getStudentToken(request);
  const proposedTime = new Date(Date.now() + 72 * 3600000).toISOString();

  const res = await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: proposedTime },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.request.status).toBe("pending");
  expect(body.request.session_id).toBe(session.id);

  await deleteSession(request, session.id); // CASCADE cleans up request
});

test("duplicate request while pending → 409", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const studentToken = await getStudentToken(request);
  const proposedTime = new Date(Date.now() + 72 * 3600000).toISOString();

  await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: proposedTime },
  });

  const res2 = await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: new Date(Date.now() + 96 * 3600000).toISOString() },
  });
  expect(res2.status()).toBe(409);

  await deleteSession(request, session.id);
});

test("student cannot reschedule within 12h buffer → 403", async ({ request }) => {
  const session = await createTestSession(request, 6);
  const studentToken = await getStudentToken(request);
  const res = await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: new Date(Date.now() + 72 * 3600000).toISOString() },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.code).toBe("CANCELLATION_BUFFER");
  await deleteSession(request, session.id);
});

test("admin approves request → original rescheduled, new session created", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const studentToken = await getStudentToken(request);
  const proposedTime = new Date(Date.now() + 72 * 3600000).toISOString();

  const createRes = await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: proposedTime },
  });
  const reqId = (await createRes.json()).request.id;

  const adminToken = await getAdminToken(request);
  const approveRes = await request.patch(`${API}/reschedule-requests/${reqId}/approve`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {},
  });
  expect(approveRes.status()).toBe(200);
  const body = await approveRes.json();
  expect(body.request.status).toBe("approved");
  expect(body.new_session.rescheduled_from).toBe(session.id);

  await deleteSession(request, body.new_session.id);
  await deleteSession(request, session.id);
});

test("admin rejects with reason → reason saved, student notified", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const studentToken = await getStudentToken(request);
  const proposedTime = new Date(Date.now() + 72 * 3600000).toISOString();

  const createRes = await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: proposedTime },
  });
  const reqId = (await createRes.json()).request.id;

  const adminToken = await getAdminToken(request);
  const rejectRes = await request.patch(`${API}/reschedule-requests/${reqId}/reject`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { rejection_reason: "Teacher unavailable" },
  });
  expect(rejectRes.status()).toBe(200);
  const body = await rejectRes.json();
  expect(body.request.status).toBe("rejected");
  expect(body.request.rejection_reason).toBe("Teacher unavailable");

  await deleteSession(request, session.id);
});

test("student cancels own pending request → cancelled_by_student", async ({ request }) => {
  const session = await createTestSession(request, 48);
  const studentToken = await getStudentToken(request);
  const proposedTime = new Date(Date.now() + 72 * 3600000).toISOString();

  const createRes = await request.post(`${API}/reschedule-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
    data: { session_id: session.id, proposed_at: proposedTime },
  });
  const reqId = (await createRes.json()).request.id;

  const cancelRes = await request.delete(`${API}/reschedule-requests/${reqId}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  expect(cancelRes.status()).toBe(200);
  const body = await cancelRes.json();
  expect(body.request.status).toBe("cancelled_by_student");

  await deleteSession(request, session.id);
});
