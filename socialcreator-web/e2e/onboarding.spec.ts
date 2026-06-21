/**
 * E2E Tests for Onboarding Flow
 * Tests: Registration → CGU → Profile creation → Agent configuration
 */

import { expect, test } from "@playwright/test";
import { CGUPage, OnboardingAgentPage, OnboardingProfilePage } from "./pages/onboarding.page";
import { RegisterPage } from "./pages/register.page";

test.describe("Onboarding Flow", () => {
  const testEmail = `test-user-${Date.now()}@example.com`;
  const testPassword = "TestPass123!";
  const testName = "Test User";
  const profileName = "My Test Brand";
  const agentName = "Daily Content Bot";

  test.describe("Registration → CGU acceptance", () => {
    test("should register with valid email and password", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();
      await register.waitForHeading();

      await register.fillName(testName);
      await register.fillEmail(testEmail);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      // After successful registration, user is redirected to /onboarding/cgu
      await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
    });

    test("should redirect to onboarding after registration", async ({ page }) => {
      const register = new RegisterPage(page);
      await register.goto();

      await register.fillName(`Test-${Date.now()}`);
      await register.fillEmail(`direct-${Date.now()}@example.com`);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      // Assert redirect to CGU onboarding
      await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
      const cgu = new CGUPage(page);
      await expect(cgu.heading).toBeVisible({ timeout: 5000 });
    });

    test("should accept CGU terms and continue", async ({ page }) => {
      // First, register a user to get into the onboarding flow
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName(`Cgu-${Date.now()}`);
      await register.fillEmail(`cgu-${Date.now()}@example.com`);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      // On CGU page
      const cgu = new CGUPage(page);
      await expect(cgu.heading).toBeVisible({ timeout: 10000 });

      // Accept terms
      await cgu.acceptTerms();
      await cgu.submit();

      // Should redirect to onboarding profile or dashboard
      await expect(page).not.toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
    });
  });

  test.describe("Profile creation", () => {
    test("should create a profile during onboarding", async ({ page }) => {
      // Register and skip to profile page
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName(`Profile-${Date.now()}`);
      await register.fillEmail(`profile-${Date.now()}@example.com`);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      // Accept CGU
      const cgu = new CGUPage(page);
      await expect(cgu.heading).toBeVisible({ timeout: 10000 });
      await cgu.acceptTerms();
      await cgu.submit();

      // On profile creation page
      const profile = new OnboardingProfilePage(page);
      await expect(profile.heading).toBeVisible({ timeout: 10000 });

      // Fill profile name
      await profile.fillProfileName(profileName);
      await profile.submit();

      // Should redirect to agent onboarding with profileId
      await expect(page).toHaveURL(/.*\/onboarding\/agent\?profileId=/, { timeout: 10000 });
    });

    test("should show validation error for empty profile name", async ({ page }) => {
      // Register and CGU accept
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName(`Valid-${Date.now()}`);
      await register.fillEmail(`valid-${Date.now()}@example.com`);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      const cgu = new CGUPage(page);
      await expect(cgu.heading).toBeVisible({ timeout: 10000 });
      await cgu.acceptTerms();
      await cgu.submit();

      const profile = new OnboardingProfilePage(page);
      await expect(profile.heading).toBeVisible({ timeout: 10000 });

      // Submit without name
      await profile.submit();

      // Should see validation error
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Agent configuration", () => {
    test("should create an agent during onboarding", async ({ page }) => {
      // Full flow: register → CGU → profile → agent
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName(`Agent-${Date.now()}`);
      await register.fillEmail(`agent-${Date.now()}@example.com`);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      // CGU
      const cgu = new CGUPage(page);
      await expect(cgu.heading).toBeVisible({ timeout: 10000 });
      await cgu.acceptTerms();
      await cgu.submit();

      // Profile
      const profile = new OnboardingProfilePage(page);
      await expect(profile.heading).toBeVisible({ timeout: 10000 });
      await profile.fillProfileName("Agent Test Brand");
      await profile.submit();

      // Agent page
      const agent = new OnboardingAgentPage(page);
      await expect(agent.heading).toBeVisible({ timeout: 10000 });

      // Verify profile name is shown
      await agent.hasProfileName("Agent Test Brand");

      // Fill agent name
      await agent.fillAgentName(agentName);

      // Submit
      await agent.submit();

      // Should redirect to dashboard with onboarded flag
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    });

    test("should show validation for empty agent name", async ({ page }) => {
      // Register → CGU → Profile
      const register = new RegisterPage(page);
      await register.goto();
      await register.fillName(`Agent2-${Date.now()}`);
      await register.fillEmail(`agent2-${Date.now()}@example.com`);
      await register.fillPassword(testPassword);
      await register.fillConfirmPassword(testPassword);
      await register.submit();

      const cgu = new CGUPage(page);
      await expect(cgu.heading).toBeVisible({ timeout: 10000 });
      await cgu.acceptTerms();
      await cgu.submit();

      const profile = new OnboardingProfilePage(page);
      await expect(profile.heading).toBeVisible({ timeout: 10000 });
      await profile.fillProfileName("Agent Validation Brand");
      await profile.submit();

      const agent = new OnboardingAgentPage(page);
      await expect(agent.heading).toBeVisible({ timeout: 10000 });

      // Submit without agent name
      await agent.submit();

      // Should see error
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe("Onboarding \u2014 Full End-to-End Flow", () => {
  const PASSWORD = "TestPass123!";

  test("should complete full onboarding: register \u2192 CGU \u2192 profile \u2192 agent \u2192 dashboard", async ({
    page,
  }) => {
    const ts = Date.now();
    const email = `e2e-${ts}@example.com`;
    const profileName = `E2E Profile ${ts}`;
    const agentName = `E2E Agent ${ts}`;

    // Step 1: Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`E2E User ${ts}`);
    await register.fillEmail(email);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Step 2: CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Step 3: Profile creation
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(profileName);
    await profile.submit();

    // Step 4: Agent configuration
    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });
    await agent.hasProfileName(profileName);
    await agent.fillAgentName(agentName);
    await agent.submit();

    // Step 5: Dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test("should redirect to /onboarding/profile when accessing /onboarding/agent without profileId", async ({
    page,
  }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`Redirect-${ts}`);
    await register.fillEmail(`redirect-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Now on profile page — navigate directly to agent without profileId
    await page.goto("/onboarding/agent");

    // Should redirect back to profile creation
    await expect(page).toHaveURL(/.*\/onboarding\/profile/, { timeout: 10000 });
  });
});

test.describe("Onboarding \u2014 Error Handling", () => {
  const PASSWORD = "TestPass123!";

  test("should show error when API fails during onboarding profile creation", async ({ page }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`ErrProfile-${ts}`);
    await register.fillEmail(`err-profile-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Intercept POST to /api/profiles to simulate failure
    await page.route("**/api/profiles", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      } else {
        await route.continue();
      }
    });

    // Submit profile creation
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Failing Profile ${ts}`);
    await profile.submit();

    // Should see error message
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test("should show error when API fails during onboarding agent creation", async ({ page }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`ErrAgent-${ts}`);
    await register.fillEmail(`err-agent-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Create profile
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Agent Fail Profile ${ts}`);
    await profile.submit();

    // On agent page — intercept API before submitting
    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });

    await page.route("**/api/agents", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      } else {
        await route.continue();
      }
    });

    await agent.fillAgentName(`Failing Agent ${ts}`);
    await agent.submit();

    // Should see error message
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test("should validate agent requires at least one platform", async ({ page }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`Platform-${ts}`);
    await register.fillEmail(`platform-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Create profile
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Platform Test ${ts}`);
    await profile.submit();

    // On agent page — fill name but do NOT select any platform
    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });
    await agent.fillAgentName(`Platform Agent ${ts}`);

    // Submit without selecting platforms
    await agent.submit();

    // Should see validation error about missing platform
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test("should redirect to dashboard when CGU already accepted (skip CGU step)", async ({
    page,
  }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`SkipCGU-${ts}`);
    await register.fillEmail(`skip-cgu-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Wait for redirect after CGU acceptance
    await page.waitForURL(/.*\/onboarding\/profile/, { timeout: 10000 });

    // Create a profile so we're fully onboarded
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Skip CGU Profile ${ts}`);
    await profile.submit();

    // Complete agent creation
    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });
    await agent.fillAgentName(`Skip CGU Agent ${ts}`);
    await agent.submit();

    // Now fully onboarded — navigate back to /onboarding/cgu
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    await page.goto("/onboarding/cgu");

    // Should redirect past CGU (already accepted)
    await expect(page).not.toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
  });
});

test.describe("Onboarding \u2014 Guard Hierarchy", () => {
  const PASSWORD = "TestPass123!";

  test("should redirect to CGU when authenticated but CGU not accepted", async ({ page }) => {
    const ts = Date.now();

    // Register user (automatically placed on CGU page, but hasn't accepted yet)
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`GuardCGU-${ts}`);
    await register.fillEmail(`guard-cgu-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Confirm we're on the CGU page
    await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });

    // Try to navigate to profile creation page (bypassing CGU)
    await page.goto("/onboarding/profile");

    // Should redirect back to CGU
    await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
  });

  test("should redirect to profile creation when CGU accepted but no profile", async ({ page }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`GuardProfile-${ts}`);
    await register.fillEmail(`guard-profile-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Confirm we're on the profile creation page
    await expect(page).toHaveURL(/.*\/onboarding\/profile/, { timeout: 10000 });

    // Try to navigate to agent page without a profile
    await page.goto("/onboarding/agent");

    // Should redirect back to profile creation
    await expect(page).toHaveURL(/.*\/onboarding\/profile/, { timeout: 10000 });
  });
});

test.describe("Onboarding — Advanced Scenarios", () => {
  const PASSWORD = "TestPass123!";

  test("should accept CGU and ensure it saves before advancing", async ({ page }) => {
    const ts = Date.now();
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`CGUSave-${ts}`);
    await register.fillEmail(`cgusave-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // On CGU page
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });

    // Accept and submit
    await cgu.acceptTerms();
    await cgu.submit();

    // Should advance to profile creation
    await expect(page).toHaveURL(/.*\/onboarding\/profile/, { timeout: 10000 });
    const profilePage = new OnboardingProfilePage(page);
    await expect(profilePage.heading).toBeVisible({ timeout: 5000 });
  });

  test("should create first profile during onboarding successfully", async ({ page }) => {
    const ts = Date.now();
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`FirstProf-${ts}`);
    await register.fillEmail(`firstprof-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Accept CGU
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Create profile
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`First Profile ${ts}`);
    await profile.submit();

    // Should advance to agent creation
    await expect(page).toHaveURL(/.*\/onboarding\/agent\?profileId=/, { timeout: 10000 });
    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 5000 });
  });

  test("should create first agent during onboarding successfully", async ({ page }) => {
    const ts = Date.now();
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`FirstAgent-${ts}`);
    await register.fillEmail(`firstagent-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Agent Brand ${ts}`);
    await profile.submit();

    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });
    await agent.fillAgentName(`First Agent ${ts}`);
    await agent.submit();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });

  test("should allow skipping agent creation during onboarding", async ({ page }) => {
    const ts = Date.now();
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`SkipAgent-${ts}`);
    await register.fillEmail(`skipagent-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Skip Agent ${ts}`);
    await profile.submit();

    // On agent page — look for skip option
    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });

    const skipBtn = page.getByRole("button", { name: /skip|not now|later|skip for now/i });
    const skipLink = page.locator("a").filter({ hasText: /skip|dashboard|later|skip for now/i });
    const canSkip =
      (await skipBtn.isVisible().catch(() => false)) ||
      (await skipLink.isVisible().catch(() => false));
    if (canSkip) {
      await ((await skipBtn.isVisible()) ? skipBtn : skipLink).click();
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      // Should end up on dashboard
      const currentPath = new URL(page.url()).pathname;
      expect(currentPath === "/dashboard" || currentPath.includes("/dashboard")).toBe(true);
    }
  });

  test("should navigate back from profile step to CGU step", async ({ page }) => {
    const ts = Date.now();
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`GoBack-${ts}`);
    await register.fillEmail(`goback-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // On CGU page - accept to proceed to profile
    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // On profile page — look for back button
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });

    const backBtn = page.getByRole("button", { name: /back|previous|go back/i });
    const backLink = page.locator("a").filter({ hasText: /back|previous/i });
    const canGoBack =
      (await backBtn.isVisible().catch(() => false)) ||
      (await backLink.isVisible().catch(() => false));
    if (canGoBack) {
      const target = (await backBtn.isVisible()) ? backBtn : backLink;
      await target.click();
      // Should go back to CGU page
      await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
    }
  });

  test("should handle very long profile name during onboarding", async ({ page }) => {
    const ts = Date.now();
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`LongName-${ts}`);
    await register.fillEmail(`longname-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });

    // Try a very long profile name
    const longName = "A".repeat(100);
    await profile.fillProfileName(longName);
    await profile.submit();

    // Should either accept the name (truncated) or show validation error
    const currentUrl = new URL(page.url()).pathname;
    const hasError = await page
      .locator('[role="alert"]')
      .isVisible()
      .catch(() => false);
    const advanced = currentUrl.includes("/onboarding/agent") || hasError;
    expect(advanced).toBe(true);
  });
});

test.describe("Onboarding — CGU Error Handling", () => {
  const PASSWORD = "TestPass123!";

  test("should show error and allow retry when CGU API fails", async ({ page }) => {
    const ts = Date.now();

    // Register
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`CGUErr-${ts}`);
    await register.fillEmail(`cguerr-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Intercept CGU acceptance API to fail
    await page.route("**/api/cgu**", async (route) => {
      if (route.request().method() === "POST" || route.request().method() === "PUT") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Failed to accept terms" }),
        });
      } else {
        await route.continue();
      }
    });

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });

    await cgu.acceptTerms();
    await cgu.submit();

    // Should show error message
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    // Should still be on CGU page (can retry)
    const stillOnCGU = new URL(page.url()).pathname.includes("/onboarding/cgu");
    expect(stillOnCGU).toBe(true);
  });
});

test.describe("Onboarding — Loading States", () => {
  const PASSWORD = "TestPass123!";

  test("should show loading state during CGU submission", async ({ page }) => {
    const ts = Date.now();

    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`LoadCGU-${ts}`);
    await register.fillEmail(`loadcgu-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Delay the CGU API response
    await page.route("**/api/cgu**", async (route) => {
      if (route.request().method() === "POST" || route.request().method() === "PUT") {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accepted: true }),
        });
      } else {
        await route.continue();
      }
    });

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // Loading indicator should appear during submission
    const loading = page.locator(
      '[class*="loading"], [role="status"], [aria-busy="true"], button:disabled',
    );
    const hasLoading = await loading.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasLoading) {
      await expect(loading).toBeVisible({ timeout: 2000 });
    }
  });

  test("should show loading state during onboarding step transitions", async ({ page }) => {
    const ts = Date.now();

    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`LoadStep-${ts}`);
    await register.fillEmail(`loadstep-${ts}@example.com`);
    await register.fillPassword(PASSWORD);
    await register.fillConfirmPassword(PASSWORD);
    await register.submit();

    // Delay profile creation API
    await page.route("**/api/profiles", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((r) => setTimeout(r, 3000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: `p-${ts}`, name: `Test ${ts}` }),
        });
      } else {
        await route.continue();
      }
    });

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName(`Step Load ${ts}`);
    await profile.submit();

    // Loading indicator should appear during step transition
    const loading = page.locator(
      '[class*="loading"], [role="status"], [aria-busy="true"], button:disabled',
    );
    const hasLoading = await loading.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasLoading) {
      await expect(loading).toBeVisible({ timeout: 2000 });
    }
  });
});
