/**
 * Auth/login regression tests — kept separate from reschedule-and-buffer.spec.ts
 * so that file's one reason to change stays scoped to reschedule/cancellation-
 * buffer behavior (audit2 F79).
 */

import { test, expect } from "@playwright/test";
import { API, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

test("duplicate login requests don't crash (refresh token idempotency)", async ({ request }) => {
  const [r1, r2] = await Promise.all([
    request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
    request.post(`${API}/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    }),
  ]);
  expect(r1.status()).toBe(200);
  expect(r2.status()).toBe(200);
  expect((await r1.json()).accessToken).toBeTruthy();
  expect((await r2.json()).accessToken).toBeTruthy();
});
