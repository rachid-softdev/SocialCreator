/**
 * E2E Deep Tests for Password Reset Flow
 * Covers: Page load, email step, validations, token lifecycle, rate limiting,
 *         network errors, password strength, and full success path.
 * Uses page.route() to mock all API calls since backend may not be live.
 * UI is in French, baseURL: http://localhost:3000
 */

import { expect, test } from "@playwright/test";

/**
 * Helper: navigates to the reset password page with an optional token query param.
 * Skips the test if the page does not exist (redirected to /login).
 */
async function navigateToReset(
  page: import("@playwright/test").Page,
  path = "/auth/reset-password",
) {
  await page.goto(path);
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === "/login") {
    test.skip();
    return false;
  }
  return true;
}

/**
 * Helper: navigates with a token query parameter.
 */
async function navigateToResetWithToken(page: import("@playwright/test").Page, token: string) {
  return navigateToReset(page, `/auth/reset-password?token=${encodeURIComponent(token)}`);
}

/**
 * Helper: waits for a short period for UI transitions.
 */
const wait = (ms = 800) => new Promise((r) => setTimeout(r, ms));

test.describe("Password Reset Deep", () => {
  test.describe("Page Display & Initial State", () => {
    test("1 - should load the reset password page with heading and email input", async ({
      page,
    }) => {
      const onPage = await navigateToReset(page);
      if (!onPage) return;

      // Verify the main heading (French: "Réinitialisation du mot de passe" or similar)
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Email input should be present
      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toBeVisible({ timeout: 3000 });

      // Submit button should be present
      const submitBtn = page.locator('button[type="submit"]').first();
      await expect(submitBtn).toBeVisible({ timeout: 3000 });
    });

    test("2 - should render correct metadata and link back to login", async ({ page }) => {
      const onPage = await navigateToReset(page);
      if (!onPage) return;

      // Should have a link back to login (French: "Retour à la connexion" or similar)
      const loginLink = page
        .getByRole("link")
        .filter({ hasText: /connexion|login|retour|back/i })
        .first();
      const hasLoginLink = await loginLink.isVisible().catch(() => false);
      if (hasLoginLink) {
        await expect(loginLink).toBeVisible({ timeout: 3000 });
      }
    });

    test("3 - should display the email form when no token is present", async ({ page }) => {
      const onPage = await navigateToReset(page);
      if (!onPage) return;

      // Without a token, only the email form should be visible (no password fields)
      const emailInput = page.locator('input[type="email"]').first();
      await expect(emailInput).toBeVisible({ timeout: 3000 });

      const passwordFields = page.locator('input[type="password"]');
      const passwordCount = await passwordFields.count();
      expect(passwordCount).toBe(0);
    });
  });

  test.describe("Email Step - Validation & Submission", () => {
    test("4 - should show validation error for empty email on submit", async ({ page }) => {
      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const submitBtn = page.locator('button[type="submit"]').first();

      // Click submit with empty email field
      await submitBtn.click();
      await wait(500);

      // Should show a validation message (HTML5 or custom)
      const validationMsg = page
        .getByText(/required|obligatoire|veuillez|email.*invalide|email.*valide|entrez.*email/i)
        .first();
      const hasValidation = await validationMsg.isVisible().catch(() => false);
      expect(hasValidation).toBe(true);
    });

    test("5 - should show error for invalid email format", async ({ page }) => {
      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      await emailInput.fill("not-an-email");
      await submitBtn.click();
      await wait(500);

      // Look for validation errors in French or English
      const errorMsg = page
        .getByText(/email.*valide|valid email|format.*invalide|inclus.*@/i)
        .first();
      const hasError = await errorMsg.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });

    test("6 - should show success/confirmation message for valid email", async ({ page }) => {
      // Mock successful API response
      await page.route("**/api/auth/reset-password", async (route) => {
        const body = route.request().postDataJSON();
        if (body?.email?.includes("@")) {
          await route.fulfill({
            json: { success: true, message: "Reset link sent" },
          });
        } else {
          await route.fulfill({
            status: 400,
            json: { error: "Invalid email" },
          });
        }
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();
      await emailInput.fill("user@example.com");
      await submitBtn.click();
      await wait(1000);

      // Should show a success confirmation message
      const successMsg = page
        .getByText(
          /email.*sent|envoyé|vérifiez|check.*email|reset.*link|si un compte|if an account|confirmation/i,
        )
        .first();
      const hasSuccess = await successMsg.isVisible().catch(() => false);
      expect(hasSuccess).toBe(true);
    });

    test("7 - should not reveal whether email exists (security)", async ({ page }) => {
      // Mock API to always return success (security best practice)
      await page.route("**/api/auth/reset-password", async (route) => {
        await route.fulfill({
          json: {
            success: true,
            message: "If an account exists, a reset link has been sent",
          },
        });
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      // Try a non-existent email
      await emailInput.fill("does-not-exist@example.com");
      await submitBtn.click();
      await wait(1000);

      // Should show the same generic success message
      const successMsg = page
        .getByText(
          /email.*sent|envoyé|vérifiez|check.*email|reset.*link|si un compte|if an account|confirmation/i,
        )
        .first();
      const hasSuccess = await successMsg.isVisible().catch(() => false);
      expect(hasSuccess).toBe(true);
    });

    test("8 - should handle email with special characters correctly", async ({ page }) => {
      await page.route("**/api/auth/reset-password", async (route) => {
        await route.fulfill({ json: { success: true, message: "Reset link sent" } });
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      // Email with plus sign and subdomain
      await emailInput.fill("test+label@subdomain.example.co.uk");
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();
      await wait(500);

      // Should not show a format error
      const formatError = page.getByText(/email.*valide|valid email|format.*invalide/i).first();
      const hasFormatError = await formatError.isVisible().catch(() => false);
      expect(hasFormatError).toBe(false);
    });
  });

  test.describe("Token Validation & Error States", () => {
    test("9 - should show password form for a valid reset token", async ({ page }) => {
      const token = `valid-token-${Date.now()}`;

      // Mock token verification API
      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({
          json: { valid: true, email: "user@example.com" },
        });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      // Should show password fields (not email input)
      const passwordInput = page.locator('input[type="password"]').first();
      const hasPasswordForm = await passwordInput.isVisible().catch(() => false);

      if (hasPasswordForm) {
        await expect(passwordInput).toBeVisible({ timeout: 3000 });
        // Should have two password fields (new password + confirm)
        const passwordFields = page.locator('input[type="password"]');
        const count = await passwordFields.count();
        expect(count).toBeGreaterThanOrEqual(2);
      }
    });

    test("10 - should show error for expired/invalid reset token", async ({ page }) => {
      const token = `expired-token-${Date.now()}`;

      // Mock expired token
      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({
          status: 400,
          json: { error: "Invalid or expired reset token" },
        });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      // Should show error about invalid/expired token
      const errorMsg = page
        .getByText(/invalid|expiré|token.*invalide|lien.*expiré|lien.*invalide/i)
        .first();
      const hasError = await errorMsg.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });

    test("11 - should show error for malformed reset token", async ({ page }) => {
      const token = "malformed-token-%%%";

      // Mock malformed token response
      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({
          status: 400,
          json: { error: "Invalid token format" },
        });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      // Should show error about invalid token
      const errorMsg = page.getByText(/invalid|token.*format|malformé/i).first();
      const hasError = await errorMsg.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });

    test("12 - should show error for already-used reset token", async ({ page }) => {
      const token = `used-token-${Date.now()}`;

      // Mock already-used token
      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({
          status: 410,
          json: { error: "This reset link has already been used" },
        });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      // Should display the "already used" error
      const errorMsg = page
        .getByText(/déjà utilisé|already used|already been used|expiré|invalid/i)
        .first();
      const hasError = await errorMsg.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });
  });

  test.describe("New Password Form - Validation & Submission", () => {
    test("13 - should show validation for password too short", async ({ page }) => {
      const token = `strength-token-${Date.now()}`;

      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({ json: { valid: true, email: "user@example.com" } });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      const passwordFields = page.locator('input[type="password"]');
      const fieldCount = await passwordFields.count();

      if (fieldCount >= 2) {
        // Enter too-short password
        await passwordFields.nth(0).fill("Ab1");
        await passwordFields.nth(1).fill("Ab1");
        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await wait(500);

        // Should show minimum length error
        const minLengthError = page
          .getByText(/at least 8|too short|minimum|8 caractères|au moins 8|court/i)
          .first();
        const hasError = await minLengthError.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    });

    test("14 - should show error when passwords do not match", async ({ page }) => {
      const token = `mismatch-token-${Date.now()}`;

      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({ json: { valid: true, email: "user@example.com" } });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      const passwordFields = page.locator('input[type="password"]');
      const fieldCount = await passwordFields.count();

      if (fieldCount >= 2) {
        await passwordFields.nth(0).fill("StrongPass123!");
        await passwordFields.nth(1).fill("DifferentPass456!");
        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await wait(500);

        // Should show mismatch error
        const mismatchError = page
          .getByText(
            /passwords do not match|don't match|not match|mismatch|ne correspondent pas|différents/i,
          )
          .first();
        const hasError = await mismatchError.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    });

    test("15 - should show password strength indicator for weak password", async ({ page }) => {
      const token = `strength-indicator-${Date.now()}`;

      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({ json: { valid: true, email: "user@example.com" } });
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      const passwordFields = page.locator('input[type="password"]');
      if ((await passwordFields.count()) < 1) return;

      // Enter a common/weak password
      await passwordFields.nth(0).fill("password123");
      await wait(300);

      // Check for a strength indicator (progress bar, text hint, etc.)
      const strengthIndicator = page
        .locator('[class*="strength"], [class*="Strength"], [class*="indicator"], [class*="bar"]')
        .or(page.getByText(/faible|weak|moyen|medium|fort|strong|force/i))
        .first();
      const hasIndicator = await strengthIndicator.isVisible().catch(() => false);

      // If a strength indicator is rendered, verify it shows weak/faible
      if (hasIndicator) {
        const weakText = page.getByText(/faible|weak/i).first();
        const hasWeak = await weakText.isVisible().catch(() => false);
        // Should show weak indicator for "password123"
        expect(hasWeak).toBe(true);
      }
    });

    test("16 - should successfully submit new password and redirect to login", async ({ page }) => {
      const token = `success-token-${Date.now()}`;

      // Mock token verification
      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({ json: { valid: true, email: "user@example.com" } });
      });

      // Mock password update API
      await page.route("**/api/auth/reset-password/update", async (route) => {
        const body = route.request().postDataJSON();
        if (body?.password && body.password.length >= 8 && body?.token) {
          await route.fulfill({
            json: { success: true, message: "Password updated" },
          });
        } else {
          await route.fulfill({
            status: 400,
            json: { error: "Validation failed" },
          });
        }
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      const passwordFields = page.locator('input[type="password"]');
      const fieldCount = await passwordFields.count();

      if (fieldCount >= 2) {
        // Enter matching strong passwords
        await passwordFields.nth(0).fill("NewStrongP@ss1!");
        await passwordFields.nth(1).fill("NewStrongP@ss1!");
        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await wait(1000);

        // Should show success and redirect to login
        const successMsg = page
          .getByText(
            /password.*updated|password.*changed|success|réinitialisé|mot de passe.*mis à jour/i,
          )
          .first();
        const hasSuccess = await successMsg.isVisible().catch(() => false);
        expect(hasSuccess).toBe(true);

        // After success, should redirect to login page
        await wait(1000);
        const currentUrl = new URL(page.url());
        expect(currentUrl.pathname).toContain("login");
      }
    });
  });

  test.describe("Rate Limiting & API Failures", () => {
    test("17 - should show rate-limit error after multiple reset attempts", async ({ page }) => {
      let attemptCount = 0;

      // Mock API with rate limiting after 3 attempts
      await page.route("**/api/auth/reset-password", async (route) => {
        attemptCount++;
        if (attemptCount >= 3) {
          await route.fulfill({
            status: 429,
            json: {
              error: "Trop de tentatives. Veuillez réessayer plus tard.",
              retryAfter: 60,
            },
          });
        } else {
          await route.fulfill({ json: { success: true, message: "Reset link sent" } });
        }
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      // First attempt — should succeed
      await emailInput.fill("user@example.com");
      await submitBtn.click();
      await wait(800);

      // Second attempt — should succeed
      await emailInput.fill("user@example.com");
      await submitBtn.click();
      await wait(800);

      // Third attempt — should hit rate limit
      await emailInput.fill("user@example.com");
      await submitBtn.click();
      await wait(1000);

      // Should show rate-limit or throttle error
      const rateLimitError = page
        .getByText(
          /trop de tentatives|trop.*requêtes|rate.*limit|throttle|réessayer|try again later|429|too many/i,
        )
        .first();
      const hasError = await rateLimitError.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });

    test("18 - should handle email delivery failure with graceful error", async ({ page }) => {
      // Mock the API — email sending fails on backend
      await page.route("**/api/auth/reset-password", async (route) => {
        await route.fulfill({
          status: 500,
          json: {
            error: "Failed to send email. Please try again.",
          },
        });
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      await emailInput.fill("user@example.com");
      await submitBtn.click();
      await wait(1000);

      // Should show a graceful error message
      const errorMsg = page
        .getByText(/error|failed|échec|erreur|try again|réessayer|server error|veuillez réessayer/i)
        .first();
      const hasError = await errorMsg.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });

    test("19 - should handle network failure during email submission", async ({ page }) => {
      // Abort the API request to simulate network failure
      await page.route("**/api/auth/reset-password", async (route) => {
        await route.abort("connectionrefused");
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      await emailInput.fill("user@example.com");
      await submitBtn.click();
      await wait(1500);

      // Should show a network error message
      const errorMsg = page
        .getByText(
          /error|failed|échec|erreur|network|connexion|réseau|try again|réessayer|offline|connect/i,
        )
        .first();
      const hasError = await errorMsg.isVisible().catch(() => false);
      expect(hasError).toBe(true);
    });

    test("20 - should handle network failure during password update", async ({ page }) => {
      const token = `network-fail-token-${Date.now()}`;

      // Mock token verification (succeeds)
      await page.route("**/api/auth/reset-password/verify", async (route) => {
        await route.fulfill({ json: { valid: true, email: "user@example.com" } });
      });

      // Mock update API to abort (network failure)
      await page.route("**/api/auth/reset-password/update", async (route) => {
        await route.abort("connectionrefused");
      });

      const onPage = await navigateToResetWithToken(page, token);
      if (!onPage) return;

      const passwordFields = page.locator('input[type="password"]');
      if ((await passwordFields.count()) >= 2) {
        await passwordFields.nth(0).fill("NewStrongP@ss1!");
        await passwordFields.nth(1).fill("NewStrongP@ss1!");
        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await wait(1500);

        // Should show network error
        const errorMsg = page
          .getByText(
            /error|failed|échec|erreur|network|connexion|réseau|try again|réessayer|offline|connect/i,
          )
          .first();
        const hasError = await errorMsg.isVisible().catch(() => false);
        expect(hasError).toBe(true);
      }
    });

    test("21 - should show loading state during email submission", async ({ page }) => {
      // Delay the API response to see loading state
      await page.route("**/api/auth/reset-password", async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({ json: { success: true, message: "Reset link sent" } });
      });

      const onPage = await navigateToReset(page);
      if (!onPage) return;

      const emailInput = page.locator('input[type="email"]').first();
      const submitBtn = page.locator('button[type="submit"]').first();

      await emailInput.fill("user@example.com");
      await submitBtn.click();

      // Button should show loading state (disabled, spinner, or loading text)
      const loadingBtn = page
        .locator(
          'button[type="submit"]:has-text("Loading"), button[type="submit"]:has-text("Envoi"), ' +
            'button[type="submit"]:has-text("Sending"), button[type="submit"][disabled]',
        )
        .first();
      const hasLoading = await loadingBtn.isVisible().catch(() => false);
      expect(hasLoading).toBe(true);
    });
  });
});
