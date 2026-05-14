/**
 * Batch C acceptance tests — Newsfeed system
 *
 * Prerequisites:
 *   - Next.js dev server on http://localhost:3000
 *   - Backend on http://localhost:5001
 *   - Admin credentials: razwanul712@gmail.com / Test12345
 */

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const API = "http://localhost:5001";
const ADMIN_EMAIL = "razwanul712@gmail.com";
const ADMIN_PASSWORD = "Test12345";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 20_000 });
}

async function getAdminToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem("accessToken") ?? "");
}

async function deleteAllTestPosts(token: string) {
  // Clean up test posts via API
  const res = await fetch(`${API}/admin/newsfeed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  for (const post of data.posts ?? []) {
    if (post.title.startsWith("[TEST]")) {
      await fetch(`${API}/admin/newsfeed/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Newsfeed system", () => {
  test.describe.configure({ mode: "serial" });

  let postId: string;

  test("1. Admin creates a newsfeed post → appears in admin list and on /newsfeed", async ({ page }) => {
    await loginAsAdmin(page);
    const token = await getAdminToken(page);
    await deleteAllTestPosts(token);

    await page.goto(`${BASE}/admin/newsfeed`);
    await page.waitForSelector("h1");

    // Open create form
    await page.click("text=Add Post");
    await page.waitForSelector('[data-testid="create-form"]');

    // Fill form
    await page.selectOption('[data-testid="input-type"]', "quote");
    await page.fill('[data-testid="input-title"]', "[TEST] Quote of the Month");
    await page.fill('[data-testid="input-body"]', "The best of you are those who learn the Quran and teach it.");

    // Submit
    await page.click('[data-testid="btn-submit-create"]');

    // Wait for post to appear in admin list
    await expect(page.locator("text=[TEST] Quote of the Month")).toBeVisible({ timeout: 10_000 });

    // Get the post id from the DOM
    const card = page.locator('[data-testid^="post-card-"]').first();
    const testId = await card.getAttribute("data-testid");
    postId = testId!.replace("post-card-", "");

    // Check it appears on public /newsfeed
    await page.goto(`${BASE}/newsfeed`);
    await expect(page.locator("text=[TEST] Quote of the Month")).toBeVisible({ timeout: 10_000 });
  });

  test("2. Admin ticks 'Show on homepage' → post appears in homepage section", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/newsfeed`);
    await page.waitForSelector("text=[TEST] Quote of the Month", { timeout: 10_000 });

    // Click edit
    const card = page.locator('[data-testid^="post-card-"]').filter({ hasText: "[TEST] Quote of the Month" });
    await card.locator('[data-testid="btn-edit"]').click();

    // Tick homepage checkbox
    await page.check('[data-testid="edit-homepage"]');
    await page.click('[data-testid="btn-edit-save"]');

    // Wait for save
    await expect(page.locator('[data-testid="btn-edit"]').first()).toBeVisible({ timeout: 10_000 });

    // Check homepage
    await page.goto(BASE);
    await expect(page.locator("text=Latest from MY Institute")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=[TEST] Quote of the Month")).toBeVisible();
  });

  test("3. Admin unticks 'Show on homepage' → post disappears from homepage", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/newsfeed`);
    await page.waitForSelector("text=[TEST] Quote of the Month", { timeout: 10_000 });

    // Click edit
    const card = page.locator('[data-testid^="post-card-"]').filter({ hasText: "[TEST] Quote of the Month" });
    await card.locator('[data-testid="btn-edit"]').click();

    // Untick homepage checkbox
    await page.uncheck('[data-testid="edit-homepage"]');
    await page.click('[data-testid="btn-edit-save"]');
    await expect(page.locator('[data-testid="btn-edit"]').first()).toBeVisible({ timeout: 10_000 });

    // Check homepage — section should be hidden (no homepage posts)
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await expect(page.locator("text=Latest from MY Institute")).not.toBeVisible();
  });

  test("4. Admin edits post body → change reflects on /newsfeed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/newsfeed`);
    await page.waitForSelector("text=[TEST] Quote of the Month", { timeout: 10_000 });

    // Click edit
    const card = page.locator('[data-testid^="post-card-"]').filter({ hasText: "[TEST] Quote of the Month" });
    await card.locator('[data-testid="btn-edit"]').click();

    // Change body
    await page.fill('[data-testid="edit-body"]', "Updated body text for testing purposes.");
    await page.click('[data-testid="btn-edit-save"]');
    await expect(page.locator('[data-testid="btn-edit"]').first()).toBeVisible({ timeout: 10_000 });

    // Verify on public page
    await page.goto(`${BASE}/newsfeed`);
    await expect(page.locator("text=Updated body text for testing purposes.")).toBeVisible({ timeout: 10_000 });
  });

  test("5. Admin deletes post → gone from both admin and public", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/newsfeed`);
    await page.waitForSelector("text=[TEST] Quote of the Month", { timeout: 10_000 });

    // Click delete then confirm
    const card = page.locator('[data-testid^="post-card-"]').filter({ hasText: "[TEST] Quote of the Month" });
    await card.locator('[data-testid="btn-delete"]').click();
    await card.locator('[data-testid="btn-delete-confirm"]').click();

    // Wait for it to vanish from admin
    await expect(page.locator("text=[TEST] Quote of the Month")).not.toBeVisible({ timeout: 10_000 });

    // Verify gone from public page too
    await page.goto(`${BASE}/newsfeed`);
    await page.waitForTimeout(2000);
    await expect(page.locator("text=[TEST] Quote of the Month")).not.toBeVisible();
  });

  test("6. Homepage section hidden when zero homepage-flagged posts", async ({ page }) => {
    // Just visit homepage — no homepage-flagged posts should exist after deletion
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await expect(page.locator("text=Latest from MY Institute")).not.toBeVisible();
  });

  test("7. Non-admin user cannot access /admin/newsfeed (redirected to login)", async ({ page }) => {
    // Clear any stored auth
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.clear();
      document.cookie = "userRole=; path=/; max-age=0";
    });

    await page.goto(`${BASE}/admin/newsfeed`);
    await page.waitForURL((url) => url.href.includes("/login"), { timeout: 10_000 });
  });

  test("8. Public /newsfeed accessible without login", async ({ page }) => {
    // Clear auth
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.clear();
      document.cookie = "userRole=; path=/; max-age=0";
    });

    await page.goto(`${BASE}/newsfeed`);
    await expect(page.locator("h1")).toContainText("News & Reflections");
  });
});
