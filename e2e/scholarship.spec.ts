/**
 * Scholarship page acceptance tests
 *
 * Prerequisites:
 *   - Next.js dev server running on http://localhost:3000
 *   - Backend running on http://localhost:5000 (or 5001)
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Scholarship page", () => {
  test("page loads with form and all fields visible", async ({ page }) => {
    await page.goto(`${BASE}/scholarship`);

    // Required fields
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();

    // Optional fields
    await expect(page.locator('input[name="country"]')).toBeVisible();
    await expect(page.locator('input[name="age"]')).toBeVisible();
    await expect(page.locator('textarea[name="story"]')).toBeVisible();
    await expect(page.locator('input[name="source"]')).toBeVisible();

    // Submit button
    await expect(page.getByRole("button", { name: /submit application/i })).toBeVisible();
  });

  test("submit empty form shows required field errors", async ({ page }) => {
    await page.goto(`${BASE}/scholarship`);
    await page.getByRole("button", { name: /submit application/i }).click();

    // Should show validation errors for required fields
    await expect(page.locator("text=Full name is required")).toBeVisible();
    await expect(page.locator("text=Please enter a valid email")).toBeVisible();
    await expect(page.locator("text=Please enter a valid phone")).toBeVisible();
  });

  test("submit valid form with all fields → success message + WhatsApp URL", async ({ page }) => {
    await page.goto(`${BASE}/scholarship`);

    // Fill all fields
    await page.fill('input[name="fullName"]', "Test Student");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="phone"]', "+447700900000");
    await page.fill('input[name="country"]', "United Kingdom");
    await page.fill('input[name="age"]', "22");
    await page.fill('textarea[name="story"]', "I want to learn Quran but cannot afford lessons.");
    await page.fill('input[name="source"]', "Facebook");

    // Intercept window.open to capture WhatsApp URL
    const whatsappUrl = await page.evaluateHandle(() => {
      const calls: string[] = [];
      window.open = (url: string | URL | undefined) => {
        calls.push(String(url ?? ""));
        return null;
      };
      return calls;
    });

    await page.getByRole("button", { name: /submit application/i }).click();

    // Wait for success message
    await expect(page.locator("text=Application Received")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=JazakAllahu Khairan")).toBeVisible();

    // Verify WhatsApp URL was opened with the user's name
    const calls = await whatsappUrl.jsonValue() as string[];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toContain("wa.me/201067827621");
    expect(calls[0]).toContain("Test%20Student");
  });

  test("submit valid form with only required fields → success + 'Not provided' in WhatsApp", async ({ page }) => {
    await page.goto(`${BASE}/scholarship`);

    await page.fill('input[name="fullName"]', "Required Only");
    await page.fill('input[name="email"]', "required@test.com");
    await page.fill('input[name="phone"]', "+201234567890");

    const whatsappUrl = await page.evaluateHandle(() => {
      const calls: string[] = [];
      window.open = (url: string | URL | undefined) => {
        calls.push(String(url ?? ""));
        return null;
      };
      return calls;
    });

    await page.getByRole("button", { name: /submit application/i }).click();

    await expect(page.locator("text=Application Received")).toBeVisible({ timeout: 10_000 });

    const calls = await whatsappUrl.jsonValue() as string[];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toContain("Not%20provided");
  });

  test("network failure → inline error, no WhatsApp, form stays editable", async ({ page }) => {
    await page.goto(`${BASE}/scholarship`);

    // Block the API call
    await page.route("**/scholarship-apply", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
    );

    const whatsappUrl = await page.evaluateHandle(() => {
      const calls: string[] = [];
      window.open = (url: string | URL | undefined) => {
        calls.push(String(url ?? ""));
        return null;
      };
      return calls;
    });

    await page.fill('input[name="fullName"]', "Error Test");
    await page.fill('input[name="email"]', "error@test.com");
    await page.fill('input[name="phone"]', "+441234567890");
    await page.getByRole("button", { name: /submit application/i }).click();

    // Error message should appear
    await expect(page.locator(".bg-red-50")).toBeVisible({ timeout: 10_000 });

    // WhatsApp should NOT have opened
    const calls = await whatsappUrl.jsonValue() as string[];
    expect(calls.length).toBe(0);

    // Form should still be editable
    await expect(page.locator('input[name="fullName"]')).toBeEditable();
    await expect(page.getByRole("button", { name: /submit application/i })).toBeVisible();
  });
});
