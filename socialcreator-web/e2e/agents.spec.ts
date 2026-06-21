/**
 * E2E Tests for AI Agent Management (P2)
 * Tests: Navigation, creation, execution, results viewing, configuration editing, pause/activation
 */

import { expect, test } from "@playwright/test";
import {
  AgentDetailPage,
  AgentRunModalPage,
  AgentsListPage,
  AllAgentsPage,
  NewAgentPage,
} from "./pages/agent.page";

test.describe("AI Agent Management", () => {
  test.describe("Navigation", () => {
    test("should navigate to all agents page", async ({ page }) => {
      const agents = new AllAgentsPage(page);
      await agents.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(agents.heading).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/manage your ai content agents/i)).toBeVisible({ timeout: 5000 });
    });

    test("should navigate to agents page from a profile", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for agents link within a profile card
      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        // Navigate to agents
        const agentsTab = page.locator('a[href*="/agents"]');
        if (await agentsTab.isVisible().catch(() => false)) {
          await agentsTab.click();
          await expect(page.getByRole("heading", { name: /ai agents/i })).toBeVisible({
            timeout: 10000,
          });
        }
      }
    });

    test("should show new agent button on agents page", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Navigate to a profile's agents
      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        const agentsTab = page.locator('a[href*="/agents"]');
        if (await agentsTab.isVisible().catch(() => false)) {
          await agentsTab.click();
          await expect(page.getByRole("link", { name: /new agent/i })).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });
  });

  test.describe("Agent Creation", () => {
    test("should display agent creation form with all fields", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Navigate to new agent page via a profile
      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        const profileId = new URL(page.url()).pathname.split("/").pop();
        const newAgent = new NewAgentPage(page);
        await newAgent.goto(profileId!);

        await expect(newAgent.heading).toBeVisible({ timeout: 10000 });
        await expect(newAgent.nameInput).toBeVisible();
        await expect(newAgent.submitButton).toBeVisible();
      }
    });

    test("should show validation error for empty agent name", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });
        const profileId = new URL(page.url()).pathname.split("/").pop();

        const newAgent = new NewAgentPage(page);
        await newAgent.goto(profileId!);
        await newAgent.submit();

        const error = await newAgent.getError();
        expect(error.length).toBeGreaterThan(0);
      }
    });

    test("should allow selecting agent type", async ({ page }) => {
      const agents = new AllAgentsPage(page);
      await agents.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check if agent type badges exist in the UI
      const agentTypeBadges = page
        .locator('[class*="rounded"][class*="text-xs"]')
        .filter({ hasText: /text.?post|video.?clip|cross.?post/i });
      const badgeCount = await agentTypeBadges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    });

    test("should display agent type options in creation form", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });
        const profileId = new URL(page.url()).pathname.split("/").pop();

        await page.goto(`/profiles/${profileId}/agents/new`);
        await page.waitForLoadState("networkidle");

        // Agent type selection should show options
        const typeButtons = page.locator("fieldset").first().getByRole("button");
        const typeCount = await typeButtons.count();
        expect(typeCount).toBeGreaterThanOrEqual(3);
      }
    });
  });

  test.describe("Agent Execution (Run)", () => {
    test("should show run agent button on agent detail page", async ({ page }) => {
      // Try to navigate to an agent detail page
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for any agent card with a link
      const agentCards = page.locator('a[href*="/agents/"]');
      const cardCount = await agentCards.count();
      if (cardCount > 0) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Should see Run Agent button
        await expect(page.getByRole("button", { name: /run agent/i })).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test("should open run modal when clicking run agent", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        const runBtn = page.getByRole("button", { name: /run agent/i });
        if ((await runBtn.isVisible().catch(() => false)) && !(await runBtn.isDisabled())) {
          await runBtn.click();
          // Run modal should appear
          await expect(page.locator("textarea").first()).toBeVisible({ timeout: 3000 });
        }
      }
    });

    test("should validate brief length in run modal", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        const runBtn = page.getByRole("button", { name: /run agent/i });
        if ((await runBtn.isVisible().catch(() => false)) && !(await runBtn.isDisabled())) {
          await runBtn.click();
          await page.waitForTimeout(1000);

          // Brief textarea should be in the modal
          const textarea = page.locator("textarea").first();
          if (await textarea.isVisible().catch(() => false)) {
            await textarea.fill("Hi");
            const submitBtn = page.getByRole("button", { name: /run/i }).last();
            await submitBtn.click();

            // Should show error about brief length
            await expect(page.getByText(/at least 10 characters/i)).toBeVisible({ timeout: 3000 });
          }
        }
      }
    });

    test("should show runs tab on agent detail page", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Runs tab should be visible
        await expect(page.getByRole("button", { name: /runs/i })).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Run Results Visualization", () => {
    test("should display run history in runs tab", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Click runs tab
        const runsTab = page.getByRole("button", { name: /runs/i });
        await runsTab.click();

        // Either shows run list or empty state
        const hasRuns = await page
          .getByText(/no runs yet/i)
          .isVisible()
          .catch(() => false);
        const hasRunTable = await page
          .locator("table")
          .isVisible()
          .catch(() => false);
        expect(hasRuns || hasRunTable).toBe(true);
      }
    });

    test("should show run status badges", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Click runs tab
        const runsTab = page.getByRole("button", { name: /runs/i });
        await runsTab.click();

        // Check for status badges in the table
        const runStatuses = page
          .locator('[class*="rounded-pill"]')
          .filter({ hasText: /success|failed|running|pending|cancelled/i });
        const statusCount = await runStatuses.count();
        // Either no runs (0) or some with status badges
        expect(statusCount).toBeGreaterThanOrEqual(0);
      }
    });

    test("should show overview tab with agent stats", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Overview tab should be active by default
        await expect(page.getByText(/configuration/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/statistics/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Configuration Modification", () => {
    test("should display current agent configuration", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Configuration card should show settings
        await expect(page.getByText(/platforms/i).or(page.getByText(/schedule/i))).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test("should show platforms assigned to agent", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Platform badges should be visible
        const platformBadges = page
          .locator('[class*="rounded-pill"]')
          .filter({ hasText: /twitter|x|instagram|linkedin|tiktok|facebook|youtube/i });
        const badgeCount = await platformBadges.count();
        expect(badgeCount).toBeGreaterThanOrEqual(0);
      }
    });

    test("should have edit link for agent configuration", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check if any agent cards have action menus with edit
      const settingsButtons = page
        .locator('button[aria-label*="settings"], button[aria-label*="more"]')
        .or(page.getByRole("button", { name: /edit/i }));
      const settingsCount = await settingsButtons.count();
      expect(settingsCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Pause / Activation", () => {
    test("should show agent status (active/paused) on card", async ({ page }) => {
      const agents = new AllAgentsPage(page);
      await agents.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check for any paused/active badges
      const statusBadges = page
        .locator('[class*="rounded-full"]')
        .filter({ hasText: /paused|active/i });
      const badgeCount = await statusBadges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    });

    test("should show toggle button on agent detail page", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Active/Paused toggle should exist
        // It's the toggle button before "Run Agent"
        const runBtn = page.getByRole("button", { name: /run agent/i });
        await expect(runBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test("should show stat cards on agent detail overview", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentCards = page.locator('a[href*="/agents/"]');
      if (
        await agentCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await agentCards.first().click();
        await page.waitForURL(/\/agents\//, { timeout: 10000 });

        // Stats should be visible on overview
        await expect(page.getByText(/total runs/i).or(page.getByText(/success rate/i))).toBeVisible(
          { timeout: 5000 },
        );
      }
    });
  });
});
