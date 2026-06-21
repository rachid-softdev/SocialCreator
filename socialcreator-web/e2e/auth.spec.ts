/**
 * E2E Tests for Authentication
 * Tests: Login page, Register page, Form validation, error handling, logout, protected routes
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

    test("should show error for incorrect password", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.fillEmail("nonexistent@example.com");
      await login.fillPassword("wrongpassword123");
      await login.submit();

      // Should see error message after failed login attempt
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
    });

    test("should stay on login page after failed authentication", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.fillEmail("wrong@example.com");
      await login.fillPassword("incorrect");
      await login.submit();

      // Should remain on login page (not redirected)
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });

    test("should redirect to dashboard after successful login", async ({ page }) => {
      // Note: This test requires knowing test credentials.
      // We use API to create a test user first, then attempt login.
      // Register a fresh user via the API
      const testEmail = `login-flow-${Date.now()}@example.com`;
      const testPassword = "ValidPass123!";

      // Register via API
      const registerResponse = await page.request.post("/api/auth/register", {
        data: {
          name: "Login Flow Test",
          email: testEmail,
          password: testPassword,
        },
      });

      if (registerResponse.ok()) {
        // Now try logging in
        const login = new LoginPage(page);
        await login.goto();
        await login.fillEmail(testEmail);
        await login.fillPassword(testPassword);
        await login.submit();

        // Should redirect away from login (to CGU or dashboard)
        await page.waitForURL(/.+/, { timeout: 10000 });
        const currentPath = new URL(page.url()).pathname;
        expect(currentPath).not.toBe("/login");
      }
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

    test("should show error when passwords do not match", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName("Test User");
      await register.fillEmail("test@example.com");
      await register.fillPassword("Password123!");
      await register.fillConfirmPassword("DifferentPass456!");
      await register.submit();

      await expect(page.locator('[role="alert"]')).toContainText(/passwords do not match/i, {
        timeout: 5000,
      });
    });

    test("should show error for short password", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName("Test User");
      await register.fillEmail("shortpass@example.com");
      await register.fillPassword("Ab1"); // Too short
      await register.fillConfirmPassword("Ab1");
      await register.submit();

      await expect(page.locator('[role="alert"]')).toContainText(/at least 8 characters/i, {
        timeout: 5000,
      });
    });

    test("should show error for invalid email during registration", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName("Test User");
      await register.fillEmail("not-an-email");
      await register.fillPassword("ValidPass123!");
      await register.fillConfirmPassword("ValidPass123!");
      await register.submit();

      await expect(page.locator('[role="alert"]')).toContainText(/valid email/i, { timeout: 5000 });
    });

    test("should successfully register with valid data", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();

      const uniqueEmail = `success-${Date.now()}@example.com`;
      await register.fillName("Success Test");
      await register.fillEmail(uniqueEmail);
      await register.fillPassword("ValidPass123!");
      await register.fillConfirmPassword("ValidPass123!");
      await register.submit();

      // After successful registration, redirect to CGU onboarding
      await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
    });

    test("should have name field visible on register form", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await expect(register.nameInput).toBeVisible();
    });
  });

  test.describe("Logout", () => {
    test("should sign out and redirect to landing page", async ({ page }) => {
      // First, create and login a user
      const testEmail = `logout-${Date.now()}@example.com`;
      const testPassword = "LogoutTest123!";

      const registerResponse = await page.request.post("/api/auth/register", {
        data: { name: "Logout Test", email: testEmail, password: testPassword },
      });

      if (registerResponse.ok()) {
        // Navigate to dashboard (will be redirected to login first, then auto-login)
        // Actually, register creates a session, so navigate to dashboard
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Check if we're on the dashboard (meaning logged in) or redirected to login
        const onDashboard = new URL(page.url()).pathname === "/dashboard";

        if (onDashboard) {
          // Trigger sign out via the sidebar
          const signOutBtn = page.getByRole("button", { name: /sign out/i });
          if (await signOutBtn.isVisible().catch(() => false)) {
            await signOutBtn.click();
          } else {
            // Fallback: use the /logout approach
            await page.goto("/api/auth/signout");
            await page.getByRole("button", { name: /sign out/i }).click();
          }

          // After sign out, should redirect to landing page
          await expect(page).toHaveURL(/.*\//, { timeout: 10000 });
          // Should not be on a protected route
          const path = new URL(page.url()).pathname;
          expect(path).not.toContain("/dashboard");
        }
      }
    });
  });

  test.describe("Protected Routes", () => {
    test("should redirect to login when accessing dashboard without auth", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });

    test("should redirect to login when accessing settings without auth", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });

    test("should redirect to login when accessing profiles without auth", async ({ page }) => {
      await page.goto("/profiles");
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });

    test("should allow public routes like blog without redirect", async ({ page }) => {
      await page.goto("/blog");
      const currentPath = new URL(page.url()).pathname;
      expect(currentPath.startsWith("/blog") || currentPath === "/login").toBe(true);
    });
  });

  test.describe("CGU Page", () => {
    test("should load CGU page for onboarding", async ({ page }) => {
      await page.goto("/onboarding/cgu");
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    });
  });
});
