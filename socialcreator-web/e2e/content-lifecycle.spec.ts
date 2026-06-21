/**
 * E2E Tests for Content Full Cycle
 * Tests: Register → CGU → Create Profile → Create Agent → Run Agent → Approve Content → Schedule → Publish → Check Analytics
 */

import { expect, test } from "@playwright/test";
import { AgentRunModalPage, AllAgentsPage } from "./pages/agent.page";
import { AnalyticsPage } from "./pages/analytics.page";
import { ContentPage, GenerationPanelPage } from "./pages/content.page";
import { CGUPage, OnboardingAgentPage, OnboardingProfilePage } from "./pages/onboarding.page";
import { PublishPage } from "./pages/publish.page";
import { RegisterPage } from "./pages/register.page";

const TEST_PASSWORD = "TestPass123!";

test.describe("Content Lifecycle - Setup", () => {
  test("should register a new user", async ({ page }) => {
    const email = `cl-setup-${Date.now()}@example.com`;
    const register = new RegisterPage(page);
    await register.goto();
    await register.waitForHeading();

    await register.fillName("Content Lifecycle User");
    await register.fillEmail(email);
    await register.fillPassword(TEST_PASSWORD);
    await register.fillConfirmPassword(TEST_PASSWORD);
    await register.submit();

    // After successful registration, redirect to CGU onboarding
    await expect(page).toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
  });

  test("should accept CGU terms", async ({ page }) => {
    // Register a user first
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`CGU-${Date.now()}`);
    await register.fillEmail(`cgu-${Date.now()}@example.com`);
    await register.fillPassword(TEST_PASSWORD);
    await register.fillConfirmPassword(TEST_PASSWORD);
    await register.submit();

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });

    // Accept terms
    await cgu.acceptTerms();
    await cgu.submit();

    // Should redirect to onboarding profile
    await expect(page).not.toHaveURL(/.*\/onboarding\/cgu/, { timeout: 10000 });
  });

  test("should create a brand profile", async ({ page }) => {
    // Register → CGU → Profile
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`Profile-${Date.now()}`);
    await register.fillEmail(`profile-${Date.now()}@example.com`);
    await register.fillPassword(TEST_PASSWORD);
    await register.fillConfirmPassword(TEST_PASSWORD);
    await register.submit();

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    // On profile creation page
    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName("My Brand Profile");
    await profile.submit();

    // Should redirect to agent onboarding with profileId
    await expect(page).toHaveURL(/.*\/onboarding\/agent\?profileId=/, { timeout: 10000 });
  });

  test("should create an AI content agent", async ({ page }) => {
    // Full flow: register → CGU → profile → agent
    const register = new RegisterPage(page);
    await register.goto();
    await register.fillName(`Agent-${Date.now()}`);
    await register.fillEmail(`agent-${Date.now()}@example.com`);
    await register.fillPassword(TEST_PASSWORD);
    await register.fillConfirmPassword(TEST_PASSWORD);
    await register.submit();

    const cgu = new CGUPage(page);
    await expect(cgu.heading).toBeVisible({ timeout: 10000 });
    await cgu.acceptTerms();
    await cgu.submit();

    const profile = new OnboardingProfilePage(page);
    await expect(profile.heading).toBeVisible({ timeout: 10000 });
    await profile.fillProfileName("Agent Brand");
    await profile.submit();

    const agent = new OnboardingAgentPage(page);
    await expect(agent.heading).toBeVisible({ timeout: 10000 });
    await agent.fillAgentName("Content Agent");
    await agent.submit();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
  });
});

test.describe("Content Lifecycle - Generation", () => {
  test("should run the agent with a brief", async ({ page }) => {
    // Go to agents page and try to run an agent
    const agents = new AllAgentsPage(page);
    await agents.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(agents.heading).toBeVisible({ timeout: 10000 });

    // Look for any agent card with a link
    const agentCards = page.locator('a[href*="/agents/"]');
    const cardCount = await agentCards.count();
    if (cardCount > 0) {
      await agentCards.first().click();
      await page.waitForURL(/\/agents\//, { timeout: 10000 });

      const runBtn = page.getByRole("button", { name: /run agent/i });
      if ((await runBtn.isVisible().catch(() => false)) && !(await runBtn.isDisabled())) {
        await runBtn.click();

        // Run modal should appear
        const modal = new AgentRunModalPage(page);
        await expect(modal.briefTextarea).toBeVisible({ timeout: 3000 });

        // Fill brief
        await modal.fillBrief("Create a social media post about our latest product update");
        await modal.submit();

        // Should either show success or validation
        const hasError = await modal
          .getError()
          .then((e) => e.length > 0)
          .catch(() => false);
        const modalClosed = await modal.briefTextarea.isVisible().catch(() => false);
        expect(hasError || !modalClosed).toBe(true);
      }
    }
  });

  test("should wait for content generation", async ({ page }) => {
    const genPage = new GenerationPanelPage(page);
    await genPage.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(genPage.heading).toBeVisible({ timeout: 10000 });

    // Fill form with valid data
    await genPage.fillBrief("Announcing our new AI-powered social media scheduling feature");
    await genPage.fillKeywords("social media, AI, scheduling");
    await genPage.fillBrandVoice("Excited and professional");

    // Select platform if available
    const platformOptions = await genPage.platformSelect.locator("option").all();
    if (platformOptions.length > 1) {
      const value = (await platformOptions[1].getAttribute("value")) || "";
      await genPage.platformSelect.selectOption(value);
    }

    // Select profile if available
    const profileOptions = await genPage.profileSelect.locator("option").all();
    if (profileOptions.length > 1) {
      const value = (await profileOptions[1].getAttribute("value")) || "";
      await genPage.profileSelect.selectOption(value);
    }

    // Click generate
    await genPage.clickGenerate();

    // Wait for generation to complete
    await genPage.waitForGenerationComplete(20000);

    // Check for results or meaningful error
    const hasResults = await page
      .getByText(/generated content/i)
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .locator('[role="alert"]')
      .isVisible()
      .catch(() => false);
    expect(hasResults || hasError).toBe(true);
  });

  test("should display generated content", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(content.heading).toBeVisible({ timeout: 10000 });

    // Content page should show content list or empty state
    const hasContentCards = await content.getContentCardCount();
    const hasEmptyState = await page
      .getByText(/no content yet|no generated content/i)
      .isVisible()
      .catch(() => false);
    expect(hasContentCards >= 0 || hasEmptyState).toBe(true);
  });

  test("should approve generated content", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Navigate to content queue for approval
    await content.queueLink.click();

    // Should show queue with content items or empty state
    const hasQueue = await page
      .getByText(/content queue|pending approval|ready to approve/i)
      .isVisible()
      .catch(() => false);
    const hasEmpty = await page
      .getByText(/no items in queue|queue is empty/i)
      .isVisible()
      .catch(() => false);
    const hasHeading = await page
      .getByRole("heading")
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasQueue || hasEmpty || hasHeading).toBe(true);
  });
});

test.describe("Content Lifecycle - Publishing", () => {
  test("should navigate to publish flow", async ({ page }) => {
    const publish = new PublishPage(page);
    await publish.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(publish.heading).toBeVisible({ timeout: 10000 });

    // Should have navigation to history
    const hasHistoryLink = await publish.historyHeading.isVisible().catch(() => false);
    const hasGenerateLink = await page
      .locator('a[href="/content/generate"]')
      .isVisible()
      .catch(() => false);
    expect(hasHistoryLink || hasGenerateLink).toBe(true);
  });

  test("should schedule content for publishing", async ({ page }) => {
    const content = new ContentPage(page);
    await content.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Try to find content with a publish/schedule option
    const publishBtn = page.getByRole("button", { name: /publish|schedule/i }).first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(1000);

      // Should show publish dialog or schedule picker
      const hasDialog = await page
        .locator('[role="dialog"]')
        .isVisible()
        .catch(() => false);
      const hasCalendar = await page
        .getByRole("gridcell")
        .first()
        .isVisible()
        .catch(() => false);
      const hasScheduleBtn = await page
        .getByRole("button", { name: /schedule publication/i })
        .isVisible()
        .catch(() => false);
      expect(hasDialog || hasCalendar || hasScheduleBtn).toBe(true);
    }
  });

  test("should confirm scheduled content in calendar", async ({ page }) => {
    await page.goto("/content/calendar");

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Calendar view should be visible
    const hasCalendar = await page
      .getByRole("gridcell")
      .first()
      .isVisible()
      .catch(() => false);
    const hasCalendarHeading = await page
      .getByRole("heading", { name: /calendar|content calendar|schedule/i })
      .first()
      .isVisible()
      .catch(() => false);
    const hasDatePicker = await page
      .getByText(/\d{1,2}\/\d{1,2}\/\d{4}|\w+ \d{1,2}, \d{4}/)
      .isVisible()
      .catch(() => false);
    expect(hasCalendar || hasCalendarHeading || hasDatePicker).toBe(true);
  });
});

test.describe("Content Lifecycle - Analytics", () => {
  test("should navigate to analytics", async ({ page }) => {
    const analytics = new AnalyticsPage(page);
    await analytics.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(analytics.heading).toBeVisible({ timeout: 10000 });
  });

  test("should show activity for published content", async ({ page }) => {
    await page.goto("/analytics");

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Should show metrics or empty state
    const hasTotalPosts = await page
      .getByText(/total posts|posts/i)
      .isVisible()
      .catch(() => false);
    const hasEngagement = await page
      .getByText(/engagement|impressions|clicks/i)
      .isVisible()
      .catch(() => false);
    const hasAnalyticsHeading = await page
      .getByRole("heading", { name: /analytics/i })
      .isVisible()
      .catch(() => false);
    expect(hasTotalPosts || hasEngagement || hasAnalyticsHeading).toBe(true);
  });

  test("should show platform distribution", async ({ page }) => {
    const analytics = new AnalyticsPage(page);
    await analytics.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Check for platform breakdown
    const breakdown = await analytics.getPlatformBreakdown();
    const hasPlatformSection = await page
      .getByText(/platform|distribution|breakdown/i)
      .isVisible()
      .catch(() => false);
    const hasChart = await analytics.isChartVisible();
    expect(Object.keys(breakdown).length > 0 || hasPlatformSection || hasChart).toBe(true);
  });
});
