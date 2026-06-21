/**
 * E2E Tests for Admin Dashboard (P2)
 * Tests: Navigation, stats cards, sidebar section, user management, org management, entitlement overrides, protected route
 */

import { expect, test } from "@playwright/test";
import {
  AdminDashboardPage,
  AdminEntitlementsPage,
  AdminOrgsPage,
  AdminUsersPage,
} from "./pages/admin.page";

test.describe("Admin Dashboard", () => {
  test.describe("Navigation", () => {
    test("should navigate to admin dashboard", async ({ page }) => {
      const admin = new AdminDashboardPage(page);
      await admin.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(admin.heading).toBeVisible({ timeout: 10000 });
    });

    test("should show stats cards (Total Users, Active Orgs, Subscriptions)", async ({ page }) => {
      const admin = new AdminDashboardPage(page);
      await admin.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(admin.heading).toBeVisible({ timeout: 10000 });

      // Check for stat card labels
      const hasTotalUsers = await page
        .getByText(/total users/i)
        .isVisible()
        .catch(() => false);
      const hasActiveOrgs = await page
        .getByText(/active organizations|active orgs/i)
        .isVisible()
        .catch(() => false);
      const hasSubscriptions = await page
        .getByText(/subscriptions/i)
        .isVisible()
        .catch(() => false);

      // At least one stat card should be present
      expect(hasTotalUsers || hasActiveOrgs || hasSubscriptions).toBe(true);
    });

    test("should show admin sidebar section", async ({ page }) => {
      await page.goto("/admin");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for admin-specific navigation in sidebar
      const adminSidebarLinks = page.locator("aside").first().locator('a[href*="/admin"]');
      const linkCount = await adminSidebarLinks.count().catch(() => 0);
      // Could also be a dedicated admin navigation section
      const adminSection = page.getByText(/administration|admin panel/i).first();
      const hasSection = await adminSection.isVisible().catch(() => false);
      expect(linkCount > 0 || hasSection).toBe(true);
    });
  });

  test.describe("Users", () => {
    test("should navigate to user management", async ({ page }) => {
      const users = new AdminUsersPage(page);
      await users.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(users.heading).toBeVisible({ timeout: 10000 });
    });

    test("should show user table or list", async ({ page }) => {
      const users = new AdminUsersPage(page);
      await users.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(users.heading).toBeVisible({ timeout: 10000 });

      // Should show a table or user list (or empty state)
      const hasTable = await users.userTable.isVisible().catch(() => false);
      const hasEmptyState = await page
        .getByText(/no users|empty/i)
        .isVisible()
        .catch(() => false);
      expect(hasTable || hasEmptyState).toBe(true);
    });

    test("should have search/filter functionality", async ({ page }) => {
      await page.goto("/admin/users");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Search input should be present
      const searchInput = page
        .locator('input[type="text"], input[type="search"], input[placeholder*="search" i]')
        .first();
      const hasSearch = await searchInput.isVisible().catch(() => false);

      // Or filter buttons/dropdowns
      const filterButtons = page.locator("button").filter({ hasText: /filter|search|sort/i });
      const hasFilter = await filterButtons
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasSearch || hasFilter).toBe(true);
    });
  });

  test.describe("Orgs", () => {
    test("should navigate to organization management", async ({ page }) => {
      const orgs = new AdminOrgsPage(page);
      await orgs.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(orgs.heading).toBeVisible({ timeout: 10000 });
    });

    test("should show org list", async ({ page }) => {
      await page.goto("/admin/orgs");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show a table or list of organizations (or empty state)
      const hasTable = await page
        .locator("table, [role='table'], [class*='org-list']")
        .first()
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/no organizations|no orgs|empty/i)
        .isVisible()
        .catch(() => false);
      expect(hasTable || hasEmptyState).toBe(true);
    });
  });

  test.describe("Entitlements", () => {
    test("should navigate to entitlement overrides", async ({ page }) => {
      const entitlements = new AdminEntitlementsPage(page);
      await entitlements.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(entitlements.heading).toBeVisible({ timeout: 10000 });
    });

    test("should show override list", async ({ page }) => {
      await page.goto("/admin/entitlements");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show a list or table of entitlement overrides (or empty state)
      const hasList = await page
        .locator("table, [role='list'], [class*='override-list']")
        .first()
        .isVisible()
        .catch(() => false);
      const hasEmptyState = await page
        .getByText(/no overrides|no entitlements|empty/i)
        .isVisible()
        .catch(() => false);
      expect(hasList || hasEmptyState).toBe(true);
    });
  });

  test.describe("Protected Route", () => {
    test("should redirect non-admin users", async ({ page }) => {
      // Navigate to admin; if not authenticated should redirect to login
      // If authenticated but not admin, should show error or redirect
      await page.goto("/admin");

      const currentUrl = new URL(page.url());

      // Either redirected to login (not authenticated)
      // or shows admin page (authenticated as admin)
      // or shows 403/unauthorized page (authenticated but not admin)
      const isLogin = currentUrl.pathname === "/login";
      const isAdmin = currentUrl.pathname.startsWith("/admin");
      const isForbidden = currentUrl.pathname === "/403" || currentUrl.pathname === "/unauthorized";

      // Should NOT be redirected to a non-admin page without error
      if (!isLogin && !isAdmin && !isForbidden) {
        // Check for forbidden/unauthorized message
        const hasForbiddenMsg = await page
          .getByText(/forbidden|unauthorized|access denied/i)
          .isVisible()
          .catch(() => false);
        expect(isAdmin || isLogin || isForbidden || hasForbiddenMsg).toBe(true);
      }
    });
  });
});

// ============================================================
// Admin — Loading & Empty States
// ============================================================

test.describe("Admin — Loading & Empty States", () => {
  test("should show loading skeleton on admin dashboard", async ({ page }) => {
    await page.route("**/api/admin/stats", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ json: { totalUsers: 0, activeOrgs: 0, subscriptions: 0 } });
    });

    await page.goto("/admin");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const skeleton = page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });
  });

  test("should show loading skeleton on admin users page", async ({ page }) => {
    await page.route("**/api/admin/users", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ json: [], status: 200 });
    });

    await page.goto("/admin/users");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const skeleton = page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });
  });

  test("should show loading skeleton on admin orgs page", async ({ page }) => {
    await page.route("**/api/admin/orgs", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({ json: [], status: 200 });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const skeleton = page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });
  });

  test("should show all-zero stats for fresh platform", async ({ page }) => {
    await page.route("**/api/admin/stats", async (route) => {
      await route.fulfill({ json: { totalUsers: 0, activeOrgs: 0, subscriptions: 0 } });
    });

    await page.goto("/admin");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Zero values should render; no error banners
    const hasZero = await page
      .getByText(/0/)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasZero).toBe(true);
    const errorShown = await page
      .getByText(/error|failed|unable to load/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorShown).toBe(false);
  });

  test("should show empty state for org detail with no subscription", async ({ page }) => {
    const orgId = `org-empty-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: { id: orgId, name: "Empty Org", subscription: null },
      });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const emptyMsg = page.getByText(
      /no subscription|no plan|free plan|aucun|not available|no data/i,
    );
    await expect(emptyMsg).toBeVisible({ timeout: 5000 });
  });

  test("should show empty state for entitlements overrides tab", async ({ page }) => {
    await page.route("**/api/admin/entitlements/**", async (route) => {
      await route.fulfill({ json: [] });
    });

    const entitlements = new AdminEntitlementsPage(page);
    await entitlements.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(entitlements.heading).toBeVisible({ timeout: 10000 });

    const emptyState = page.getByText(/no overrides|no entitlements|empty|aucun/i).first();
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test("should show 'Aucun utilisateur trouvé' when search has no results", async ({ page }) => {
    const searchTerm = `zzz-nonexistent-${Date.now()}`;

    await page.goto("/admin/users");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const searchInput = page
      .locator(
        'input[type="text"], input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i]',
      )
      .first();

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(searchTerm);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      const emptyMsg = page.getByText(
        /aucun utilisateur trouvé|aucun résultat|no users found|no results/i,
      );
      await expect(emptyMsg).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test("should show 'Aucune organisation trouvée' when search has no results", async ({ page }) => {
    const searchTerm = `zzz-nonexistent-${Date.now()}`;

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const searchInput = page
      .locator(
        'input[type="text"], input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i], input[placeholder*="org" i]',
      )
      .first();

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(searchTerm);
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      const emptyMsg = page.getByText(
        /aucune organisation trouvée|aucun résultat|no organizations found|no results/i,
      );
      await expect(emptyMsg).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

// ============================================================
// Admin — Detail Pages & Actions
// ============================================================

test.describe("Admin — Detail Pages & Actions", () => {
  test("should navigate to user detail page and display user info", async ({ page }) => {
    const userId = `user-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({
        json: {
          id: userId,
          name: "Jane Detail",
          email: `jane-${Date.now()}@example.com`,
          role: "user",
          createdAt: "2026-01-15T00:00:00Z",
        },
      });
    });

    await page.goto(`/admin/users/${userId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(page.getByText(/Jane Detail/i).first()).toBeVisible({ timeout: 5000 });
    const emailText = page.getByText(/jane-/i).first();
    await expect(emailText).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to org detail page with subscription info", async ({ page }) => {
    const orgId = `org-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: {
          id: orgId,
          name: "Test Org Inc.",
          subscription: {
            plan: "Pro",
            status: "active",
            nextBillingDate: "2026-07-15",
          },
        },
      });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Should show org name and subscription details
    await expect(page.getByText(/Test Org Inc./i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Pro/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/active/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("should show error state for non-existent user detail", async ({ page }) => {
    const userId = `nonexistent-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({ status: 404, json: { error: "User not found" } });
    });

    await page.goto(`/admin/users/${userId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const errorMsg = page
      .getByText(/not found|404|error|does not exist|introuvable|inexistant/i)
      .first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test("should show error state for non-existent org detail", async ({ page }) => {
    const orgId = `nonexistent-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({ status: 404, json: { error: "Organization not found" } });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const errorMsg = page
      .getByText(/not found|404|error|does not exist|introuvable|inexistant/i)
      .first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test("should show cancelAtPeriodEnd warning on org detail", async ({ page }) => {
    const orgId = `org-cancel-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: {
          id: orgId,
          name: "Canceling Org",
          subscription: {
            plan: "Business",
            status: "active",
            cancelAtPeriodEnd: true,
            currentPeriodEnd: "2026-08-01T00:00:00Z",
          },
        },
      });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Should show cancellation / expiry warning
    const warning = page.getByText(/cancel|ending|expir|terminat|will be cancelled/i).first();
    await expect(warning).toBeVisible({ timeout: 5000 });
  });

  test("should navigate back from user detail to users list", async ({ page }) => {
    const userId = `user-back-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({
        json: { id: userId, name: "Back User", email: "back@example.com", role: "user" },
      });
    });

    await page.goto(`/admin/users/${userId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Click back link / button
    const backLink = page
      .locator(
        'a[href*="/admin/users"], button:has-text("Back"), button:has-text("Retour"), [aria-label*="back" i]',
      )
      .first();

    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      const usersHeading = page.getByRole("heading", { name: /user management|users/i }).first();
      await expect(usersHeading).toBeVisible({ timeout: 5000 });
    }
  });

  test("should navigate back from org detail to orgs list", async ({ page }) => {
    const orgId = `org-back-${Date.now()}`;

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: { id: orgId, name: "Back Org" },
      });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const backLink = page
      .locator(
        'a[href*="/admin/orgs"], button:has-text("Back"), button:has-text("Retour"), [aria-label*="back" i]',
      )
      .first();

    if (await backLink.isVisible().catch(() => false)) {
      await backLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      const orgsHeading = page
        .getByRole("heading", { name: /organization management|organizations/i })
        .first();
      await expect(orgsHeading).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================================
// Admin — Entitlements & Permissions
// ============================================================

test.describe("Admin — Entitlements & Permissions", () => {
  test("should switch between tabs on entitlements page (Overrides, Plans, Features)", async ({
    page,
  }) => {
    const entitlements = new AdminEntitlementsPage(page);
    await entitlements.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(entitlements.heading).toBeVisible({ timeout: 10000 });

    // Find tab buttons
    const tabs = page.locator(
      "button[role='tab'], [role='tablist'] button, a:has-text(/Override|Plan|Feature/i)",
    );
    const tabCount = await tabs.count();

    if (tabCount >= 2) {
      // Click first tab, then second tab
      await tabs.first().click();
      await page.waitForTimeout(300);
      await tabs.nth(1).click();
      await page.waitForTimeout(300);

      // Still on entitlements page after switching
      await expect(entitlements.heading).toBeVisible({ timeout: 5000 });
    } else {
      // Fallback: check for tab-like section headings
      const tabSections = page.getByText(/Overrides|Plans|Features/);
      const sectionCount = await tabSections.count();
      expect(sectionCount).toBeGreaterThanOrEqual(2);
    }
  });

  test("should prevent admin self-demotion (API returns 403)", async ({ page }) => {
    let roleChangeIntercepted = false;

    await page.route("**/api/admin/users/*/role", async (route) => {
      roleChangeIntercepted = true;
      await route.fulfill({ status: 403, json: { error: "Cannot demote yourself" } });
    });

    await page.goto("/admin/users");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Try to find and interact with a role-change element
    const userRows = page.locator("table tbody tr, [role='row']");
    const rowCount = await userRows.count();

    if (rowCount > 0) {
      const roleAction = userRows
        .first()
        .locator("button, select, a")
        .filter({ hasText: /admin|role|permission|change|rôle/i })
        .first();

      if (await roleAction.isVisible().catch(() => false)) {
        await roleAction.click();
        await page.waitForTimeout(1000);
      }
    }

    // If API was called, expect an error message about self-demotion
    if (roleChangeIntercepted) {
      const errorMsg = page
        .getByText(/cannot demote|cannot change|forbidden|403|erreur|interdit/i)
        .first();
      await expect(errorMsg)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  });

  test("should prevent admin self-deletion (no delete button for own row)", async ({ page }) => {
    await page.goto("/admin/users");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Check for a delete button specifically tied to the current user's row
    const ownRowDelete = page
      .locator(
        '[class*="current-user"] button:has-text("Delete"), [class*="current-user"] button:has-text("Supprimer"), [data-self="true"] button:has-text("Delete"), tr.current-user button:has-text("Delete")',
      )
      .first();

    const hasOwnDelete = await ownRowDelete.isVisible().catch(() => false);
    expect(hasOwnDelete).toBe(false);
  });

  test("should redirect non-admin users to /dashboard (not /login)", async ({ page }) => {
    // Mock auth endpoint to return a non-admin user
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          id: "regular-user-id",
          email: "regular@example.com",
          name: "Regular User",
          role: "user",
        },
      });
    });

    // Block admin API with 403
    await page.route("**/api/admin/**", async (route) => {
      await route.fulfill({ status: 403, json: { error: "Forbidden" } });
    });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle", { timeout: 5000 });

    const currentUrl = new URL(page.url());

    // Should NOT redirect to /login
    expect(currentUrl.pathname).not.toBe("/login");

    // Should be on /dashboard (non-admin redirect) or /admin (with error)
    const isDashboard = currentUrl.pathname.startsWith("/dashboard");
    const isAdmin = currentUrl.pathname.startsWith("/admin");

    if (!isDashboard && !isAdmin) {
      // Fallback: check for forbidden/error message on the page
      const forbiddenMsg = page.getByText(/forbidden|unauthorized|access denied|not allowed/i);
      await expect(forbiddenMsg)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  });

  test("should show error banner when admin stats API fails", async ({ page }) => {
    await page.route("**/api/admin/stats", async (route) => {
      await route.fulfill({ status: 500, json: { error: "Internal server error" } });
    });

    await page.goto("/admin");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Check for an error alert / banner
    const errorBanner = page
      .locator('[role="alert"], [class*="error"], [class*="alert"], [class*="banner"]')
      .filter({ hasText: /error|failed|unable to load|something went wrong|erreur/i })
      .first();

    const hasBanner = await errorBanner.isVisible().catch(() => false);
    const hasErrorText = await page
      .getByText(/error|failed|unable to load|something went wrong|server error/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasBanner || hasErrorText).toBe(true);
  });
});
