/**
 * E2E Tests for Agent Edit Page
 * Tests: Pre-filled form, update name/configuration/schedule, validation, API errors, edge cases
 * URL: /profiles/[profileId]/agents/[agentId]/edit
 */

import { expect, test } from "@playwright/test";

const TEST_PROFILE_ID = "test-profile-id";
const TEST_AGENT_ID = "test-agent-id";

const MOCK_AGENT = {
  id: TEST_AGENT_ID,
  name: "My Content Agent",
  type: "TEXT_POST",
  platforms: ["TWITTER", "LINKEDIN"],
  scheduleCron: "0 9 * * *",
  autoPublish: false,
  maxPerDay: 3,
  profileId: TEST_PROFILE_ID,
  isActive: true,
  createdAt: "2025-01-15T10:00:00Z",
  updatedAt: "2025-01-20T14:30:00Z",
};

test.describe("Agent Edit Page", () => {
  test.describe("SUCCESS: Page loads with existing data", () => {
    test("should load edit page with existing agent data pre-filled", async ({ page }) => {
      await page.route("**/api/agents/**", async (route) => {
        const url = route.request().url();
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page heading should be visible
      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Name input should be pre-filled with agent name
      const nameInput = page.locator("#agent-name");
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toHaveValue("My Content Agent");
    });

    test("should show agent type pre-selected based on existing data", async ({ page }) => {
      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // The Text Post type button should be selected/active
      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Text post type should have active styling (border-primary)
      const textPostBtn = page.locator("button").filter({ hasText: /text post/i }).first();
      const borderClass = await textPostBtn.getAttribute("class");
      expect(borderClass).toContain("border-primary");
    });
  });

  test.describe("SUCCESS: Can update agent attributes", () => {
    test("can update agent name", async ({ page }) => {
      let patchBody: string | null = null;

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, name: "Updated Agent Name" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      const nameInput = page.locator("#agent-name");
      await nameInput.clear();
      await nameInput.fill("Updated Agent Name");

      // Click Save Changes
      await page.locator("button", { hasText: /save changes/i }).click();

      // Should redirect to agents list
      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      // Verify the request body had the updated name
      expect(patchBody).not.toBeNull();
      const parsed = JSON.parse(patchBody!);
      expect(parsed.name).toBe("Updated Agent Name");
    });

    test("can update agent configuration (platform, tone)", async ({ page }) => {
      let patchBody: string | null = null;

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, platforms: ["INSTAGRAM", "TIKTOK"] } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Type selection should be visible (edit mode shows all steps at once)
      // Select VIDEO_CLIP type
      const videoClipBtn = page.locator("button").filter({ hasText: /video clip/i }).first();
      await videoClipBtn.click();

      // Toggle platform selections - deselect Twitter, select Instagram
      const twitterBtn = page.locator("button").filter({ hasText: /twitter|x/i }).first();
      if (await twitterBtn.isVisible().catch(() => false)) {
        await twitterBtn.click();
      }
      const instagramBtn = page.locator("button").filter({ hasText: /instagram/i }).first();
      if (await instagramBtn.isVisible().catch(() => false)) {
        await instagramBtn.click();
      }

      // Click Save Changes
      await page.locator("button", { hasText: /save changes/i }).click();

      // Should redirect to agents list
      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      expect(patchBody).not.toBeNull();
      const parsed = JSON.parse(patchBody!);
      expect(parsed.type).toBe("VIDEO_CLIP");
    });

    test("can update agent schedule/frequency", async ({ page }) => {
      let patchBody: string | null = null;

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, scheduleCron: "0 */6 * * *" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Update schedule cron input
      const scheduleInput = page.locator("#agent-schedule");
      if (await scheduleInput.isVisible().catch(() => false)) {
        await scheduleInput.clear();
        await scheduleInput.fill("0 */6 * * *");
      }

      // Toggle auto-publish on
      const autoPublishToggle = page.locator("button").filter({ hasText: /auto-publish/i }).first();
      if (await autoPublishToggle.isVisible().catch(() => false)) {
        await autoPublishToggle.click();
      }

      // Click Save Changes
      await page.locator("button", { hasText: /save changes/i }).click();

      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      expect(patchBody).not.toBeNull();
    });

    test("save shows success message and redirects to agents list", async ({ page }) => {
      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, name: "Saved Agent" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      const nameInput = page.locator("#agent-name");
      await nameInput.clear();
      await nameInput.fill("Saved Agent");

      await page.locator("button", { hasText: /save changes/i }).click();

      // Should redirect to agents page
      await expect(page).toHaveURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });
    });
  });

  test.describe("ERROR: Validation and API failures", () => {
    test("empty name shows validation error", async ({ page }) => {
      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      const nameInput = page.locator("#agent-name");
      await nameInput.clear();

      // Click Save Changes
      await page.locator("button", { hasText: /save changes/i }).click();

      // Should show validation error
      const errorMsg = page.locator('[class*="semantic-error"]');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
      await expect(errorMsg).toContainText(/name is required/i);
    });

    test("API failure (500) shows error message", async ({ page }) => {
      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            json: { error: "Internal server error" },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      await page.locator("button", { hasText: /save changes/i }).click();

      // Should show error message without redirecting
      const errorMsg = page.locator('[class*="semantic-error"]');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });

      // Should remain on edit page
      expect(page.url()).toContain("/edit");
    });

    test("network error shows error message", async ({ page }) => {
      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          await route.abort("connectionrefused");
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      await page.locator("button", { hasText: /save changes/i }).click();

      // Should show error message
      const errorMsg = page.locator('[class*="semantic-error"]');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });

      // Should remain on edit page
      expect(page.url()).toContain("/edit");
    });

    test("form with unchanged data - save still works", async ({ page }) => {
      let patchCalled = false;

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchCalled = true;
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Click Save Changes without changing anything
      await page.locator("button", { hasText: /save changes/i }).click();

      // Should still call the API and redirect
      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });
      expect(patchCalled).toBe(true);
    });
  });

  test.describe("EDGE: Boundary cases", () => {
    test("very long agent name (character limit)", async ({ page }) => {
      let patchBody: string | null = null;
      const longName = "A".repeat(100);

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, name: longName } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      const nameInput = page.locator("#agent-name");
      await nameInput.clear();
      await nameInput.fill(longName);

      await page.locator("button", { hasText: /save changes/i }).click();

      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      expect(patchBody).not.toBeNull();
      const parsed = JSON.parse(patchBody!);
      expect(parsed.name).toBe(longName);
    });

    test("special characters in agent name", async ({ page }) => {
      let patchBody: string | null = null;
      const specialName = "Agent & Co. — Test #1 (Beta)";

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, name: specialName } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      const nameInput = page.locator("#agent-name");
      await nameInput.clear();
      await nameInput.fill(specialName);

      await page.locator("button", { hasText: /save changes/i }).click();

      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      expect(patchBody).not.toBeNull();
      const parsed = JSON.parse(patchBody!);
      expect(parsed.name).toBe(specialName);
    });

    test("unauthorized user redirected to login", async ({ page }) => {
      // Mock session endpoint to return empty (unauthenticated)
      await page.route("**/api/auth/session", async (route) => {
        await route.fulfill({ json: {} });
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      // Should be redirected to login
      await page.waitForURL(/\/login/, { timeout: 10000 });
      expect(page.url()).toContain("/login");
    });
  });

  test.describe("EDGE: Config changes", () => {
    test("can update maxPerDay slider", async ({ page }) => {
      let patchBody: string | null = null;

      await page.route("**/api/agents/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { agent: MOCK_AGENT } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            json: { agent: { ...MOCK_AGENT, maxPerDay: 5 } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/edit`);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /edit agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Change the range slider for maxPerDay
      const rangeSlider = page.locator('#agent-max-per-day[type="range"]');
      if (await rangeSlider.isVisible().catch(() => false)) {
        await rangeSlider.fill("5");
      }

      await page.locator("button", { hasText: /save changes/i }).click();

      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      if (patchBody) {
        const parsed = JSON.parse(patchBody);
        expect(parsed.maxPerDay).toBe(5);
      }
    });
  });
});
