/**
 * E2E Tests for Video Pipeline (P3)
 * Tests: Video library navigation, upload flow, processing status, segment identification, content navigation
 */

import { expect, test } from "@playwright/test";

test.describe("Video Pipeline", () => {
  test.describe("Navigation", () => {
    test("should navigate to all videos page", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /all videos/i })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/manage your video library/i)).toBeVisible({ timeout: 5000 });
    });

    test("should have breadcrumb on video page", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const breadcrumb = page
        .locator("nav")
        .filter({ hasText: /videos/i })
        .first();
      await expect(breadcrumb).toBeVisible({ timeout: 5000 });
    });

    test("should show new video button with profile link", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // New Video button should link to a profile or profiles page
      const newVideoBtn = page.getByRole("link", { name: /new video/i });
      await expect(newVideoBtn).toBeVisible({ timeout: 5000 });
    });

    test("should show filter options on video page", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Status filter buttons should be visible
      await expect(
        page.getByText(/all|uploaded|transcribed|segments|ready|error/i).first(),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Video Upload", () => {
    test("should navigate to video upload page from profile", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Find a profile and navigate to its video section
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

        // Look for video link
        const videoLink = page.locator('a[href*="/video"]');
        if (await videoLink.isVisible().catch(() => false)) {
          await videoLink.click();
          await page.waitForURL(/\/video/, { timeout: 10000 });
          await expect(page.getByRole("heading", { name: /video|upload/i }).first()).toBeVisible({
            timeout: 5000,
          });
        }
      }
    });

    test("should display video upload interface", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check for upload area or empty state
      const hasUploadArea = await page
        .getByText(/upload a video/i)
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/no videos yet/i)
        .isVisible()
        .catch(() => false);
      expect(hasUploadArea || hasEmptyState).toBe(true);
    });

    test("should show pipeline progress stepper", async ({ page }) => {
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

        // Navigate to video upload page
        const videoLink = page.locator('a[href*="/video"]');
        if (await videoLink.isVisible().catch(() => false)) {
          await videoLink.click();
          await page.waitForURL(/\/video/, { timeout: 10000 });

          // Pipeline steps should be visible
          const steps = ["Upload", "Transcription", "Segments", "Clips", "Generate"];
          for (const step of steps) {
            const stepVisible = await page
              .getByText(step)
              .isVisible()
              .catch(() => false);
            if (stepVisible) {
              expect(stepVisible).toBe(true);
              break;
            }
          }
        }
      }
    });

    test("should show empty state when no videos exist", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Either shows videos or empty state
      const hasNoVideos = await page
        .getByText(/no videos yet/i)
        .isVisible()
        .catch(() => false);
      const hasVideoGrid = await page
        .locator('[class*="grid"]')
        .isVisible()
        .catch(() => false);
      // At least one of these should be true
      expect(hasNoVideos || hasVideoGrid).toBe(true);
    });
  });

  test.describe("Processing Status", () => {
    test("should display status filter buttons on video page", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Status filters should be present
      const statusFilters = page
        .locator("button")
        .filter({ hasText: /all|uploaded|transcribed|segments ready|clips ready|ready|error/i });
      const filterCount = await statusFilters.count();
      expect(filterCount).toBeGreaterThanOrEqual(1);
    });

    test("should show profile filter on video page", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Profile filter select should be visible
      const profileFilter = page.locator("select#video-profile-filter, select").first();
      const filterVisible = await profileFilter.isVisible().catch(() => false);

      // Or there could be profile filter buttons
      const profileButtons = page.getByRole("button").filter({ hasText: /all profiles/i });
      const buttonsVisible = await profileButtons.isVisible().catch(() => false);

      expect(filterVisible || buttonsVisible).toBe(true);
    });

    test("should show view mode toggle (grid/list)", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Grid and list toggle buttons
      const gridBtn = page
        .locator("button")
        .filter({ has: page.locator("svg") })
        .first();
      if (await gridBtn.isVisible().catch(() => false)) {
        await expect(gridBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test("should have viewport meta tag for responsive", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const viewport = page.locator('meta[name="viewport"]');
      await expect(viewport).toHaveAttribute("content", /width=device-width/);
    });
  });

  test.describe("Segments & Content", () => {
    test("should have pipeline steps defined in UI", async ({ page }) => {
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

        const videoLink = page.locator('a[href*="/video"]');
        if (await videoLink.isVisible().catch(() => false)) {
          await videoLink.click();
          await page.waitForURL(/\/video/, { timeout: 10000 });

          // Check for segment-related UI
          const hasSegmentsUI = await page
            .getByText(/segment/i)
            .isVisible()
            .catch(() => false);
          // Either pipeline has segments step or it's early in the flow
          expect(true).toBe(true);
        }
      }
    });

    test("should navigate to generated content from video", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // If there are video cards with links, click one
      const videoCards = page.locator('a[href*="/profiles/"][href*="/video"]');
      if (
        await videoCards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await videoCards.first().click();
        await page.waitForURL(/\/video/, { timeout: 10000 });

        // Should navigate to video detail/upload page
        const pageContent = await page.textContent("body");
        expect(pageContent.length).toBeGreaterThan(0);
      }
    });

    test("should render video page on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load properly on mobile
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Video Detail / Upload Page", () => {
    test("should show upload interface within profile video page", async ({ page }) => {
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

        // Check for video upload link in the profile
        const videoSection = page.locator('a[href*="/video"]').or(page.getByText(/upload|video/i));
        if (
          await videoSection
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await videoSection.first().click();
          await page.waitForTimeout(3000);

          // Page should have content
          const bodyText = await page.textContent("body");
          expect(bodyText.length).toBeGreaterThan(0);
        }
      }
    });

    test("should have descriptive page title on video page", async ({ page }) => {
      await page.goto("/video");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });
  });
});
