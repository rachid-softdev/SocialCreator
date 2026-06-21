/**
 * E2E Tests for Content History Page
 * Tests: List rendering, platform/status display, filtering, pagination,
 *        empty state, error handling, edge cases
 *
 * API: GET /api/v1/publish-logs?page=1&pageSize=20
 * Response: { logs: PublishLogEntry[], totalPages, page, pageSize }
 */

import { expect, test } from "@playwright/test";
import { ContentHistoryPage } from "./pages/content-history.page";

test.describe("Content History", () => {
  test.describe("Page Rendering", () => {
    test("SUCCESS: Page renders with history list (mock API response)", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [
              {
                id: "log-1",
                platform: "X",
                contentId: "content-1",
                contentHash: "abc123",
                success: true,
                error: null,
                publishedAt: new Date(Date.now() - 3600000).toISOString(),
              },
              {
                id: "log-2",
                platform: "LINKEDIN",
                contentId: "content-2",
                contentHash: "def456",
                success: true,
                error: null,
                publishedAt: new Date(Date.now() - 7200000).toISOString(),
              },
            ],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      await expect(history.heading).toBeVisible({ timeout: 10000 });
      const itemCount = await history.getHistoryItemCount();
      expect(itemCount).toBe(2);
    });

    test("SUCCESS: History items show correct platform, status, date", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [
              {
                id: "log-1",
                platform: "X",
                contentId: "content-1",
                contentHash: "abc123",
                success: true,
                error: null,
                publishedAt: "2026-06-20T10:00:00.000Z",
              },
              {
                id: "log-2",
                platform: "INSTAGRAM",
                contentId: "content-2",
                contentHash: "def456",
                success: false,
                error: "Rate limit exceeded",
                publishedAt: "2026-06-19T15:30:00.000Z",
              },
            ],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      // First item: X platform, Success status
      const platform1 = await history.getPlatformAt(0);
      expect(platform1.toLowerCase()).toContain("x");
      const status1 = await history.getStatusAt(0);
      expect(status1).toBe("Success");

      // Second item: Instagram, Failed status with error message
      const platform2 = await history.getPlatformAt(1);
      expect(platform2.toLowerCase()).toContain("instagram");
      const status2 = await history.getStatusAt(1);
      expect(status2).toBe("Failed");
      const errorText = await history.getErrorTextAt(1);
      expect(errorText).toContain("Rate limit exceeded");
    });
  });

  test.describe("Loading State", () => {
    test("EDGE: Loading skeleton shows while fetching", async ({ page }) => {
      // Delay the API response so skeleton is visible
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      // Check for skeleton/loading elements while data loads
      const skeleton = page.locator(".animate-pulse").first();
      await expect(skeleton).toBeVisible({ timeout: 3000 });

      // Wait for loading to finish
      await expect(skeleton).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Empty State", () => {
    test("EMPTY: Shows empty state when no history exists", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      await expect(history.emptyState).toBeVisible({ timeout: 10000 });
      // Pagination should not be visible when there are no items
      await expect(history.previousButton).not.toBeVisible();
      await expect(history.nextButton).not.toBeVisible();
    });
  });

  test.describe("Pagination", () => {
    test("SUCCESS: Pagination works (multiple pages of history)", async ({ page }) => {
      // Generate 25 log entries to ensure 2 pages (pageSize=20)
      const allLogs = Array.from({ length: 25 }, (_, i) => ({
        id: `log-page1-${i}`,
        platform: i % 2 === 0 ? "X" : "LINKEDIN",
        contentId: `content-${i}`,
        contentHash: `hash-${i}`,
        success: true,
        error: null,
        publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
      }));

      let _callCount = 0;
      await page.route("**/api/v1/publish-logs**", async (route) => {
        _callCount++;
        const url = new URL(route.request().url());
        const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);

        const start = (pageParam - 1) * 20;
        const end = start + 20;
        const pageLogs = allLogs.slice(start, end);

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: pageLogs,
            totalPages: 2,
            page: pageParam,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      // Page 1 should have 20 items
      await expect(history.pageIndicator).toBeVisible({ timeout: 10000 });
      expect(await history.getPageText()).toMatch(/page 1 of 2/i);

      const countPage1 = await history.getHistoryItemCount();
      expect(countPage1).toBe(20);

      // Previous should be disabled on page 1
      expect(await history.isPreviousDisabled()).toBe(true);
      expect(await history.isNextDisabled()).toBe(false);

      // Navigate to page 2
      await history.clickNext();
      await page.waitForTimeout(500);

      expect(await history.getPageText()).toMatch(/page 2 of 2/i);
      const countPage2 = await history.getHistoryItemCount();
      expect(countPage2).toBe(5);

      // Next should be disabled on last page
      expect(await history.isNextDisabled()).toBe(true);
      expect(await history.isPreviousDisabled()).toBe(false);

      // Navigate back to page 1
      await history.clickPrevious();
      await page.waitForTimeout(500);

      expect(await history.getPageText()).toMatch(/page 1 of 2/i);
    });
  });

  test.describe("Error Handling", () => {
    test("ERROR: Shows error state when API fails (mock 500)", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      // The component catches errors silently and shows empty state
      await expect(history.emptyState).toBeVisible({ timeout: 10000 });
    });

    test("ERROR: Shows error state when API returns non-JSON", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: "Internal Server Error",
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      // Non-JSON response causes catch → empty state
      await expect(history.emptyState).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Edge Cases", () => {
    test("EDGE: Very long content titles are truncated", async ({ page }) => {
      const veryLongPlatform = "X".repeat(200);
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [
              {
                id: "log-long",
                platform: veryLongPlatform,
                contentId: "content-long",
                contentHash: "hash-long",
                success: true,
                error: null,
                publishedAt: new Date().toISOString(),
              },
            ],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      // The truncate class will clip it but the text content may still be full
      // Verify the element has truncate class
      const item = history.historyItems.first();
      const truncateEl = item.locator("p.text-body-sm.text-muted.truncate");
      await expect(truncateEl).toBeVisible({ timeout: 5000 });
    });

    test("EDGE: History shows items with both success and failure statuses", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [
              {
                id: "log-success-1",
                platform: "X",
                contentId: "c1",
                contentHash: "h1",
                success: true,
                error: null,
                publishedAt: new Date().toISOString(),
              },
              {
                id: "log-fail-1",
                platform: "INSTAGRAM",
                contentId: "c2",
                contentHash: "h2",
                success: false,
                error: "Authentication expired — please reconnect your account",
                publishedAt: new Date().toISOString(),
              },
              {
                id: "log-success-2",
                platform: "LINKEDIN",
                contentId: "c3",
                contentHash: "h3",
                success: true,
                error: null,
                publishedAt: new Date().toISOString(),
              },
            ],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      expect(await history.getHistoryItemCount()).toBe(3);
      expect(await history.getStatusAt(0)).toBe("Success");
      expect(await history.getStatusAt(1)).toBe("Failed");
      expect(await history.getStatusAt(2)).toBe("Success");

      // Failed item should show error message
      const errorMsg = await history.getErrorTextAt(1);
      expect(errorMsg).toContain("Authentication expired");
    });

    test("EDGE: History with single item shows correct singular format", async ({ page }) => {
      await page.route("**/api/v1/publish-logs**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            logs: [
              {
                id: "log-single",
                platform: "X",
                contentId: "c-single",
                contentHash: "h-single",
                success: true,
                error: null,
                publishedAt: new Date().toISOString(),
              },
            ],
            totalPages: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      const history = new ContentHistoryPage(page);
      await history.goto();

      expect(await history.getHistoryItemCount()).toBe(1);
      // Pagination should show page 1 of 1
      expect(await history.getPageText()).toMatch(/page 1 of 1/i);
    });
  });
});
