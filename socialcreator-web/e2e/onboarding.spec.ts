/**
 * E2E Tests for Onboarding Flow
 * Tests: Registration → CGU → Profile creation → Agent configuration
 */

import { expect, test } from "@playwright/test";
import { LoginPage } from "./pages/login.page";
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
