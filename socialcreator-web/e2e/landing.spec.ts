/**
 * E2E Tests for Landing Page
 * Tests: Page loads, navigation, key elements present
 */

import { expect, test } from "@playwright/test";
import { LandingPage } from "./pages/landing.page";

test.describe("Landing Page", () => {
  test("should load the landing page successfully", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.waitForHeading();
  });

  // Pricing page is under the (main) layout which requires authentication.
  // Without a logged-in user, it redirects to /login.
  // The pricing content itself is tested in unit/integration tests.
  test.skip("should display pricing section", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("h1")).toContainText(/pricing|plans/i, { timeout: 10000 });
  });

  test("should have working navigation to login", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickLogin();
    await expect(page).toHaveURL(/.*\/login/);
  });

  // Landing page CTA goes to /login; there is no /register link.
  // Registration flow is tested via auth.spec.ts.
  test.skip("should have working navigation to register", async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickRegister();
    await expect(page).toHaveURL(/.*\/register/);
  });

  test("should load blog page", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
  });
});
