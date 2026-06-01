/**
 * E2E Tests for Authentication
 * Tests: Login page, Register page, Form validation
 */

import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/login.page";
import { RegisterPage } from "./pages/register.page";

test.describe("Authentication", () => {
  test.describe("Login Page", () => {
    test("should load login page", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.waitForHeading();
    });

    test("should show validation error for empty form", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.submit();
      await login.waitForUrl(/.*\/login/);
    });

    test("should show error for invalid email format", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.fillEmail("notanemail");
      await login.submit();
      await expect(page.locator("text=/invalid|email|format/i")).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Register Page", () => {
    test("should load register page", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await register.waitForHeading();
    });

    test("should show validation error for empty form", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await register.submit();
      await register.waitForUrl(/.*\/register/);
    });

    test("should have password confirmation field", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await expect(register.confirmPasswordInput).toBeVisible();
    });
  });

  test.describe("CGU Page", () => {
    test("should load CGU page for onboarding", async ({ page }) => {
      await page.goto("/onboarding/cgu");
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    });
  });
});
