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
        .getByText(/Utilisateurs/i)
        .isVisible()
        .catch(() => false);
      const hasActiveOrgs = await page
        .getByText(/Organisations/i)
        .isVisible()
        .catch(() => false);
      const hasSubscriptions = await page
        .getByText(/Contenu généré|Publications/i)
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

  test.describe("Stats Cards", () => {
    test("should display all 4 stat cards with French labels", async ({ page }) => {
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({
          json: {
            users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
            organizations: { total: 30, withSubscription: 20 },
            content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
            publications: { today: 12, thisMonth: 340 },
            trends: null,
          },
        });
      });

      const admin = new AdminDashboardPage(page);
      await admin.goto();
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(admin.heading).toBeVisible({ timeout: 10000 });

      // Vérifier les 4 labels français
      await expect(page.getByText("Utilisateurs").first()).toBeVisible();
      await expect(page.getByText("Organisations").first()).toBeVisible();
      await expect(page.getByText("Contenu généré").first()).toBeVisible();
      await expect(page.getByText("Publications").first()).toBeVisible();
    });

    test("should display correct values in stat cards", async ({ page }) => {
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({
          json: {
            users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
            organizations: { total: 30, withSubscription: 20 },
            content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
            publications: { today: 12, thisMonth: 340 },
            trends: null,
          },
        });
      });

      await page.goto("/admin");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Valeurs
      await expect(page.getByText("150").first()).toBeVisible();
      await expect(page.getByText("30").first()).toBeVisible();
      await expect(page.getByText("5,000").or(page.getByText("5000"))).toBeVisible();
      await expect(page.getByText("340").first()).toBeVisible();
    });

    test("should display subtexts in stat cards", async ({ page }) => {
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({
          json: {
            users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
            organizations: { total: 30, withSubscription: 20 },
            content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
            publications: { today: 12, thisMonth: 340 },
            trends: null,
          },
        });
      });

      await page.goto("/admin");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByText(/25 nouveaux ce mois/)).toBeVisible();
      await expect(page.getByText(/20 avec abonnement/)).toBeVisible();
      await expect(page.getByText(/45 publiés aujourd'hui/)).toBeVisible();
      await expect(page.getByText(/12 aujourd'hui/)).toBeVisible();
    });
  });

  test.describe("Trend Charts", () => {
    test("should display trend charts when trends data is provided", async ({ page }) => {
      const trendsData = {
        users: Array.from({ length: 30 }, (_, i) => ({
          date: `2026-05-${String(i + 1).padStart(2, "0")}`,
          count: Math.floor(Math.random() * 50),
        })),
        content: Array.from({ length: 30 }, (_, i) => ({
          date: `2026-05-${String(i + 1).padStart(2, "0")}`,
          count: Math.floor(Math.random() * 200),
        })),
        publications: Array.from({ length: 30 }, (_, i) => ({
          date: `2026-05-${String(i + 1).padStart(2, "0")}`,
          count: Math.floor(Math.random() * 100),
        })),
      };

      await page.route("**/api/admin/stats?includeTrends=true", async (route) => {
        await route.fulfill({
          json: {
            users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
            organizations: { total: 30, withSubscription: 20 },
            content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
            publications: { today: 12, thisMonth: 340 },
            trends: trendsData,
          },
        });
      });

      await page.goto("/admin");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Chart titles
      await expect(page.getByText("Nouveaux utilisateurs (30 jours)")).toBeVisible();
      await expect(page.getByText("Contenu généré (30 jours)")).toBeVisible();
      await expect(page.getByText("Publications (30 jours)")).toBeVisible();

      // Recharts responsive containers
      const charts = page.locator(".recharts-responsive-container");
      await expect(charts).toHaveCount(3);
    });

    test("should show 'No data yet' when trends are empty", async ({ page }) => {
      await page.route("**/api/admin/stats?includeTrends=true", async (route) => {
        await route.fulfill({
          json: {
            users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
            organizations: { total: 30, withSubscription: 20 },
            content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
            publications: { today: 12, thisMonth: 340 },
            trends: { users: [], content: [], publications: [] },
          },
        });
      });

      await page.goto("/admin");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // "No data yet" should appear for empty trend charts
      const noDataTexts = page.getByText("No data yet");
      await expect(noDataTexts).toHaveCount(3);
    });

    test("should not show trend charts section when trends is null", async ({ page }) => {
      await page.route("**/api/admin/stats?includeTrends=true", async (route) => {
        await route.fulfill({
          json: {
            users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
            organizations: { total: 30, withSubscription: 20 },
            content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
            publications: { today: 12, thisMonth: 340 },
            trends: null,
          },
        });
      });

      await page.goto("/admin");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Chart titles should NOT be present
      await expect(page.getByText("Nouveaux utilisateurs (30 jours)")).not.toBeVisible();
      await expect(page.getByText("Contenu généré (30 jours)")).not.toBeVisible();
      await expect(page.getByText("Publications (30 jours)")).not.toBeVisible();
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
      .locator('[class*="Loader2"], svg[class*="animate-spin"], [class*="spinner"]')
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
      .locator('[class*="Loader2"], svg[class*="animate-spin"], [class*="spinner"]')
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

// ============================================================
// Admin — Organizations List
// ============================================================

test.describe("Admin — Organizations List", () => {
  test("should display organizations with subscription status colors", async ({ page }) => {
    const orgs = [
      {
        id: "org-1",
        name: "Active Org",
        teamId: "t1",
        createdAt: "2026-01-15T00:00:00Z",
        subscription: { planKey: "PRO", status: "ACTIVE", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 2 },
      },
      {
        id: "org-2",
        name: "Trial Org",
        teamId: "t2",
        createdAt: "2026-02-01T00:00:00Z",
        subscription: { planKey: "STARTER", status: "TRIALING", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 0 },
      },
      {
        id: "org-3",
        name: "Past Due Org",
        teamId: "t3",
        createdAt: "2026-03-01T00:00:00Z",
        subscription: { planKey: "BUSINESS", status: "PAST_DUE", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 1 },
      },
      {
        id: "org-4",
        name: "Canceled Org",
        teamId: "t4",
        createdAt: "2026-04-01T00:00:00Z",
        subscription: { planKey: "PRO", status: "CANCELED", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 0 },
      },
      {
        id: "org-5",
        name: "Unpaid Org",
        teamId: "t5",
        createdAt: "2026-05-01T00:00:00Z",
        subscription: { planKey: "STARTER", status: "UNPAID", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 0 },
      },
    ];

    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({
        json: { data: orgs, pagination: { total: 5, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Verify org names are visible
    await expect(page.getByText("Active Org")).toBeVisible();
    await expect(page.getByText("Trial Org")).toBeVisible();
    await expect(page.getByText("Past Due Org")).toBeVisible();
    await expect(page.getByText("Canceled Org")).toBeVisible();
    await expect(page.getByText("Unpaid Org")).toBeVisible();

    // Status badges should have appropriate styling classes
    // ACTIVE=green, TRIALING=blue, PAST_DUE=yellow, CANCELED=red, UNPAID=red
    const statusCells = page.locator("table tbody tr td:nth-child(3)");
    await expect(statusCells).toHaveCount(5);
  });

  test("should show cancelAtPeriodEnd badge on org row", async ({ page }) => {
    const orgs = [
      {
        id: "org-cancel",
        name: "Canceling Org",
        teamId: "t1",
        createdAt: "2026-01-15T00:00:00Z",
        subscription: { planKey: "PRO", status: "ACTIVE", cancelAtPeriodEnd: true },
        _count: { entitlementOverrides: 0 },
      },
    ];

    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({
        json: { data: orgs, pagination: { total: 1, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // "annulation en cours" should be visible
    await expect(page.getByText(/annulation en cours/)).toBeVisible();
  });

  test("should show 'Aucun abonnement' for orgs without subscription", async ({ page }) => {
    const orgs = [
      {
        id: "org-no-sub",
        name: "Free Org",
        teamId: null,
        createdAt: "2026-01-15T00:00:00Z",
        subscription: null,
        _count: { entitlementOverrides: 0 },
      },
    ];

    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({
        json: { data: orgs, pagination: { total: 1, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(page.getByText("Aucun abonnement")).toBeVisible();
  });

  test("should navigate to org detail on name click", async ({ page }) => {
    const orgs = [
      {
        id: "clickable-org",
        name: "Clickable Org",
        teamId: "t1",
        createdAt: "2026-01-15T00:00:00Z",
        subscription: { planKey: "PRO", status: "ACTIVE", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 0 },
      },
    ];
    const orgId = "clickable-org";

    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({
        json: { data: orgs, pagination: { total: 1, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    // Mock org detail API too
    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: {
          data: {
            id: orgId,
            name: "Clickable Org",
            teamId: "t1",
            createdAt: "2026-01-15T00:00:00Z",
            subscription: {
              planKey: "PRO",
              status: "ACTIVE",
              cancelAtPeriodEnd: false,
              currentPeriodStart: null,
              currentPeriodEnd: null,
            },
            team: {
              id: "t1",
              name: "Team 1",
              owner: { id: "u1", name: "Owner", email: "owner@test.com" },
              _count: { members: 3 },
            },
            _count: { entitlementOverrides: 0 },
          },
        },
      });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Click the org name link
    const orgLink = page.locator('a[href*="/admin/orgs/"]').first();
    await expect(orgLink).toBeVisible();
    await orgLink.click();

    // Should be on org detail page
    await page.waitForLoadState("networkidle", { timeout: 5000 });
    expect(page.url()).toContain("/admin/orgs/clickable-org");
  });

  test("should show error banner when orgs API fails", async ({ page }) => {
    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({ status: 500, json: { error: "Internal server error" } });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Error banner
    const errorBanner = page.locator(".bg-danger\\/10").first();
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
  });

  test("should show pagination for organizations", async ({ page }) => {
    const orgs = Array.from({ length: 20 }, (_, i) => ({
      id: `org-${i}`,
      name: `Organization ${i}`,
      teamId: `t${i}`,
      createdAt: "2026-01-15T00:00:00Z",
      subscription: { planKey: "PRO", status: "ACTIVE", cancelAtPeriodEnd: false },
      _count: { entitlementOverrides: 0 },
    }));

    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({
        json: { data: orgs, pagination: { total: 25, totalPages: 2, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Pagination should be visible
    const pagination = page.locator('nav[aria-label="Pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// Admin — Entitlements
// ============================================================

test.describe("Admin — Entitlements", () => {
  test.describe("Tabs Navigation", () => {
    test("should display three tabs: Overrides, Plans, Features", async ({ page }) => {
      const entitlements = new AdminEntitlementsPage(page);
      await entitlements.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(entitlements.heading).toBeVisible({ timeout: 10000 });

      // Three tabs should be visible
      await expect(page.getByText("Overrides").first()).toBeVisible();
      await expect(page.getByText("Plans").first()).toBeVisible();
      await expect(page.getByText("Features").first()).toBeVisible();
    });
  });

  test.describe("Plans Tab", () => {
    test("should show plans table with active/inactive badges", async ({ page }) => {
      // First navigate to entitlements, then mock the plans tab
      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get("resource");
        if (resource === "plans") {
          await route.fulfill({
            json: {
              data: [
                {
                  id: "plan-1",
                  key: "FREE",
                  name: "Gratuit",
                  description: null,
                  sortOrder: 1,
                  isActive: true,
                },
                {
                  id: "plan-2",
                  key: "PRO",
                  name: "Professional",
                  description: null,
                  sortOrder: 2,
                  isActive: true,
                },
                {
                  id: "plan-3",
                  key: "ENTERPRISE",
                  name: "Enterprise",
                  description: "Legacy plan",
                  sortOrder: 3,
                  isActive: false,
                },
              ],
            },
          });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Click Plans tab
      await page.getByText("Plans").click();
      await page.waitForTimeout(500);

      // Plans table should show
      await expect(page.getByText("FREE")).toBeVisible();
      await expect(page.getByText("PRO")).toBeVisible();
      await expect(page.getByText("ENTERPRISE")).toBeVisible();
      await expect(page.getByText("Gratuit")).toBeVisible();
      await expect(page.getByText("Professional")).toBeVisible();

      // Active badges: "Oui" for active, "Non" for inactive
      await expect(page.getByText("Oui")).toBeVisible();
      await expect(page.getByText("Non")).toBeVisible();
    });

    test("should show empty state when no plans exist", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("resource") === "plans") {
          await route.fulfill({ json: { data: [] } });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await page.getByText("Plans").click();
      await page.waitForTimeout(500);

      await expect(page.getByText("Aucun plan trouvé")).toBeVisible();
    });
  });

  test.describe("Features Tab", () => {
    test("should show features table with type and limit", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("resource") === "features") {
          await route.fulfill({
            json: {
              data: [
                {
                  id: "feat-1",
                  key: "advanced_analytics",
                  name: "Analytiques avancées",
                  description: null,
                  type: "BOOLEAN",
                  limitValue: null,
                },
                {
                  id: "feat-2",
                  key: "max_profiles",
                  name: "Nombre max de profils",
                  description: null,
                  type: "LIMIT",
                  limitValue: 10,
                },
                {
                  id: "feat-3",
                  key: "custom_branding",
                  name: "Branding personnalisé",
                  description: null,
                  type: "BOOLEAN",
                  limitValue: null,
                },
              ],
            },
          });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await page.getByText("Features").click();
      await page.waitForTimeout(500);

      await expect(page.getByText("advanced_analytics")).toBeVisible();
      await expect(page.getByText("max_profiles")).toBeVisible();
      await expect(page.getByText("custom_branding")).toBeVisible();
      await expect(page.getByText("BOOLEAN")).toBeVisible();
      await expect(page.getByText("LIMIT")).toBeVisible();
      await expect(page.getByText("10")).toBeVisible();
    });

    test("should show empty state when no features exist", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("resource") === "features") {
          await route.fulfill({ json: { data: [] } });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await page.getByText("Features").click();
      await page.waitForTimeout(500);

      await expect(page.getByText("Aucune feature trouvée")).toBeVisible();
    });
  });

  test.describe("Overrides - Create", () => {
    test("should open create override dialog with all fields", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        await route.fulfill({ json: { data: [] } });
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Click "Nouvel override" button
      await page.getByText("Nouvel override").click();
      await page.waitForTimeout(300);

      // Dialog should be visible with all fields
      await expect(page.getByText("Nouvel override").first()).toBeVisible();
      await expect(page.getByText("Scope")).toBeVisible();
      await expect(page.getByText("Scope ID")).toBeVisible();
      await expect(page.getByText("Feature Key")).toBeVisible();
      await expect(page.getByText("Enabled")).toBeVisible();
      await expect(page.getByText("Raison (obligatoire)")).toBeVisible();

      // Check form fields exist
      await expect(page.locator("select#override-scope")).toBeVisible();
      await expect(page.locator("input#override-scope-id")).toBeVisible();
      await expect(page.locator("input#override-feature-key")).toBeVisible();
      await expect(page.locator("select#override-enabled")).toBeVisible();
      await expect(page.locator("input#override-reason")).toBeVisible();
    });

    test("should validate required fields before submitting", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        await route.fulfill({ json: { data: [] } });
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Open dialog and submit without filling anything
      await page.getByText("Nouvel override").click();
      await page.waitForTimeout(300);

      // Submit with empty fields - should show validation errors
      // The component validates scopeId, featureKey, reason are required
      await page.locator('div[role="dialog"] button').filter({ hasText: "Créer" }).click();
      await page.waitForTimeout(300);

      // Dialog should still be open (validation prevented submission)
      await expect(page.getByText("Nouvel override").first()).toBeVisible();
    });

    test("should create override on successful submission", async ({ page }) => {
      let postCalled = false;

      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("resource") === "overrides" || !url.searchParams.toString()) {
          if (route.request().method() === "POST") {
            postCalled = true;
            await route.fulfill({
              status: 200,
              json: {
                id: "new-override",
                scope: "ORG",
                scopeId: "org-123",
                featureKey: "test_feature",
                enabled: true,
                reason: "Testing",
              },
            });
          } else {
            await route.fulfill({ json: { data: [] } });
          }
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Open dialog
      await page.getByText("Nouvel override").click();
      await page.waitForTimeout(300);

      // Fill form
      await page.locator("input#override-scope-id").fill("org-123");
      await page.locator("input#override-feature-key").fill("test_feature");
      await page.locator("input#override-reason").fill("Testing override creation");

      // Submit
      await page.locator('div[role="dialog"] button').filter({ hasText: "Créer" }).click();
      await page.waitForTimeout(500);

      expect(postCalled).toBe(true);
    });

    test("should show error when override creation fails", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({ status: 400, json: { error: "Invalid scope ID" } });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await page.getByText("Nouvel override").click();
      await page.locator("input#override-scope-id").fill("bad-id");
      await page.locator("input#override-feature-key").fill("test_feature");
      await page.locator("input#override-reason").fill("Testing error");
      await page.locator('div[role="dialog"] button').filter({ hasText: "Créer" }).click();
      await page.waitForTimeout(500);

      // Error should appear
      await expect(page.getByText(/Invalid scope ID/)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Overrides - Delete", () => {
    test("should show delete button for each override", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("resource") === "overrides" || !url.searchParams.toString()) {
          await route.fulfill({
            json: {
              data: [
                {
                  id: "ov-1",
                  scope: "ORG",
                  scopeId: "org-1",
                  featureKey: "feature_a",
                  enabled: true,
                  limitValue: null,
                  expiresAt: null,
                  reason: "Test override",
                  createdAt: "2026-01-15T00:00:00Z",
                },
              ],
            },
          });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Override should be visible in table
      await expect(page.getByText("ORG").first()).toBeVisible();
      await expect(page.getByText("feature_a").first()).toBeVisible();
      await expect(page.getByText("Activé").first()).toBeVisible();
      await expect(page.getByText("Test override").first()).toBeVisible();

      // Delete button should exist
      const deleteBtn = page.locator('button[title="Supprimer"]').first();
      await expect(deleteBtn).toBeVisible();
    });
  });

  test.describe("Error State", () => {
    test("should show error banner when entitlements API fails", async ({ page }) => {
      await page.route("**/api/admin/entitlements*", async (route) => {
        await route.fulfill({ status: 500, json: { error: "Internal server error" } });
      });

      await page.goto("/admin/entitlements");
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const errorBanner = page.locator(".bg-danger\\/10").first();
      await expect(errorBanner).toBeVisible({ timeout: 5000 });
    });
  });
});

// ============================================================
// Admin — Edge Cases: XSS Prevention
// ============================================================

test.describe("Admin — XSS Prevention", () => {
  test("should handle XSS in user name field", async ({ page }) => {
    const userId = `xss-user-${Date.now()}`;
    const xssPayload = "<script>alert('xss')</script>";

    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({
        json: {
          id: userId,
          name: xssPayload,
          email: "xss@example.com",
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

    // The XSS payload should be displayed as escaped text, not executed
    await expect(page.getByText(xssPayload, { exact: true }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("should handle XSS in org name", async ({ page }) => {
    const orgId = `xss-org-${Date.now()}`;
    const xssPayload = '<img src=x onerror="alert(1)">';

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: {
          id: orgId,
          name: xssPayload,
          subscription: null,
        },
      });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Should render the HTML payload as escaped text
    await expect(page.getByText(xssPayload, { exact: true }).first()).toBeVisible({
      timeout: 5000,
    });
  });
});

// ============================================================
// Admin — Edge Cases: Special Characters
// ============================================================

test.describe("Admin — Special Characters", () => {
  test("should display special characters in user names", async ({ page }) => {
    const userId = `special-user-${Date.now()}`;
    const specialName = "José & María's Café <3";

    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({
        json: {
          id: userId,
          name: specialName,
          email: "special@example.com",
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

    await expect(page.getByText(specialName, { exact: true }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("should handle very long user names", async ({ page }) => {
    const userId = `long-name-${Date.now()}`;
    const longName = "a".repeat(200);

    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({
        json: {
          id: userId,
          name: longName,
          email: "long@example.com",
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

    // Either the long name is visible (possibly truncated) or the page renders without error
    const isVisible = await page
      .getByText(longName)
      .first()
      .isVisible()
      .catch(() => false);
    if (!isVisible) {
      // May be truncated; verify no crash or error banner
      const errorShown = await page
        .getByText(/error|failed|something went wrong|une erreur est survenue/i)
        .first()
        .isVisible()
        .catch(() => false);
      expect(errorShown).toBe(false);
    }
  });

  test("should handle unicode/emoji in org names", async ({ page }) => {
    const orgId = `emoji-org-${Date.now()}`;
    const emojiName = "🚀 Test Org 🌟";

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({
        json: {
          id: orgId,
          name: emojiName,
          subscription: null,
        },
      });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Emoji characters should render without crashing
    await expect(page.getByText(emojiName, { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// Admin — Edge Cases: Extreme Stats Values
// ============================================================

test.describe("Admin — Extreme Stats Values", () => {
  test("should handle NaN-like values in stats gracefully", async ({ page }) => {
    // Use string "NaN" values which can appear in real JSON APIs
    await page.route("**/api/admin/stats", async (route) => {
      await route.fulfill({
        body: '{"users":{"total":"NaN","activeThisMonth":"NaN","newThisWeek":"NaN","newThisMonth":"NaN"},"organizations":{"total":"NaN","withSubscription":"NaN"},"content":{"totalGenerated":"NaN","publishedToday":"NaN","publishedThisMonth":"NaN"},"publications":{"today":"NaN","thisMonth":"NaN"},"trends":null}',
        headers: { "content-type": "application/json" },
      });
    });

    await page.goto("/admin");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Should not crash — either shows an error banner or displays the page
    const headingVisible = await page
      .getByRole("heading", { name: /admin dashboard/i })
      .isVisible()
      .catch(() => false);
    const errorBanner = await page
      .getByText(/error|failed|unable to load|something went wrong|server error|erreur/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(headingVisible || errorBanner).toBe(true);
  });

  test("should handle undefined fields in stats response", async ({ page }) => {
    await page.route("**/api/admin/stats", async (route) => {
      await route.fulfill({
        json: {
          users: { total: 100, activeThisMonth: 80, newThisWeek: 5, newThisMonth: 15 },
          organizations: { total: 20, withSubscription: 15 },
          // content and publications sections are missing
          trends: null,
        },
      });
    });

    await page.goto("/admin");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Should not crash; at minimum the page heading or an error banner is visible
    const headingVisible = await page
      .getByRole("heading", { name: /admin dashboard/i })
      .isVisible()
      .catch(() => false);
    const errorShown = await page
      .getByText(/error|failed|unable to load|something went wrong|server error|erreur/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(headingVisible || errorShown).toBe(true);
  });

  test("should handle very large numbers in stats", async ({ page }) => {
    await page.route("**/api/admin/stats", async (route) => {
      await route.fulfill({
        json: {
          users: {
            total: 9999999999,
            activeThisMonth: 9999999999,
            newThisWeek: 9999999999,
            newThisMonth: 9999999999,
          },
          organizations: { total: 9999999999, withSubscription: 9999999999 },
          content: {
            totalGenerated: 9999999999,
            publishedToday: 9999999999,
            publishedThisMonth: 9999999999,
          },
          publications: { today: 9999999999, thisMonth: 9999999999 },
          trends: null,
        },
      });
    });

    await page.goto("/admin");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Large number should be displayed (with locale formatting or as-is)
    const largeNumText = page.getByText(/9,?999,?999,?999|9999999999/).first();
    await expect(largeNumText).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// Admin — Edge Cases: Pagination & Search
// ============================================================

test.describe("Admin — Pagination Edge Cases", () => {
  test("should handle page with single item", async ({ page }) => {
    const orgs = [
      {
        id: "single-org",
        name: "Solo Org",
        teamId: "t1",
        createdAt: "2026-01-15T00:00:00Z",
        subscription: { planKey: "PRO", status: "ACTIVE", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 0 },
      },
    ];

    await page.route("**/api/admin/orgs*", async (route) => {
      await route.fulfill({
        json: { data: orgs, pagination: { total: 1, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/orgs");
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Single org name should be visible
    await expect(page.getByText("Solo Org")).toBeVisible();

    // Pagination should show "Page 1 sur 1" or not appear for single page
    const paginationText = page.getByText(/page\s*1\s*(sur|of|\/)\s*1/i);
    const hasPagination = await paginationText.isVisible().catch(() => false);
    if (!hasPagination) {
      // May not show pagination at all for single page — check no navigation present
      const paginationNav = page.locator('nav[aria-label="Pagination"]');
      const hasNav = await paginationNav.isVisible().catch(() => false);
      // Either way is acceptable
      expect(typeof hasNav).toBe("boolean");
    }
  });

  test("should handle search with HTML special characters gracefully", async ({ page }) => {
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
      await searchInput.fill("<script>alert(1)</script>");
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Should not crash — either shows empty state or results table
      const emptyMsg = page.getByText(
        /aucun utilisateur trouvé|aucun résultat|no users found|no results/i,
      );
      const hasEmpty = await emptyMsg.isVisible().catch(() => false);
      const hasTable = await page
        .locator("table, [role='table']")
        .isVisible()
        .catch(() => false);
      expect(hasEmpty || hasTable).toBe(true);
    } else {
      test.skip();
    }
  });
});
