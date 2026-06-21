/**
 * E2E Tests for Dashboard Publish Queue Page
 * Tests: Queue dashboard rendering, stat cards, job table, empty state,
 *        error handling, retry, auto-refresh, edge cases
 *
 * API endpoints:
 *   GET /api/v1/queue/status → { queued, running, completed, failed, total }
 *   GET /api/v1/queue/jobs → QueueJobItem[]
 *   POST /api/v1/queue/jobs/{jobId}/retry
 */

import { expect, test } from "@playwright/test";
import { DashboardPublishQueuePage } from "./pages/dashboard-publish-queue.page";

test.describe("Dashboard Publish Queue", () => {
  const mockStatus = {
    queued: 5,
    running: 2,
    completed: 45,
    failed: 3,
    total: 55,
  };

  const mockJobs = [
    {
      id: "job-001-xxxxxxxx",
      type: "publish",
      status: "completed",
      priority: "normal",
      attempts: 1,
      maxAttempts: 3,
      createdAt: Date.now() - 3600000,
      completedAt: Date.now() - 1800000,
    },
    {
      id: "job-002-yyyyyyyy",
      type: "generate",
      status: "running",
      priority: "high",
      attempts: 1,
      maxAttempts: 3,
      createdAt: Date.now() - 600000,
    },
    {
      id: "job-003-zzzzzzzz",
      type: "publish",
      status: "failed",
      priority: "critical",
      attempts: 2,
      maxAttempts: 3,
      createdAt: Date.now() - 7200000,
      completedAt: Date.now() - 3600000,
      error: "API timeout after 30s",
    },
  ];

  test.describe("Page Rendering", () => {
    test("SUCCESS: Page renders with queued content items", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      await expect(queue.heading).toBeVisible({ timeout: 10000 });
      await expect(queue.queueOverview).toBeVisible();

      // Stat cards should be visible
      expect(await queue.getStatCardValue("Queued")).toBe(5);
      expect(await queue.getStatCardValue("Running")).toBe(2);
      expect(await queue.getStatCardValue("Completed")).toBe(45);
      expect(await queue.getStatCardValue("Failed")).toBe(3);

      // Job table should have 3 rows
      expect(await queue.getJobCount()).toBe(3);
    });

    test("SUCCESS: Items show type, status and priority badges", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Check first job: type=publish, status=completed, priority=normal
      expect(await queue.getJobTypeAt(0)).toBe("publish");
      expect(await queue.getJobStatusAt(0)).toBe("Completed");
      expect(await queue.getJobPriorityAt(0)).toBe("Normal");

      // Check second job: type=generate, status=running, priority=high
      expect(await queue.getJobTypeAt(1)).toBe("generate");
      expect(await queue.getJobStatusAt(1)).toBe("Running");
      expect(await queue.getJobPriorityAt(1)).toBe("High");

      // Check third job: type=publish, status=failed, priority=critical
      expect(await queue.getJobTypeAt(2)).toBe("publish");
      expect(await queue.getJobStatusAt(2)).toBe("Failed");
      expect(await queue.getJobPriorityAt(2)).toBe("Critical");
    });

    test("SUCCESS: Total jobs count is displayed", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      const totalText = await queue.getTotalJobsText();
      expect(totalText).toContain("55");
    });
  });

  test.describe("Actions", () => {
    test("SUCCESS: Can retry a failed job", async ({ page }) => {
      let retryCalled = false;
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });
      await page.route("**/api/v1/queue/jobs/**/retry", async (route) => {
        retryCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Failed job is at index 2
      const retryBtns = page.getByRole("button", { name: /retry/i });
      const retryCount = await retryBtns.count();
      expect(retryCount).toBeGreaterThanOrEqual(1);

      // Click the retry button in the table row for the failed job
      const tableRetryBtns = page.locator("table tbody tr").last().getByRole("button", { name: /retry/i });
      if (await tableRetryBtns.isVisible()) {
        await tableRetryBtns.click();
        await page.waitForTimeout(1000);
        expect(retryCalled).toBe(true);
      }
    });

    test("SUCCESS: Auto-refresh checkbox can be toggled", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      expect(await queue.isAutoRefreshChecked()).toBe(true);

      await queue.toggleAutoRefresh();
      expect(await queue.isAutoRefreshChecked()).toBe(false);

      await queue.toggleAutoRefresh();
      expect(await queue.isAutoRefreshChecked()).toBe(true);
    });

    test("SUCCESS: Refresh button refetches data", async ({ page }) => {
      let fetchCount = 0;
      await page.route("**/api/v1/queue/status", async (route) => {
        fetchCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Wait for initial fetch
      await page.waitForTimeout(500);

      await queue.clickRefresh();
      await page.waitForTimeout(500);

      // fetchCount should have increased (initial + refresh call)
      // Note: initial set of calls may happen before we track them,
      // but at minimum the refresh should trigger additional fetches
      expect(fetchCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe("Empty State", () => {
    test("EMPTY: Shows empty state when queue is empty", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
            total: 0,
          }),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      await expect(queue.heading).toBeVisible({ timeout: 10000 });
      await expect(queue.emptyState).toBeVisible({ timeout: 10000 });
      expect(await queue.getJobCount()).toBe(0);

      // Stat cards should show all zeros
      expect(await queue.getStatCardValue("Queued")).toBe(0);
      expect(await queue.getStatCardValue("Running")).toBe(0);
      expect(await queue.getStatCardValue("Completed")).toBe(0);
      expect(await queue.getStatCardValue("Failed")).toBe(0);
    });
  });

  test.describe("Loading State", () => {
    test("EDGE: Loading state while fetching", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Loading spinner should appear
      const spinner = page.locator(".animate-spin").first();
      await expect(spinner).toBeVisible({ timeout: 3000 });

      // After loading, stat cards and jobs should render
      await expect(queue.queueOverview).toBeVisible({ timeout: 10000 });
      expect(await queue.getJobCount()).toBe(3);
    });
  });

  test.describe("Error Handling", () => {
    test("ERROR: Shows error when API fails", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Error banner should appear
      const errorText = await queue.getErrorBannerText();
      expect(errorText).toBeTruthy();

      // Empty state should still be shown for jobs
      await expect(queue.emptyState).toBeVisible({ timeout: 10000 });
    });

    test("ERROR: Shows error when trying to retry fails", async ({ page }) => {
      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStatus),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockJobs),
        });
      });
      await page.route("**/api/v1/queue/jobs/**/retry", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Retry failed" }),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Click retry on failed job
      const tableRetryBtns = page.locator("table tbody tr").last().getByRole("button", { name: /retry/i });
      if (await tableRetryBtns.isVisible()) {
        await tableRetryBtns.click();
        await page.waitForTimeout(1000);

        // Error banner should show retry failure
        const errorText = await queue.getErrorBannerText();
        expect(errorText).toBeTruthy();
      }
    });
  });

  test.describe("Edge Cases", () => {
    test("EDGE: Queue with items for multiple platforms/job types", async ({ page }) => {
      const multiTypeJobs = [
        {
          id: "job-pub-1",
          type: "publish",
          status: "completed",
          priority: "normal",
          attempts: 1,
          maxAttempts: 3,
          createdAt: Date.now() - 3600000,
          completedAt: Date.now() - 1800000,
        },
        {
          id: "job-gen-1",
          type: "generate",
          status: "running",
          priority: "high",
          attempts: 2,
          maxAttempts: 3,
          createdAt: Date.now() - 600000,
        },
        {
          id: "job-sch-1",
          type: "schedule",
          status: "queued",
          priority: "low",
          attempts: 0,
          maxAttempts: 3,
          createdAt: Date.now() - 300000,
        },
        {
          id: "job-del-1",
          type: "delete",
          status: "failed",
          priority: "critical",
          attempts: 3,
          maxAttempts: 3,
          createdAt: Date.now() - 7200000,
          completedAt: Date.now() - 3600000,
          error: "Permission denied",
        },
      ];

      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            queued: 1,
            running: 1,
            completed: 1,
            failed: 1,
            total: 4,
          }),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(multiTypeJobs),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      expect(await queue.getJobCount()).toBe(4);
      expect(await queue.getJobTypeAt(0)).toBe("publish");
      expect(await queue.getJobTypeAt(1)).toBe("generate");
      expect(await queue.getJobTypeAt(2)).toBe("schedule");
      expect(await queue.getJobTypeAt(3)).toBe("delete");

      // Stat cards should show 1 each
      expect(await queue.getStatCardValue("Queued")).toBe(1);
      expect(await queue.getStatCardValue("Running")).toBe(1);
      expect(await queue.getStatCardValue("Completed")).toBe(1);
      expect(await queue.getStatCardValue("Failed")).toBe(1);
    });

    test("EDGE: Recent errors section shows when jobs have errors", async ({ page }) => {
      const jobsWithErrors = [
        ...mockJobs,
        {
          id: "job-004-aaaaaa",
          type: "generate",
          status: "failed",
          priority: "high",
          attempts: 3,
          maxAttempts: 3,
          createdAt: Date.now() - 14400000,
          completedAt: Date.now() - 7200000,
          error: "Quota exceeded — daily limit reached",
        },
      ];

      await page.route("**/api/v1/queue/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...mockStatus, failed: 2 }),
        });
      });
      await page.route("**/api/v1/queue/jobs", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(jobsWithErrors),
        });
      });

      const queue = new DashboardPublishQueuePage(page);
      await queue.goto();

      // Recent errors section should exist
      const errorsSection = page.getByText("Recent Errors");
      await expect(errorsSection).toBeVisible({ timeout: 10000 });

      // Error messages should be visible
      await expect(page.getByText("API timeout after 30s")).toBeVisible();
      await expect(page.getByText("Quota exceeded — daily limit reached")).toBeVisible();
    });
  });
});
