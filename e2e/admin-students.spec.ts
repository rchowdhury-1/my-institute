/**
 * Step 4 acceptance tests — /admin/students page
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Backend running on http://localhost:5001
 */

import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error(
    "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD env vars before running these tests.",
  );
}
const BASE = "http://localhost:3000";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function loginAndNavigate(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 20_000 });
  await page.goto(`${BASE}/admin/students`);
  await page.waitForURL((url) => url.href.includes("/admin/students"), { timeout: 5_000 });
  await page.waitForSelector(
    '[data-testid="empty-no-students"], .space-y-4, [data-testid="empty-no-results"]',
    { timeout: 10_000 }
  );
}

async function safeClick(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

function uniqueEmail(prefix = "s") {
  return `${prefix}+${Date.now()}@test-mi.dev`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Admin Students Page", () => {

  // T1: Auth — unauthenticated redirect
  test("T1: redirects to /login when not authenticated", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userRole");
    });
    await page.goto(`${BASE}/admin/students`);
    await page.waitForURL((url) => url.href.includes("/login"), { timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  // T2: Auth — non-admin redirect
  test("T2: redirects to /login when logged in as student role", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.setItem("accessToken", "fake-token");
      localStorage.setItem("userRole", "student");
    });
    await page.goto(`${BASE}/admin/students`);
    await page.waitForURL((url) => url.href.includes("/login"), { timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  // T3: Page renders heading, subtitle, stats
  test("T3: shows Students heading and stats pills", async ({ page }) => {
    await loginAndNavigate(page);
    await expect(page.locator("h1")).toHaveText("Students");
    await expect(page.locator("text=Manage student accounts.")).toBeVisible();
    await expect(page.locator("text=total").first()).toBeVisible();
    await expect(page.locator("text=active").first()).toBeVisible();
  });

  // T4: Empty state
  test("T4: shows empty state when no students exist", async ({ page }) => {
    await loginAndNavigate(page);
    const emptyEl = page.locator('[data-testid="empty-no-students"]');
    const listEl = page.locator(".space-y-4");
    const hasStudents = await listEl.isVisible().catch(() => false);
    if (!hasStudents) {
      await expect(emptyEl).toBeVisible();
      await expect(page.locator("text=No students yet. Add your first student above.")).toBeVisible();
    } else {
      test.info().annotations.push({ type: "note", description: "Students already exist; skipping empty-state assertion" });
      expect(hasStudents).toBe(true);
    }
  });

  // T5: Create student — success, re-fetch, banner with temp password
  test("T5: creates a student and shows success banner with temp password", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t5");

    await safeClick(page, '[data-testid="btn-add-student"]');
    await expect(page.locator('[data-testid="create-form"]')).toBeVisible();

    await page.fill('[data-testid="input-display-name"]', "Playwright Student Five");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "25");
    await page.click('[data-testid="btn-generate-password"]');

    const pw = await page.locator('[data-testid="input-temp-password"]').inputValue();
    expect(pw.length).toBeGreaterThan(8);

    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=Playwright Student Five has been added.")).toBeVisible();

    const shownPw = await page.locator('[data-testid="temp-password"]').textContent();
    expect(shownPw?.length).toBeGreaterThan(0);

    // Create form collapsed
    await expect(page.locator('[data-testid="create-form"]')).not.toBeVisible();

    // Card exists in list (re-fetch happened)
    await expect(
      page.locator(".space-y-4").locator("text=Playwright Student Five").first()
    ).toBeVisible();
  });

  // T6: Create — 409 duplicate email
  test("T6: shows conflict error when email already exists", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t6");

    // First create
    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T6 First");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "20");
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="btn-dismiss-success"]').click();

    // Duplicate
    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T6 Duplicate");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "20");
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="create-error"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Someone with this email address already exists.")).toBeVisible();
  });

  // T7: Search filters list
  test("T7: search filters student list and shows no-results state", async ({ page }) => {
    await loginAndNavigate(page);

    // Ensure at least one student exists
    const empty = page.locator('[data-testid="empty-no-students"]');
    if (await empty.isVisible().catch(() => false)) {
      await safeClick(page, '[data-testid="btn-add-student"]');
      await page.fill('[data-testid="input-display-name"]', "Search Test Student");
      await page.fill('[data-testid="input-email"]', uniqueEmail("search"));
      await page.fill('[data-testid="input-hourly-rate"]', "15");
      await page.click('[data-testid="btn-generate-password"]');
      await page.click('[data-testid="btn-submit-create"]');
      await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    }

    await page.fill('[data-testid="search-input"]', "zzz_no_match_xyzzy");
    await expect(page.locator('[data-testid="empty-no-results"]')).toBeVisible();
    await expect(page.locator("text=No students match your search.")).toBeVisible();

    await page.fill('[data-testid="search-input"]', "");
    await expect(page.locator('[data-testid="empty-no-results"]')).not.toBeVisible();
  });

  // T8: Edit student inline — card updates
  test("T8: edit student inline and card updates", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t8");

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T8 Original Name");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "30");
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });

    // Click Edit on the newly created card
    const card = page.locator(".space-y-4 > div").filter({ hasText: "T8 Original Name" }).first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('[data-testid="btn-edit"]').click();

    await expect(card.locator('[data-testid="edit-display-name"]')).toBeVisible();
    await card.locator('[data-testid="edit-display-name"]').fill("T8 Updated Name");
    await card.locator('[data-testid="btn-edit-save"]').click();

    // Edit form closes (save succeeded)
    await expect(card.locator('[data-testid="edit-display-name"]')).not.toBeVisible({ timeout: 8_000 });
    // Updated name appears in a heading on the page
    await expect(page.locator("h3").filter({ hasText: "T8 Updated Name" }).first()).toBeVisible();
  });

  // T9: Newly created student shows rate pill and Awaiting first login badge
  test("T9: newly created student shows rate pill and Awaiting first login badge", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t9");

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T9 Rate Check");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "40");
    // GBP is the default
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });

    const card = page.locator(".space-y-4 > div").filter({ hasText: "T9 Rate Check" }).first();
    await card.scrollIntoViewIfNeeded();

    await expect(card.locator('[data-testid="badge-awaiting-login"]')).toBeVisible();
    await expect(card.locator('[data-testid="rate-pill"]')).toContainText("£40");
  });

  // T10: Reset password — confirm panel → banner with new temp password
  test("T10: reset password shows confirm panel then success banner", async ({ page }) => {
    await loginAndNavigate(page);

    // Always create our own disposable student for this test — never assume
    // the list is empty and fall back to "first card", which (with real
    // students already in production) would reset a real student's password.
    const email = uniqueEmail("t10");
    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T10 Reset Student");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "20");
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="btn-dismiss-success"]').click();

    // Scope every action to this specific student's card, not ".first()"
    const card = page.locator('[data-testid^="student-card-"]').filter({ hasText: email });
    await card.scrollIntoViewIfNeeded();
    await card.locator('[data-testid="btn-reset-password"]').click();

    await expect(card.locator('[data-testid="reset-confirm-panel"]')).toBeVisible();
    await card.locator('[data-testid="btn-reset-confirm"]').click();

    await expect(page.locator('[data-testid="reset-banner"]')).toBeVisible({ timeout: 10_000 });
    const newPw = await page.locator('[data-testid="reset-temp-password"]').textContent();
    expect(newPw?.length).toBeGreaterThan(0);
  });

  // T11: Turn off access — confirm panel → Turned off badge
  test("T11: deactivate student updates badge to Turned off", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t11");

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T11 Deactivate Student");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "25");
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="btn-dismiss-success"]').click();

    const card = page.locator(".space-y-4 > div").filter({ hasText: "T11 Deactivate Student" }).first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('[data-testid="btn-deactivate"]').click();

    await expect(card.locator('[data-testid="deactivate-confirm-panel"]')).toBeVisible();
    await card.locator('[data-testid="btn-deactivate-confirm"]').click();

    await expect(card.locator('[data-testid="badge-turned-off"]')).toBeVisible({ timeout: 8_000 });
    await expect(card.locator('[data-testid="btn-edit"]')).not.toBeVisible();
  });

  // T11b: Reactivate — turn deactivated student back on
  test("T11b: reactivate student restores Active badge and action buttons", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t11b");

    // Create and deactivate
    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T11b Reactivate Student");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "25");
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="btn-dismiss-success"]').click();

    const card = page.locator(".space-y-4 > div").filter({ hasText: "T11b Reactivate Student" }).first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('[data-testid="btn-deactivate"]').click();
    await card.locator('[data-testid="btn-deactivate-confirm"]').click();
    await expect(card.locator('[data-testid="badge-turned-off"]')).toBeVisible({ timeout: 8_000 });

    // Reactivate
    await expect(card.locator('[data-testid="btn-reactivate"]')).toBeVisible();
    await card.locator('[data-testid="btn-reactivate"]').click();
    await expect(card.locator('[data-testid="reactivate-confirm-panel"]')).toBeVisible();
    await card.locator('[data-testid="btn-reactivate-confirm"]').click();

    await expect(card.locator('[data-testid="badge-active"]')).toBeVisible({ timeout: 8_000 });
    await expect(card.locator('[data-testid="btn-edit"]')).toBeVisible();
    await expect(card.locator('[data-testid="btn-deactivate"]')).toBeVisible();
  });

  // ── Student-specific criteria ─────────────────────────────────────────────

  // T12: Create with prepaid bundle — bundle pill renders correctly
  test("T12: bundle pill shows lessons remaining and expiry date after create", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t12");

    // Pick a future date (2 years out) in YYYY-MM-DD
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const yyyy = futureDate.getFullYear();
    const mm = String(futureDate.getMonth() + 1).padStart(2, "0");
    const dd = String(futureDate.getDate()).padStart(2, "0");
    const expiryInput = `${yyyy}-${mm}-${dd}`;

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T12 Bundle Student");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "20");
    // Bundle fields
    await page.fill('[data-testid="input-package-name"]', "Starter pack");
    await page.fill('[data-testid="input-total-lessons"]', "10");
    await page.fill('[data-testid="input-expires-at"]', expiryInput);
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });

    const card = page.locator(".space-y-4 > div").filter({ hasText: "T12 Bundle Student" }).first();
    await card.scrollIntoViewIfNeeded();

    // "10 lessons remaining · expires DD MMM YYYY"
    const bundleInfo = card.locator('[data-testid="bundle-info"]');
    await expect(bundleInfo).toBeVisible();
    await expect(bundleInfo).toContainText("10 lessons remaining");
    await expect(bundleInfo).toContainText("expires");
    // Date should contain the year we set
    await expect(bundleInfo).toContainText(String(yyyy));
  });

  // T13: Create with PARTIAL bundle — inline error contains "all three fields"
  test("T13: partial bundle fields produce all-three-fields error", async ({ page }) => {
    await loginAndNavigate(page);

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T13 Partial Bundle");
    await page.fill('[data-testid="input-email"]', uniqueEmail("t13"));
    await page.fill('[data-testid="input-hourly-rate"]', "20");
    // Fill only 2 of 3 bundle fields — no expiry
    await page.fill('[data-testid="input-package-name"]', "Half pack");
    await page.fill('[data-testid="input-total-lessons"]', "5");
    // expires_at intentionally left blank
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="create-error"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="create-error"]')).toContainText("all");
  });

  // T14: hourly_rate = 0 fails server-side > 0 validation → inline error
  // (blank field triggers native HTML5 required; use 0 to exercise the server error path)
  test("T14: zero hourly rate produces inline error about rate", async ({ page }) => {
    await loginAndNavigate(page);

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T14 Zero Rate");
    await page.fill('[data-testid="input-email"]', uniqueEmail("t14"));
    await page.fill('[data-testid="input-hourly-rate"]', "0");  // passes required, fails > 0
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="create-error"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="create-error"]')).toContainText(/rate/i);
  });

  // T15: Legacy rate flag — card pill shows "£7.00/hour · Legacy"
  test("T15: legacy flag ticked shows rate pill with Legacy label", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t15");

    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T15 Legacy Student");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "7");
    // Tick legacy pricing
    await page.check('[data-testid="checkbox-legacy"]');
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');

    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });

    const card = page.locator(".space-y-4 > div").filter({ hasText: "T15 Legacy Student" }).first();
    await card.scrollIntoViewIfNeeded();

    const ratePill = card.locator('[data-testid="rate-pill"]');
    await expect(ratePill).toContainText("£7.00/hour");
    await expect(ratePill).toContainText("Legacy");
  });

  // T16: Edit student → toggle legacy off → pill loses Legacy label
  test("T16: editing legacy flag off removes Legacy from rate pill", async ({ page }) => {
    await loginAndNavigate(page);
    const email = uniqueEmail("t16");

    // Create with legacy ON
    await safeClick(page, '[data-testid="btn-add-student"]');
    await page.fill('[data-testid="input-display-name"]', "T16 Toggle Legacy");
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-hourly-rate"]', "12");
    await page.check('[data-testid="checkbox-legacy"]');
    await page.click('[data-testid="btn-generate-password"]');
    await page.click('[data-testid="btn-submit-create"]');
    await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="btn-dismiss-success"]').click();

    const card = page.locator(".space-y-4 > div").filter({ hasText: "T16 Toggle Legacy" }).first();
    await card.scrollIntoViewIfNeeded();

    // Confirm Legacy is visible before edit
    await expect(card.locator('[data-testid="rate-pill"]')).toContainText("Legacy");

    // Edit — once edit form opens the card's visible text changes to "Edit student",
    // so use page-level locators for the form fields
    await card.locator('[data-testid="btn-edit"]').click();
    const editLegacy = page.locator('[data-testid="edit-legacy"]').first();
    await expect(editLegacy).toBeVisible();
    await editLegacy.uncheck();
    await page.locator('[data-testid="btn-edit-save"]').first().click();

    // Edit form closes; find the card again by the h3 now restored
    const updatedCard = page.locator(".space-y-4 > div").filter({
      has: page.locator('h3', { hasText: "T16 Toggle Legacy" }),
    }).first();
    await expect(updatedCard.locator('[data-testid="edit-display-name"]')).not.toBeVisible({ timeout: 8_000 });
    await expect(updatedCard.locator('[data-testid="rate-pill"]')).not.toContainText("Legacy");
  });

  // T17: Create form teacher dropdown is populated with active teachers
  test("T17: create form teacher dropdown is populated with active teachers", async ({ page }) => {
    await loginAndNavigate(page);

    await safeClick(page, '[data-testid="btn-add-student"]');
    await expect(page.locator('[data-testid="create-form"]')).toBeVisible();

    const select = page.locator('[data-testid="input-teacher"]');
    await expect(select).toBeVisible();

    // Should have at least one option beyond "— Not assigned —"
    const optionCount = await select.locator("option").count();
    expect(optionCount).toBeGreaterThan(1);

    // First option is the placeholder
    const firstOption = await select.locator("option").first().textContent();
    expect(firstOption).toContain("Not assigned");

    // At least one non-placeholder option exists (an active teacher)
    const secondOption = await select.locator("option").nth(1).textContent();
    expect(secondOption?.trim().length).toBeGreaterThan(0);
  });
});
