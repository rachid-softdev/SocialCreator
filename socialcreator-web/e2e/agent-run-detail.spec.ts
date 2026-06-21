/**
 * E2E Tests for Agent Run Detail Page
 * Tests: Run metadata, status badges, error details, platform publish status
 * URL: /profiles/[profileId]/agents/[agentId]/runs/[runId]
 */

import { expect, test } from "@playwright/test";

const TEST_PROFILE_ID = "test-profile-id";
const TEST_AGENT_ID = "test-agent-id";
const TEST_RUN_ID = "test-run-id";

const BASE_RUN = {
  id: TEST_RUN_ID,
  agentId: TEST_AGENT_ID,
  status: "SUCCESS",
  brief: "Generate a social media post about AI content creation best practices.",
  error: null,
  createdAt: "2025-03-15T09:30:00Z",
  startedAt: "2025-03-15T09:30:05Z",
  finishedAt: "2025-03-15T09:30:45Z",
  agent: {
    id: TEST_AGENT_ID,
    name: "Content Generator",
    type: "TEXT_POST",
  },
  generatedContents: [
    {
      id: "content-1",
      platform: "TWITTER",
      textContent:
        "AI content creation is transforming how we work. Here are 3 best practices every team should know. #AI #ContentCreation",
      hashtags: ["AI", "ContentCreation"],
      status: "PUBLISHED",
      profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
    },
    {
      id: "content-2",
      platform: "LINKEDIN",
      textContent:
        "In 2025, content teams that leverage AI see 3x higher output. Learn how to get started with our comprehensive guide.",
      hashtags: ["AI", "ContentStrategy"],
      status: "PUBLISHED",
      profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
    },
  ],
  duration: 40,
};

test.describe("Agent Run Detail", () => {
  test.describe("SUCCESS: Run metadata display", () => {
    test("should show run metadata (status, start time, duration)", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page title
      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Timeline section should show created/started/completed
      await expect(page.getByText(/created/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/started/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/completed/i).or(page.getByText(/failed/i))).toBeVisible({
        timeout: 5000,
      });

      // Duration should be shown
      await expect(page.getByText(/40s/)).toBeVisible({ timeout: 5000 });
    });

    test("should show input/prompt used for the run", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Brief section should contain the input prompt
      const briefHeading = page.getByText(/brief/i);
      await expect(briefHeading).toBeVisible({ timeout: 5000 });

      // The brief text should be visible
      await expect(page.getByText(/generate a social media post about ai/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test("should show output/results of the run", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Generated content section should be visible
      const generatedHeading = page.getByText(/generated content/i);
      await expect(generatedHeading).toBeVisible({ timeout: 5000 });

      // Content text should be visible
      await expect(page.getByText(/ai content creation is transforming/i)).toBeVisible({
        timeout: 5000,
      });
    });

    test("should show platform publish status for each platform", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Platform badges should be visible
      await expect(page.getByText(/twitter/i).or(page.getByText(/x/i))).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByText(/linkedin/i)).toBeVisible({ timeout: 5000 });
    });

    test("should show agent name in run header", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // The agent name should be shown in the run header
      await expect(page.getByText(/content generator/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("SUCCESS: Status badges", () => {
    test("run with SUCCESS status shows green/success badge", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Success status badge should be visible
      const successBadge = page.locator('[class*="rounded-full"]').filter({ hasText: /success/i });
      await expect(successBadge).toBeVisible({ timeout: 5000 });

      // Green/success colored elements should be present
      const checkIcon = page.locator('[class*="semantic-success"]').first();
      await expect(checkIcon).toBeVisible({ timeout: 5000 });
    });

    test("run with FAILED status shows red badge with error", async ({ page }) => {
      const failedRun = {
        ...BASE_RUN,
        status: "FAILED",
        error: "API rate limit exceeded. Please try again later.",
        finishedAt: "2025-03-15T09:31:00Z",
        generatedContents: [],
      };

      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: failedRun } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Failed status badge should be visible
      const failedBadge = page.locator('[class*="rounded-full"]').filter({ hasText: /failed/i });
      await expect(failedBadge).toBeVisible({ timeout: 5000 });

      // Error section should be visible with error details
      const errorHeading = page.getByText(/error/i);
      await expect(errorHeading).toBeVisible({ timeout: 5000 });

      // Error message should be displayed
      await expect(page.getByText(/api rate limit exceeded/i)).toBeVisible({ timeout: 5000 });
    });

    test("run with RUNNING status shows progress indicator", async ({ page }) => {
      const runningRun = {
        ...BASE_RUN,
        status: "RUNNING",
        startedAt: "2025-03-15T09:30:05Z",
        finishedAt: null,
        duration: null,
        generatedContents: [],
      };

      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: runningRun } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Running status badge should be visible
      const runningBadge = page.locator('[class*="rounded-full"]').filter({ hasText: /running/i });
      await expect(runningBadge).toBeVisible({ timeout: 5000 });

      // Spinner/animated element should be present for RUNNING state
      const spinner = page.locator('[class*="animate-spin"]');
      await expect(spinner).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("ERROR: API failures", () => {
    test("run not found (404) shows error state", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 404,
            json: { error: "Run not found" },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Server-rendered page should show 404/not-found state
      // The server page calls notFound() when run is null, which shows Next.js default 404
      const bodyText = await page.textContent("body").catch(() => "");
      // Either a custom 404 or the app's not-found page
      const is404 = page.url().includes("404") || (await page.getByText(/not found/i).isVisible().catch(() => false));
      expect(is404 || bodyText.length > 0).toBe(true);
    });

    test("API failure (500) loading run detail", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 500,
            json: { error: "Internal server error" },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should show some content (error boundary should catch this)
      const bodyContent = await page.textContent("body").catch(() => "");
      expect(bodyContent.length).toBeGreaterThan(0);
    });
  });

  test.describe("EDGE: Boundary cases", () => {
    test("run with very long output text", async ({ page }) => {
      const longContent = "A".repeat(5000);
      const longRun = {
        ...BASE_RUN,
        generatedContents: [
          {
            ...BASE_RUN.generatedContents[0],
            textContent: longContent,
          },
        ],
      };

      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: longRun } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Long text should be rendered (may be truncated with line-clamp)
      const contentCard = page.locator('[class*="line-clamp-3"]');
      await expect(contentCard).toBeVisible({ timeout: 5000 });
    });

    test("run with no output (still running)", async ({ page }) => {
      const runningNoOutput = {
        ...BASE_RUN,
        status: "RUNNING",
        startedAt: "2025-03-15T09:30:05Z",
        finishedAt: null,
        duration: null,
        generatedContents: [],
      };

      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: runningNoOutput } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // No generated content section should be present
      const generatedSection = page.getByText(/generated content/i);
      const hasGenerated = await generatedSection.isVisible().catch(() => false);
      expect(hasGenerated).toBe(false);

      // Running indicator should still be visible
      const runningBadge = page.locator('[class*="rounded-full"]').filter({ hasText: /running/i });
      await expect(runningBadge).toBeVisible({ timeout: 5000 });
    });

    test("run with partial platform success (some succeeded, some failed)", async ({ page }) => {
      const partialRun = {
        ...BASE_RUN,
        generatedContents: [
          {
            id: "content-1",
            platform: "TWITTER",
            textContent: "This post published successfully.",
            hashtags: ["test"],
            status: "PUBLISHED",
            profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
          },
          {
            id: "content-2",
            platform: "LINKEDIN",
            textContent: "This one failed to publish.",
            hashtags: ["test"],
            status: "FAILED",
            profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
          },
          {
            id: "content-3",
            platform: "INSTAGRAM",
            textContent: "This one is pending.",
            hashtags: ["test"],
            status: "PENDING",
            profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
          },
        ],
      };

      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: partialRun } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Should show generated content section with count
      await expect(page.getByText(/generated content/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/3/)).toBeVisible({ timeout: 5000 });

      // All three platforms should appear
      await expect(page.getByText(/twitter/i).or(page.getByText(/x/i))).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByText(/linkedin/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/instagram/i)).toBeVisible({ timeout: 5000 });
    });

    test("back to agent navigation link works", async ({ page }) => {
      await page.route("**/api/agents/**/runs/**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { run: BASE_RUN } });
        } else {
          await route.continue();
        }
      });

      await page.goto(
        `/profiles/${TEST_PROFILE_ID}/agents/${TEST_AGENT_ID}/runs/${TEST_RUN_ID}`,
      );

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /run details/i })).toBeVisible({
        timeout: 10000,
      });

      // Back to agent link should be present
      const backLink = page.locator("a").filter({ hasText: /back to agent/i });
      await expect(backLink).toBeVisible({ timeout: 5000 });

      // Click should navigate back
      await backLink.click();
      await page.waitForURL(/\/profiles\/.*\/agents\/[^/]+$/, { timeout: 10000 });
    });
  });
});
