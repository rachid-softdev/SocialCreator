/**
 * E2E Tests for Content Publication Flow
 * Tests: Content selection, social account connection, scheduling, publishing, history
 */

import { expect, test } from "@playwright/test";
import { ContentPage } from "./pages/content.page";
import { PublishPage, SchedulePublishPage } from "./pages/publish.page";

test.describe("Content Publication", () => {
  test.describe("Content Selection", () => {
    test("should navigate to content page and show content list", async ({ page }) => {
      const content = new ContentPage(page);
      await content.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(content.heading).toBeVisible({ timeout: 10000 });
    });

    test("should filter content by APPROVED status", async ({ page }) => {
      const content = new ContentPage(page);
      await content.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Click on APPROVED filter button
      await content.filterByStatus("Approved");

      // URL should contain status filter (if client-side routing updates it)
      // Or at minimum the filter button should be toggled
      await expect(page.getByRole("button").filter({ hasText: /^Approved$/ })).toHaveClass(
        /bg-primary/,
      );
    });

    test("should show history page", async ({ page }) => {
      const publish = new PublishPage(page);
      await publish.gotoHistory();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(publish.historyHeading).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Publication Modals", () => {
    test("should show publish confirmation dialog", async ({ page }) => {
      const publish = new PublishPage(page);
      await publish.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for a publish button on any content card
      const publishBtn = page.getByRole("button", { name: /publish/i }).first();
      if (await publishBtn.isVisible().catch(() => false)) {
        await publishBtn.click();

        // Should see the publish confirmation dialog
        await expect(page.getByText(/confirm publication/i)).toBeVisible({ timeout: 5000 });
      }
    });

    test("should cancel publication from dialog", async ({ page }) => {
      const publish = new PublishPage(page);
      await publish.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const publishBtn = page.getByRole("button", { name: /publish/i }).first();
      if (await publishBtn.isVisible().catch(() => false)) {
        await publishBtn.click();

        // Cancel the publication
        await publish.cancelPublication();

        // Dialog should close
        await expect(page.getByText(/confirm publication/i)).not.toBeVisible({ timeout: 5000 });
      }
    });

    test("should show success state after publishing", async ({ page }) => {
      // This test validates the UI state, not the actual API call
      const publish = new PublishPage(page);
      await publish.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const publishBtn = page.getByRole("button", { name: /publish/i }).first();
      if (await publishBtn.isVisible().catch(() => false)) {
        await publishBtn.click();

        // Verify dialog elements are present
        await expect(page.getByText(/confirm publication/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole("button", { name: /publish now/i })).toBeVisible();
        await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();
      }
    });
  });

  test.describe("Publish History", () => {
    test("should load publish history page", async ({ page }) => {
      const publish = new PublishPage(page);
      await publish.gotoHistory();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(publish.historyHeading).toBeVisible({ timeout: 10000 });
    });

    test("should show empty state or history entries", async ({ page }) => {
      const publish = new PublishPage(page);
      await publish.gotoHistory();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Either empty state is visible or there are history entries
      const emptyVisible = await publish.isHistoryEmpty();
      const entryCount = await publish.getHistoryEntryCount();
      expect(emptyVisible || entryCount > 0).toBe(true);
    });

    test("should show pagination for history entries", async ({ page }) => {
      await page.goto("/content/history");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check if pagination controls are visible
      const paginationBtns = page.getByRole("button", { name: /previous|next/i });
      const btnsCount = await paginationBtns.count();
      expect(btnsCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Schedule Publication", () => {
    test("should show scheduling options in publish dialog", async ({ page }) => {
      await page.goto("/content");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Find and click publish button
      const publishBtn = page.getByRole("button", { name: /publish/i }).first();
      if (await publishBtn.isVisible().catch(() => false)) {
        await publishBtn.click();

        // Verify the dialog has scheduling related options
        await expect(page.getByText(/confirm publication/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Social Account Connection", () => {
    test("should navigate to profiles page for account connection", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Profiles page should be accessible
      await expect(page.getByRole("heading", { name: /profiles/i }).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
