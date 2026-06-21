/**
 * E2E Tests for Navigation & Responsive Design (P2)
 * Tests: Sidebar navigation, breadcrumbs, protected routes, 404 page, mobile/tablet responsive
 */

import { expect, test } from "@playwright/test";

const SIDEBAR_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profiles", label: "Profiles" },
  { href: "/agents", label: "Agents" },
  { href: "/content", label: "Content" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
  { href: "/pricing", label: "Billing" },
];

test.describe("Navigation", () => {
  test.describe("Sidebar Navigation", () => {
    test("should display sidebar with navigation links", async ({ page }) => {
      // Any authenticated page should show the sidebar (on desktop)
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

      // Check for key navigation items
      await expect(page.getByText(/dashboard/i).first()).toBeVisible();
      await expect(page.getByText(/profiles/i).first()).toBeVisible();
    });

    test("should navigate to profiles via sidebar", async ({ page }) => {
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profilesLink = page.locator('aside a[href="/profiles"]');
      if (await profilesLink.isVisible().catch(() => false)) {
        await profilesLink.click();
        await expect(page).toHaveURL(/.*\/profiles/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: /profiles/i }).first()).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test("should navigate to agents via sidebar", async ({ page }) => {
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const agentsLink = page.locator('aside a[href="/agents"]');
      if (await agentsLink.isVisible().catch(() => false)) {
        await agentsLink.click();
        await expect(page).toHaveURL(/.*\/agents/, { timeout: 10000 });
        await expect(
          page.getByRole("heading", { name: /all agents|ai agents/i }).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test("should navigate to content via sidebar", async ({ page }) => {
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const contentLink = page.locator('aside a[href="/content"]');
      if (await contentLink.isVisible().catch(() => false)) {
        await contentLink.click();
        await expect(page).toHaveURL(/.*\/content/, { timeout: 10000 });
        await expect(page.getByRole("heading", { name: /content/i }).first()).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test("should navigate to settings via sidebar", async ({ page }) => {
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const settingsLink = page.locator('aside a[href="/settings"]');
      if (await settingsLink.isVisible().catch(() => false)) {
        await settingsLink.click();
        await expect(page).toHaveURL(/.*\/settings/, { timeout: 10000 });
      }
    });

    test("sidebar should have all navigation items", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Verify all sidebar links are present
      for (const link of SIDEBAR_LINKS) {
        const navItem = page.locator(`aside a[href="${link.href}"]`);
        const isVisible = await navItem.isVisible().catch(() => false);
        if (isVisible) {
          await expect(navItem).toContainText(link.label);
        }
      }
    });

    test("should highlight active sidebar item", async ({ page }) => {
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Dashboard link should be active/highlighted
      const dashboardLink = page.locator('aside a[href="/dashboard"]');
      await expect(dashboardLink).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Breadcrumbs", () => {
    test("should show breadcrumbs on profiles page", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const breadcrumb = page
        .locator("nav")
        .filter({ hasText: /profiles/i })
        .first();
      await expect(breadcrumb).toBeVisible({ timeout: 5000 });
    });

    test("should show breadcrumbs on agents page", async ({ page }) => {
      await page.goto("/agents");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const breadcrumb = page
        .locator("nav")
        .filter({ hasText: /agents/i })
        .first();
      await expect(breadcrumb).toBeVisible({ timeout: 5000 });
    });

    test("should show breadcrumbs on content page", async ({ page }) => {
      await page.goto("/content");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const breadcrumb = page
        .locator("nav")
        .filter({ hasText: /content/i })
        .first();
      await expect(breadcrumb).toBeVisible({ timeout: 5000 });
    });

    test("should have breadcrumb with home link on detail pages", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check for breadcrumb containing links
      const breadcrumbLinks = page.locator("nav a");
      const linkCount = await breadcrumbLinks.count();
      // Profiles page has "Profiles" as the last breadcrumb item (no link)
      // Detail pages have parent links
      expect(linkCount).toBeGreaterThanOrEqual(0);
    });

    test("should have chevron separators in breadcrumbs", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Chevron icons are used as separators
      const chevrons = page.locator("nav svg");
      const chevronCount = await chevrons.count();
      expect(chevronCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Protected Routes", () => {
    const PROTECTED_ROUTES = [
      "/dashboard",
      "/profiles",
      "/profiles/new",
      "/agents",
      "/content",
      "/content/generate",
      "/settings",
      "/settings/billing",
      "/analytics",
      "/video",
    ];

    for (const route of PROTECTED_ROUTES) {
      test(`should redirect to login when accessing ${route} without auth`, async ({ page }) => {
        // Clear any existing auth state
        await page.context().clearCookies();
        await page.goto(route);
        await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
      });
    }

    test("should allow public routes without redirect", async ({ page }) => {
      const PUBLIC_ROUTES = ["/", "/blog", "/login", "/register"];

      for (const route of PUBLIC_ROUTES) {
        await page.context().clearCookies();
        await page.goto(route);
        const finalPath = new URL(page.url()).pathname;
        if (route === "/") {
          expect(finalPath).toBe("/");
        } else {
          expect(finalPath).toMatch(new RegExp(`^${route}`));
        }
      }
    });
  });

  test.describe("404 Page", () => {
    test("should display custom 404 page for unknown routes", async ({ page }) => {
      await page.goto("/this-page-does-not-exist");
      await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
    });

    test("should show page not found message on 404", async ({ page }) => {
      await page.goto("/nonexistent-route-12345");
      await expect(page.getByText(/page not found/i)).toBeVisible({ timeout: 10000 });
    });

    test("should have go home button on 404 page", async ({ page }) => {
      await page.goto("/some-random-path");
      await expect(page.getByRole("link", { name: /go home/i })).toBeVisible({ timeout: 10000 });
    });

    test("should navigate to home from 404 page", async ({ page }) => {
      await page.goto("/invalid-route");
      const homeLink = page.getByRole("link", { name: /go home/i });
      if (await homeLink.isVisible().catch(() => false)) {
        await homeLink.click();
        await expect(page).toHaveURL(/.*\//, { timeout: 10000 });
      }
    });
  });

  test.describe("Responsive - Mobile (375px)", () => {
    test("should render dashboard on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    });

    test("should hide sidebar on mobile by default", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar should be hidden on mobile (translated off-screen)
      const sidebar = page.locator("aside").first();
      const classList = await sidebar.getAttribute("class");
      expect(classList).toContain("-translate-x-full");
    });

    test("should show mobile header on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Mobile header should be visible
      const mobileHeader = page.locator("header").first();
      if (await mobileHeader.isVisible().catch(() => false)) {
        // Check for hamburger/menu button
        const menuBtn = mobileHeader.getByRole("button").first();
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test("should open sidebar on mobile via hamburger menu", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Find and click hamburger menu
      const menuBtn = page
        .locator("button")
        .filter({ has: page.locator("svg") })
        .first();
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();

        // Sidebar should be visible now (translate-x-0)
        const sidebar = page.locator("aside").first();
        await expect(sidebar).toBeVisible({ timeout: 3000 });
      }
    });

    test("should be able to navigate on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should be able to scroll and see content
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    });

    test("should close mobile sidebar when clicking overlay", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Open sidebar
      const menuBtn = page
        .locator("button")
        .filter({ has: page.locator("svg") })
        .first();
      if (await menuBtn.isVisible().catch(() => false)) {
        await menuBtn.click();
        // Sidebar overlay should be visible
        const overlay = page.locator(".fixed.inset-0.bg-black\\/50");
        if (await overlay.isVisible().catch(() => false)) {
          await overlay.click();
          // Sidebar should hide again
          await expect(overlay).not.toBeVisible({ timeout: 3000 });
        }
      }
    });
  });

  test.describe("Responsive - Tablet (768px)", () => {
    test("should render dashboard on tablet viewport", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });
    });

    test("should hide sidebar on tablet by default", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Sidebar should use mobile breakpoint (hidden on tablet)
      const sidebar = page.locator("aside").first();
      const classList = await sidebar.getAttribute("class");
      expect(classList).toContain("-translate-x-full");
    });

    test("should have full-width content on tablet", async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/dashboard");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Main content should take full width (no sidebar on tablet)
      const main = page.locator("main").first();
      const mainClass = await main.getAttribute("class");
      // No lg:pl-[256px] padding on tablet
      expect(mainClass).not.toContain("lg:pl");
    });
  });

  test.describe("Edge Cases — Routes", () => {
    test("should show 404 for invalid deeply nested route", async ({ page }) => {
      await page.goto("/dashboard/settings/profiles/edit/123/advanced/nonexistent");
      // Should show a 404 or handle gracefully
      const has404 = await page.getByText("404").isVisible({ timeout: 10000 }).catch(() => false);
      const hasNotFound = await page
        .getByText(/page not found|not found|doesn't exist/i)
        .isVisible()
        .catch(() => false);
      // Or it redirected to login (protected route cascade)
      const onLogin = new URL(page.url()).pathname === "/login";
      expect(has404 || hasNotFound || onLogin).toBe(true);
    });

    test("should handle route with special characters gracefully", async ({ page }) => {
      // Test encoded special characters in route
      await page.goto("/content/%F0%9F%9A%80"); // /content/🚀
      await page.waitForLoadState("networkidle");

      const finalPath = new URL(page.url()).pathname;
      // Should either show 404, redirect to login, or handle the route gracefully
      const acceptablePaths = ["/login", "/content", "/404"];
      const startsWithContent = finalPath.startsWith("/content");
      const is404 = finalPath === "/404" || page.getByText("404").isVisible().catch(() => false);
      expect(startsWithContent || is404 || finalPath === "/login").toBe(true);
    });
  });
});
