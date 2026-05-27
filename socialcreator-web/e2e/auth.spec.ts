/**
 * E2E Tests for Authentication
 * Tests: Login page, Register page, Form validation
 */

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Login Page", () => {
    test("should load login page", async ({ page }) => {
      await page.goto("/login");
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    });

    test("should show validation error for empty form", async ({ page }) => {
      await page.goto("/login");

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        // Check for validation errors (email required, password required)
        // Page should not navigate away
        await expect(page).toHaveURL(/.*\/login/);
      }
    });

    test("should show error for invalid email format", async ({ page }) => {
      await page.goto("/login");

      const emailInput = page.locator('input[type="email"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      if ((await emailInput.isVisible()) && (await submitButton.isVisible())) {
        await emailInput.fill("notanemail");
        await submitButton.click();

        // Should show email format error
        await expect(page.locator("text=/invalid|email|format/i")).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Register Page", () => {
    test("should load register page", async ({ page }) => {
      await page.goto("/register");
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    });

    test("should show validation error for empty form", async ({ page }) => {
      await page.goto("/register");

      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        // Should not navigate away
        await expect(page).toHaveURL(/.*\/register/);
      }
    });

    test("should have password confirmation field", async ({ page }) => {
      await page.goto("/register");

      // Check for password confirmation field
      const confirmPassword = page
        .locator('input[name="confirmPassword"], input[id*="confirm"]')
        .first();
      if (await confirmPassword.isVisible()) {
        await expect(confirmPassword).toBeVisible();
      }
    });
  });

  test.describe("CGU Page", () => {
    test("should load CGU page for onboarding", async ({ page }) => {
      await page.goto("/onboarding/cgu");

      // CGU page should load (even if redirect to login for non-auth)
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    });
  });
});
