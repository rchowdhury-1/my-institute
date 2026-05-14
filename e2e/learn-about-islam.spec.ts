/**
 * Batch D acceptance tests — Learn About Islam page
 *
 * Prerequisites:
 *   - Next.js dev server on http://localhost:3000
 *   - Backend on http://localhost:5001
 *   - Admin credentials: razwanul712@gmail.com / Test12345
 */

import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const ADMIN_EMAIL = "razwanul712@gmail.com";
const ADMIN_PASSWORD = "Test12345";

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 20_000 });
}

test.describe("Learn About Islam page", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Page loads at /learn-about-islam", async ({ page }) => {
    await page.goto(`${BASE}/learn-about-islam`);
    await expect(page.locator("h1")).toContainText("New to Islam");
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test("2. Form submission with valid data → success message + WhatsApp fires", async ({ page }) => {
    await page.goto(`${BASE}/learn-about-islam`);

    // Intercept window.open
    const whatsappCalls = await page.evaluateHandle(() => {
      const calls: string[] = [];
      window.open = (url: string | URL | undefined) => {
        calls.push(String(url ?? ""));
        return null;
      };
      return calls;
    });

    await page.fill('input[name="name"]', "[TEST] Revert Applicant");
    await page.fill('input[name="email"]', "revert@test.com");
    await page.fill('input[name="phone"]', "+447700900000");
    await page.fill('input[name="country"]', "United Kingdom");
    await page.fill('textarea[name="story"]', "I recently embraced Islam and want to learn Quran.");
    await page.click('button[type="submit"]');

    // Success message
    await expect(page.locator("text=Thank You")).toBeVisible({ timeout: 10_000 });

    // WhatsApp opened
    const calls = await whatsappCalls.jsonValue() as string[];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toContain("wa.me/201067827621");
    expect(calls[0]).toContain("Revert%20Applicant");
  });

  test("3. Form with missing required fields → inline validation errors", async ({ page }) => {
    await page.goto(`${BASE}/learn-about-islam`);
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Name is required")).toBeVisible();
    await expect(page.locator("text=Please enter a valid email")).toBeVisible();
    await expect(page.locator("text=Please enter a valid phone")).toBeVisible();
  });

  test("4. Admin can see new application in admin view", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/revert-applications`);

    await expect(page.locator("h1")).toContainText("Revert Applications");
    await expect(page.locator("text=[TEST] Revert Applicant")).toBeVisible({ timeout: 10_000 });
  });

  test("5. Admin can update application status", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/revert-applications`);
    await page.waitForSelector("text=[TEST] Revert Applicant", { timeout: 10_000 });

    // Find the card and change status
    const card = page.locator('[data-testid^="app-card-"]').filter({ hasText: "[TEST] Revert Applicant" });
    await card.locator('[data-testid="status-select"]').selectOption("contacted");

    // Reload and verify
    await page.reload();
    await page.waitForSelector("text=[TEST] Revert Applicant", { timeout: 10_000 });
    const select = page.locator('[data-testid^="app-card-"]')
      .filter({ hasText: "[TEST] Revert Applicant" })
      .locator('[data-testid="status-select"]');
    await expect(select).toHaveValue("contacted");
  });

  test("6. Page accessible from homepage and main nav", async ({ page }) => {
    // Check header nav
    await page.goto(BASE);
    const navLink = page.locator('nav a[href="/learn-about-islam"]');
    await expect(navLink).toBeVisible();

    // Check homepage banner
    const banner = page.locator('a[href="/learn-about-islam"]').first();
    await expect(banner).toBeVisible();
  });
});
