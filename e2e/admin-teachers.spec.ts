/**
 * Step 3 acceptance tests — /admin/teachers page
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Backend running on http://localhost:5001
 *   - Admin credentials: ridwancodes@gmail.com / Test12345
 */

import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = "razwanul712@gmail.com";
const ADMIN_PASSWORD = "Test12345";
const BASE = "http://localhost:3000";

// ── Helper: log in as admin and navigate to /admin/teachers ─────────────────

async function loginAndNavigate(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait until redirected away from /login
  await page.waitForURL((url) => !url.href.includes("/login"), {
    timeout: 10_000,
  });
  await page.goto(`${BASE}/admin/teachers`);
  await page.waitForURL((url) => url.href.includes("/admin/teachers"), {
    timeout: 5_000,
  });
  // Wait for loading spinner to disappear (content starts at pt-24 = 96px, well below fixed nav)
  await page.waitForSelector('[data-testid="empty-no-teachers"], .space-y-4, [data-testid="empty-no-results"]', {
    timeout: 10_000,
  });
}

/** Click a potentially off-screen element by scrolling it into view, then clicking */
async function safeClick(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

// ── Unique email per run ─────────────────────────────────────────────────────

function uniqueEmail(prefix = "playwright") {
  return `${prefix}+${Date.now()}@test-mi.dev`;
}

// ────────────────────────────────────────────────────────────────────────────

test.describe("Admin Teachers Page", () => {

  // ── T1: Redirect unauthenticated users to /login ─────────────────────────

  test("T1: redirects to /login when not authenticated", async ({ page }) => {
    // Clear any stored auth state
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
    });

    await page.goto(`${BASE}/admin/teachers`);
    await page.waitForURL((url) => url.href.includes("/login"), {
      timeout: 5_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  // ── T2: Redirect non-admin users to /login ────────────────────────────────

  test("T2: redirects to /login when logged in as student", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // Inject a fake student token directly into localStorage
    await page.evaluate(() => {
      localStorage.setItem("accessToken", "fake-student-token");
      localStorage.setItem("userRole", "student");
    });

    await page.goto(`${BASE}/admin/teachers`);
    await page.waitForURL((url) => url.href.includes("/login"), {
      timeout: 5_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  // ── T3: Page renders header and stats for admin ───────────────────────────

  test("T3: shows Teachers heading and stats pills", async ({ page }) => {
    await loginAndNavigate(page);

    await expect(page.locator("h1")).toHaveText("Teachers");
    await expect(page.locator("text=Manage teacher accounts.")).toBeVisible();
    // Stats pills should be visible
    await expect(page.locator("text=total").first()).toBeVisible();
    await expect(page.locator("text=active").first()).toBeVisible();
  });

  // ── T4: Empty state when no teachers exist ────────────────────────────────

  test("T4: shows empty state text when no teachers", async ({ page }) => {
    await loginAndNavigate(page);

    const noTeachers = page.locator('[data-testid="empty-no-teachers"]');
    const hasList = page.locator(".space-y-4");

    const emptyVisible = await noTeachers.isVisible().catch(() => false);
    const listVisible = await hasList.isVisible().catch(() => false);

    if (!listVisible) {
      // No teachers in DB — verify empty state copy
      await expect(noTeachers).toBeVisible();
      await expect(
        page.locator("text=No teachers yet. Add your first teacher above.")
      ).toBeVisible();
    } else {
      // Teachers exist — this test passes by skipping the empty-state check
      test.info().annotations.push({
        type: "note",
        description: "Teachers already exist; empty-state check skipped",
      });
      expect(listVisible || emptyVisible).toBe(true);
    }
  });

  // ── T5: Create teacher — success, banner with temp password ───────────────

  test("T5: creates a teacher and shows success banner with temp password", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    const email = uniqueEmail("t5");

    // Open form
    await safeClick(page, "text=Add Teacher");
    await expect(page.locator('[data-testid="create-form"]')).toBeVisible();

    // Fill form
    await page.fill('[data-testid="input-display-name"]', "Playwright Teacher Five");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-phone"]', "+44 7700 000005");
    await page.fill('[data-testid="input-specialisation"]', "Tajweed");

    // Use "Generate for me" to get a password
    await page.click('[data-testid="btn-generate-password"]');
    // Password field should now have a value
    const pwVal = await page
      .locator('[data-testid="input-temp-password"]')
      .inputValue();
    expect(pwVal.length).toBeGreaterThan(8);

    // Submit
    await page.click('[data-testid="btn-submit-create"]');

    // Banner should appear
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator("text=Playwright Teacher Five has been added.")
    ).toBeVisible();

    // Temp password shown
    const shownPw = await page
      .locator('[data-testid="temp-password"]')
      .textContent();
    expect(shownPw?.length).toBeGreaterThan(0);

    // Create form should be gone
    await expect(page.locator('[data-testid="create-form"]')).not.toBeVisible();

    // New card should appear at the top of the list
    await expect(
      page.locator(".space-y-4").locator("text=Playwright Teacher Five").first()
    ).toBeVisible();
  });

  // ── T6: Create teacher — 409 duplicate email ──────────────────────────────

  test("T6: shows conflict error when email already exists", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    // Create once
    const email = uniqueEmail("t6");
    await safeClick(page, "text=Add Teacher");
    await page.fill('[data-testid="input-display-name"]', "T6 First");
    await page.fill('[data-testid="input-email"]', email);
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-testid="btn-dismiss-success"]').click(); // dismiss

    // Try to create again with the same email
    await safeClick(page, "text=Add Teacher");
    await page.fill('[data-testid="input-display-name"]', "T6 Duplicate");
    await page.fill('[data-testid="input-email"]', email);
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="create-error"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator(
        "text=Someone with this email address already exists."
      )
    ).toBeVisible();
  });

  // ── T7: Search filters by name/email ──────────────────────────────────────

  test("T7: search filters teacher list", async ({ page }) => {
    await loginAndNavigate(page);

    // Ensure there's at least one teacher (create one if list is empty)
    const emptyState = page.locator('[data-testid="empty-no-teachers"]');
    if (await emptyState.isVisible().catch(() => false)) {
      await safeClick(page, "text=Add Teacher");
      await page.fill('[data-testid="input-display-name"]', "Searchable Teacher");
      await page.fill('[data-testid="input-email"]', uniqueEmail("searchable"));
      await page.click('[data-testid="btn-generate-password"]');
      await page.click('[data-testid="btn-submit-create"]');
      await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 10_000 });
    }

    // Search for something that won't match any teacher
    await page.fill('[data-testid="search-input"]', "zzz_no_match_xyzzy");
    await expect(
      page.locator('[data-testid="empty-no-results"]')
    ).toBeVisible();
    await expect(
      page.locator("text=No teachers match your search.")
    ).toBeVisible();

    // Clear search — list returns
    await page.fill('[data-testid="search-input"]', "");
    await expect(
      page.locator('[data-testid="empty-no-results"]')
    ).not.toBeVisible();
  });

  // ── T8: Edit teacher inline ───────────────────────────────────────────────

  test("T8: edit teacher inline and card updates", async ({ page }) => {
    await loginAndNavigate(page);

    // Create a teacher to edit
    const email = uniqueEmail("t8");
    await safeClick(page, "text=Add Teacher");
    await page.fill('[data-testid="input-display-name"]', "T8 Original Name");
    await page.fill('[data-testid="input-email"]', email);
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 10_000 });

    // Click Edit on the first card
    await page.locator('[data-testid="btn-edit"]').first().click();

    // Edit form should be visible
    await expect(page.locator('[data-testid="edit-display-name"]').first()).toBeVisible();

    // Change the name
    await page.locator('[data-testid="edit-display-name"]').first().fill("T8 Updated Name");
    await page.locator('[data-testid="btn-edit-save"]').first().click();

    // Card should update
    await expect(page.locator("text=T8 Updated Name").first()).toBeVisible({
      timeout: 8_000,
    });
    // Edit form should be gone
    await expect(page.locator('[data-testid="edit-display-name"]').first()).not.toBeVisible();
  });

  // ── T9: "Awaiting first login" badge on newly created teacher ─────────────

  test("T9: newly created teacher shows Awaiting first login badge", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    const email = uniqueEmail("t9");
    await safeClick(page, "text=Add Teacher");
    await page.fill('[data-testid="input-display-name"]', "T9 Awaiting");
    await page.fill('[data-testid="input-email"]', email);
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 10_000 });

    // The card for T9 should show the amber badge
    await expect(
      page.locator('[data-testid="badge-awaiting-login"]').first()
    ).toBeVisible();
  });

  // ── T10: Reset password — confirm flow, banner with new temp password ──────

  test("T10: reset password shows confirm panel then success banner", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    // Ensure a teacher exists
    const listVisible = await page.locator(".space-y-4").isVisible().catch(() => false);
    if (!listVisible) {
      await safeClick(page, "text=Add Teacher");
      await page.fill('[data-testid="input-display-name"]', "T10 Reset Teacher");
      await page.fill('[data-testid="input-email"]', uniqueEmail("t10"));
      await page.click('[data-testid="btn-generate-password"]');
      await page.click('[data-testid="btn-submit-create"]');
      await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 10_000 });
      await page.locator('[data-testid="success-banner"] button').click();
    }

    // Click Reset password on first card
    await page.locator('[data-testid="btn-reset-password"]').first().click();

    // Confirm panel appears
    await expect(
      page.locator('[data-testid="reset-confirm-panel"]').first()
    ).toBeVisible();

    // Confirm
    await page.locator('[data-testid="btn-reset-confirm"]').first().click();

    // Reset banner appears
    await expect(page.locator('[data-testid="reset-banner"]')).toBeVisible({
      timeout: 10_000,
    });
    const newPw = await page
      .locator('[data-testid="reset-temp-password"]')
      .textContent();
    expect(newPw?.length).toBeGreaterThan(0);
  });

  // ── T11: Turn off access — confirm then badge changes to Turned off ────────

  test("T11: deactivate teacher updates badge to Turned off", async ({
    page,
  }) => {
    await loginAndNavigate(page);

    // Create a fresh teacher to deactivate (so we don't deactivate important ones)
    const email = uniqueEmail("t11");
    await safeClick(page, "text=Add Teacher");
    await page.fill('[data-testid="input-display-name"]', "T11 Deactivate Me");
    await page.fill('[data-testid="input-email"]', email);
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="btn-dismiss-success"]').click();

    // Find the card for this teacher and click Turn off access
    const card = page.locator(".space-y-4 > div").filter({ hasText: "T11 Deactivate Me" }).first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('[data-testid="btn-deactivate"]').click();

    // Confirm panel
    await expect(card.locator('[data-testid="deactivate-confirm-panel"]')).toBeVisible();

    // Confirm
    await card.locator('[data-testid="btn-deactivate-confirm"]').click();

    // Badge should change to "Turned off"
    await expect(card.locator('[data-testid="badge-turned-off"]')).toBeVisible({
      timeout: 8_000,
    });

    // Action buttons should be gone (teacher is inactive)
    await expect(card.locator('[data-testid="btn-edit"]')).not.toBeVisible();
  });
});
