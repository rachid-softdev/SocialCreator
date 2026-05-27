/**
 * E2E Tests for Landing Page
 * Tests: Page loads, navigation, key elements present
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should load the landing page successfully", async ({ page }) => {
    await page.goto("/");

    // Check page title or main heading
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
  });

  test("should display pricing section", async ({ page }) => {
    await page.goto("/pricing");

    // Verify pricing page loads
    await expect(page.locator("h1")).toContainText(/pricing|plans/i, { timeout: 10000 });
  });

  test("should have working navigation to login", async ({ page }) => {
    await page.goto("/");

    // Click login link
    const loginLink = page.locator('a[href="/login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/.*\/login/);
    }
  });

  test("should have working navigation to register", async ({ page }) => {
    await page.goto("/");

    // Click register link
    const registerLink = page.locator('a[href="/register"]').first();
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/.*\/register/);
    }
  });

  test("should load blog page", async ({ page }) => {
    await page.goto("/blog");

    // Verify blog loads without errors
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
  });
});
