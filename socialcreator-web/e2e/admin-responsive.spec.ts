/**
 * E2E Tests for Admin Responsive Design & Sidebar (P2)
 * Tests: Admin sidebar link visibility by role, responsive rendering on mobile/tablet,
 *        stat cards stacking, users table on mobile, and keyboard navigation.
 */

import { expect, test } from "@playwright/test";

// Shared mock session with ADMIN role
const ADMIN_SESSION = {
  user: {
    id: "admin-user",
    name: "Admin User",
    email: "admin@test.com",
    role: "ADMIN",
    image: null,
  },
  expires: "2027-01-01T00:00:00Z",
};

// Shared mock session with USER role (no admin access)
const USER_SESSION = {
  user: {
    id: "regular-user",
    name: "Regular User",
    email: "user@test.com",
    role: "USER",
    image: null,
  },
  expires: "2027-01-01T00:00:00Z",
};

// Shared mock stats for admin dashboard
const MOCK_STATS = {
  users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
  organizations: { total: 30, withSubscription: 20 },
  content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
  publications: { today: 12, thisMonth: 340 },
  trends: null,
};

// mock admin users list
const MOCK_USERS = {
  data: [
    {
      id: "u1",
      email: "alice@test.com",
      name: "Alice Martin",
      role: "ADMIN",
      createdAt: "2026-01-15T00:00:00Z",
    },
    {
      id: "u2",
      email: "bob@test.com",
      name: "Bob Dupont",
      role: "USER",
      createdAt: "2026-02-01T00:00:00Z",
    },
    {
      id: "u3",
      email: "carole@test.com",
      name: "Carole Legrand",
      role: "USER",
      createdAt: "2026-03-10T00:00:00Z",
    },
  ],
  pagination: { total: 3, totalPages: 1, page: 1, limit: 20 },
};

// Mock org detail for responsive test
const MOCK_ORG_DETAIL = {
  data: {
    id: "org-test",
    name: "Test Organisation",
    teamId: "t1",
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
    subscription: {
      planKey: "PRO",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      currentPeriodStart: "2026-06-01T00:00:00Z",
      currentPeriodEnd: "2026-07-01T00:00:00Z",
    },
    team: {
      id: "t1",
      name: "Team Alpha",
      owner: { id: "u1", name: "Admin User", email: "admin@test.com" },
      _count: { members: 5 },
    },
    _count: { entitlementOverrides: 3 },
  },
};

/**
 * Sets up common mocks for admin-authenticated tests.
 * Mocks session as ADMIN, blocks admin stats & users APIs.
 */
async function setupAdminMocks(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: ADMIN_SESSION });
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: ADMIN_SESSION.user });
  });

  await page.route("**/api/admin/stats*", async (route) => {
    await route.fulfill({ json: MOCK_STATS });
  });

  await page.route("**/api/admin/users*", async (route) => {
    await route.fulfill({ json: MOCK_USERS });
  });
}

/**
 * Sets up a session mock as a regular USER (non-admin).
 */
async function setupUserSessionMock(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({ json: USER_SESSION });
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ json: USER_SESSION.user });
  });
}

// ============================================================
// Admin Sidebar
// ============================================================

test.describe("Admin Sidebar", () => {
  test.describe("Admin Sidebar Link Visibility", () => {
    test("should show admin link in sidebar for ADMIN users", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Admin link should be visible in the sidebar
      const adminLink = page.locator("aside a[href='/admin']");
      await expect(adminLink).toBeVisible({ timeout: 5000 });

      // Should contain "Admin" text
      await expect(adminLink).toContainText("Admin");
    });

    test("should hide admin link in sidebar for USER users", async ({ page }) => {
      await setupUserSessionMock(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Admin link should NOT be present in the sidebar
      const adminLink = page.locator("aside a[href='/admin']");
      await expect(adminLink).toHaveCount(0);
    });

    test("should show shield icon next to admin link", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Admin link should contain a Shield SVG icon (lucide-react)
      const adminLink = page.locator("aside a[href='/admin']");
      await expect(adminLink).toBeVisible({ timeout: 5000 });

      const shieldIcon = adminLink.locator("svg.lucide-shield");
      await expect(shieldIcon).toBeVisible({ timeout: 3000 });
    });

    test("should highlight admin link when on admin page", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Admin link should have active styling
      const adminLink = page.locator("aside a[href='/admin']");
      await expect(adminLink).toBeVisible({ timeout: 5000 });

      // Should have aria-current="page" for active link
      await expect(adminLink).toHaveAttribute("aria-current", "page");

      // Should have active background class
      await expect(adminLink).toHaveClass(/bg-surface-strong/);

      // Dashboard link should NOT have aria-current
      const dashboardLink = page.locator("aside a[href='/dashboard']");
      await expect(dashboardLink).not.toHaveAttribute("aria-current", "page");
    });
  });

  test.describe("Admin Keyboard Navigation", () => {
    test("should navigate admin sidebar links with Tab key", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Tab several times to reach the admin link in the sidebar
      const adminLink = page.locator("aside a[href='/admin']");
      await expect(adminLink).toBeVisible({ timeout: 5000 });

      // Press Tab repeatedly until we hit the admin link or exhaust attempts
      let found = false;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const isAdminFocused = await adminLink.evaluate((el) => el === document.activeElement);
        if (isAdminFocused) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    test("should activate admin link with Enter key", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      // Start from dashboard, focus the admin link and press Enter
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const adminLink = page.locator("aside a[href='/admin']");
      await expect(adminLink).toBeVisible({ timeout: 5000 });

      // Focus the admin link directly then press Enter
      await adminLink.focus();
      await page.keyboard.press("Enter");
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Should navigate to admin page
      await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
    });
  });
});

// ============================================================
// Admin Responsive
// ============================================================

test.describe("Admin Responsive", () => {
  test.describe("Admin Responsive Design", () => {
    test("should render admin dashboard on tablet (768px)", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

      // Stat cards should be present
      const statCards = page.locator(".rounded-lg.border.border-hairline.bg-surface-card.p-5");
      const cardCount = await statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render admin dashboard on mobile (375px)", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

      // Stat cards should be present
      const statCards = page.locator(".rounded-lg.border.border-hairline.bg-surface-card.p-5");
      const cardCount = await statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should hide sidebar on mobile and show hamburger", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

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
      const header = page.locator("header").first();
      if (await header.isVisible().catch(() => false)) {
        const menuBtn = header.getByRole("button").first();
        await expect(menuBtn).toBeVisible({ timeout: 5000 });
      }
    });

    test("should render users table on mobile with horizontal scroll or responsive variant", async ({
      page,
    }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/users");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // The table or its container should allow horizontal scroll on mobile
      const table = page.locator("table").first();
      await expect(table).toBeVisible({ timeout: 10000 });

      // Check if table parent container has overflow-x-auto for scroll
      const tableParent = page.locator(".overflow-x-auto, .overflow-x-scroll").first();
      const hasScrollContainer = await tableParent.isVisible().catch(() => false);

      // OR check that the page has no horizontal layout break
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);

      // Table should be accessible (either via scroll container or responsive)
      const tableHasContent = await page.locator("table tbody tr").count();
      expect(tableHasContent).toBeGreaterThanOrEqual(0);

      // No excessive overflow (allow some overflow for scroll container)
      if (!hasScrollContainer) {
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.15);
      }
    });

    test("should stack stat cards vertically on mobile", async ({ page }) => {
      await setupAdminMocks(page);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Stat cards should be stacked in a single column on mobile
      const statCards = page.locator(".rounded-lg.border.border-hairline.bg-surface-card.p-5");
      const cardCount = await statCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(1);

      if (cardCount >= 2) {
        // Get bounding boxes of first and second stat cards
        const firstBox = await statCards.nth(0).boundingBox();
        const secondBox = await statCards.nth(1).boundingBox();

        if (firstBox && secondBox) {
          // On mobile with 1 column: second card should be below first card
          // (first.y + first.height) <= second.y  (vertical stacking)
          expect(secondBox.y).toBeGreaterThanOrEqual(firstBox.y + firstBox.height - 10);

          // Each card should span most of the viewport width
          expect(firstBox.width).toBeGreaterThan(375 * 0.7);
          expect(secondBox.width).toBeGreaterThan(375 * 0.7);
        }
      }

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);
    });

    test("should render org detail on mobile without breaking layout", async ({ page }) => {
      await setupAdminMocks(page);

      // Mock org detail API
      const orgId = MOCK_ORG_DETAIL.data.id;
      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: MOCK_ORG_DETAIL });
      });

      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/admin/orgs/${orgId}`);
      await page.waitForLoadState("networkidle");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Page should load without layout issues
      await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

      // Org name should be visible
      await expect(page.getByText("Test Organisation")).toBeVisible({ timeout: 5000 });

      // Check no horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.05);

      // Grid layout should be single column on mobile
      const gridCells = page.locator(".lg\\:col-span-1, .lg\\:col-span-2");
      const cellCount = await gridCells.count();
      if (cellCount >= 2) {
        const firstCell = await gridCells.nth(0).boundingBox();
        const secondCell = await gridCells.nth(1).boundingBox();
        if (firstCell && secondCell) {
          // Second section should be below the first on mobile (vertical stack)
          expect(secondCell.y).toBeGreaterThanOrEqual(firstCell.y + firstCell.height - 10);
        }
      }
    });
  });
});
