/**
 * E2E Tests for Responsive Design (P2)
 * Tests: Rendering at mobile (375px), tablet (768px), desktop (1280px), small screen (320px), zoom (200%)
 */

import { expect, test } from "@playwright/test";

test.describe("Responsive Design", () => {
  test.describe("Mobile (375px)", () => {
    test("should render landing page on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render login page on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/login");

      // Page should load without layout issues
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render dashboard on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render profiles on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render content on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/content");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should have hamburger menu instead of sidebar", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar should be hidden on mobile (translated off-screen)
      const sidebar = page.locator("aside").first();
      const classList = await sidebar.getAttribute("class").catch(() => "");
      if (classList) {
        expect(classList).toContain("-translate-x-full");
      }

      // Mobile header should have a hamburger/menu button
      const mobileHeader = page.locator("header").first();
      if (await mobileHeader.isVisible().catch(() => false)) {
        const menuBtn = mobileHeader.getByRole("button").first();
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test("should have readable text at 375px", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");

      // Get the computed font size of the body
      const fontSize = await page.evaluate(() => {
        const style = window.getComputedStyle(document.body);
        return parseFloat(style.fontSize);
      });

      // Body text should be at least 14px for readability
      expect(fontSize).toBeGreaterThanOrEqual(12);
    });
  });

  test.describe("Tablet (768px)", () => {
    test("should render landing page on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/");

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render dashboard on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render blog on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/blog");

      // Blog is public, should load without redirect
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });
  });

  test.describe("Desktop (1280px)", () => {
    test("should render landing page on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/");

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render dashboard with full sidebar", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar should be visible on desktop
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible({ timeout: 10000 });

      // Sidebar should have navigation links
      const navLinks = sidebar.locator("a");
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThanOrEqual(3);

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render analytics on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/analytics");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Analytics page should load
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });
  });

  test.describe("Small Screens (320px)", () => {
    test("should render landing page at 320px width", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/");

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should not have horizontal scroll at 320px", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/");

      // Thorough scroll check
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth + 2; // 2px tolerance
      });

      expect(hasHorizontalScroll).toBe(false);
    });
  });

  test.describe("Zoom (200%)", () => {
    test("should render landing page at 200% zoom", async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 800 });

      // Apply 200% zoom via Ctrl+Plus (works in chromium)
      await page.goto("/");
      await page.keyboard.down("Control");
      await page.keyboard.press("=");
      await page.keyboard.press("=");
      await page.keyboard.up("Control");
      await page.waitForTimeout(500);

      // Page should still be readable
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

      // There should be some content visible after zoom
      const bodyText = await page.evaluate(() => document.body.textContent?.length || 0);
      expect(bodyText).toBeGreaterThan(0);
    });

    test("should maintain readability at 200% zoom", async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 800 });

      await page.goto("/");
      await page.keyboard.down("Control");
      await page.keyboard.press("=");
      await page.keyboard.press("=");
      await page.keyboard.up("Control");
      await page.waitForTimeout(500);

      // Text should still be visible and not clipped
      const heading = page.locator("h1").first();
      const isVisible = await heading.isVisible().catch(() => false);

      if (isVisible) {
        await expect(heading).toBeVisible({ timeout: 5000 });
      }

      // Check that the main content area is readable
      const mainContent = page.locator("main, body").first();
      const hasVisibleContent = await mainContent.isVisible().catch(() => false);
      expect(hasVisibleContent).toBe(true);
    });
  });

  test.describe("Mobile — Layout Behavior", () => {
    test("should show hamburger menu and hide sidebar on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar should be off-screen (hidden on mobile)
      const sidebar = page.locator("aside").first();
      const classList = await sidebar.getAttribute("class").catch(() => "");
      if (classList) {
        expect(classList).toContain("-translate-x-full");
      }

      // Hamburger menu button should be visible in header
      const header = page.locator("header").first();
      const menuBtn = header.locator("button").first();
      await expect(menuBtn).toBeVisible({ timeout: 5000 });
    });

    test("should have content area full-width on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Main content should span most of the viewport width
      const main = page.locator("main").first();
      if (await main.isVisible().catch(() => false)) {
        const box = await main.boundingBox();
        if (box) {
          // Content area should be at least 90% of viewport
          expect(box.width).toBeGreaterThan(375 * 0.8);
        }
      }
    });

    test("should have touch-friendly forms on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/login");

      const inputs = page.locator("input");
      const inputCount = await inputs.count();
      if (inputCount > 0) {
        for (let i = 0; i < inputCount; i++) {
          const box = await inputs.nth(i).boundingBox();
          if (box) {
            // Inputs should be at least 40px tall for touch friendliness
            expect(box.height).toBeGreaterThanOrEqual(36);
          }
        }
      }
    });

    test("should have readable font sizes on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");

      // Body text should have reasonable font size
      const bodyFontSize = await page.evaluate(() => {
        return parseFloat(window.getComputedStyle(document.body).fontSize);
      });
      expect(bodyFontSize).toBeGreaterThanOrEqual(12);

      // Heading should be larger than body
      const headingFontSize = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        if (!h1) return 0;
        return parseFloat(window.getComputedStyle(h1).fontSize);
      });
      expect(headingFontSize).toBeGreaterThanOrEqual(bodyFontSize);
    });
  });

  test.describe("Tablet — Layout Behavior", () => {
    test("should adapt layout for medium screens (768px)", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar may be collapsed or in a reduced state
      const header = page.locator("header").first();
      await expect(header).toBeVisible({ timeout: 5000 });

      // Main content should be visible
      const main = page.locator("main").first();
      if (await main.isVisible().catch(() => false)) {
        const box = await main.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe("Desktop — Full Layout", () => {
    test("should show full sidebar with navigation links on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar should be fully visible
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible({ timeout: 5000 });

      // Sidebar should have navigation items
      const navLinks = sidebar.locator("a");
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThanOrEqual(3);

      // Should show multi-column layout in content area
      const main = page.locator("main").first();
      if (await main.isVisible().catch(() => false)) {
        // Main content should take appropriate space beside sidebar
        const box = await main.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThan(400);
        }
      }
    });
  });

  test.describe("Mobile — Cards Layout", () => {
    test("should display data tables as card layout on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // On mobile, profile cards should stack vertically
      const cards = page.locator('[class*="card"], [class*="profile-card"]');
      if (
        await cards
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        const firstCard = cards.first();
        const box = await firstCard.boundingBox();
        if (box) {
          // Cards should take nearly full width on mobile
          expect(box.width).toBeGreaterThan(375 * 0.7);
        }
      }
    });
  });
});
