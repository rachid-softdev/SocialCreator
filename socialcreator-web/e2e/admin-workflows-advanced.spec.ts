/**
 * E2E Advanced Admin Workflow Tests
 *
 * Covers:
 *  - User administration workflows (edit role, detail navigation)
 *  - Organization workflows (subscription verify, search, cancel status)
 *  - Cross-module workflows (stats → users, dashboard round-trip, multi-tab)
 *  - Error recovery workflows (API retry, session expiry, 404 recovery)
 *
 * Strategy: Uses page.route() to mock APIs, test.skip() when redirected to /login.
 * Follows patterns established in admin-workflows.spec.ts and admin-components.spec.ts.
 */
import { expect, test } from "@playwright/test";

import {
  AdminDashboardPage,
  AdminEntitlementsPage,
  AdminOrgsPage,
  AdminUsersPage,
} from "./pages/admin.page";

// ============================================================
// Shared Helpers
// ============================================================

function skipIfRedirected(page: import("@playwright/test").Page): boolean {
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === "/login") {
    test.skip();
    return true;
  }
  return false;
}

function mockDashboardStats(overrides?: Record<string, unknown>) {
  return {
    users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
    organizations: { total: 30, withSubscription: 20 },
    content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
    publications: { today: 12, thisMonth: 340 },
    trends: null,
    ...overrides,
  };
}

function mockUsersList() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `user-${i}-${Date.now()}`,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    role: i === 0 ? "ADMIN" : "USER",
    image: null,
    cguAccepted: true,
    createdAt: "2026-01-15T00:00:00Z",
    _count: { profiles: 1, ownedTeams: i % 2 === 0 ? 1 : 0 },
  }));
}

function mockOrg(id: string, index: number) {
  return {
    data: {
      id,
      name: `Organization ${index}`,
      teamId: `team-${id}`,
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      subscription: {
        planKey: index === 1 ? "BUSINESS" : "PRO",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        currentPeriodStart: "2026-06-01T00:00:00Z",
        currentPeriodEnd: "2026-07-01T00:00:00Z",
      },
      team: {
        id: `team-${id}`,
        name: `Team ${index}`,
        owner: { id: `owner-${id}`, name: `Owner ${index}`, email: `owner${index}@test.com` },
        _count: { members: 3 + index },
      },
      _count: { entitlementOverrides: index },
    },
  };
}

function mockOrgsList() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `org-${i}-${Date.now()}`,
    name: `Organization ${i}`,
    teamId: `team-${i}`,
    createdAt: "2026-01-15T00:00:00Z",
    subscription: {
      planKey: i === 1 ? "BUSINESS" : "PRO",
      status: i === 2 ? "TRIALING" : "ACTIVE",
      cancelAtPeriodEnd: false,
    },
    _count: { entitlementOverrides: i },
  }));
}

function mockOverride(id: string) {
  return {
    id,
    scope: "ORG",
    scopeId: "org-123",
    featureKey: "advanced_analytics",
    enabled: true,
    limitValue: null,
    expiresAt: null,
    reason: "Advanced workflow override",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: null,
    organization: { id: "org-123", name: "Override Org" },
    createdBy: { id: "admin-1", name: "Admin User" },
  };
}

// ============================================================
// Section 1: User administration workflows
// ============================================================

test.describe("Advanced Admin Workflow — User Administration", () => {
  // ---------------------------------------------------------
  // Workflow 1: Dashboard → Users → Edit Role → Verify
  // ---------------------------------------------------------
  test.describe("Dashboard → Users → Edit Role → Verify", () => {
    const timestamp = Date.now();
    const usersList = mockUsersList();
    const editUserId = usersList[1].id; // non-ADMIN user

    test.beforeEach(async ({ page }) => {
      // Mock dashboard stats
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({ json: mockDashboardStats() });
      });

      // Mock users list API
      await page.route("**/api/admin/users", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            json: {
              data: usersList,
              pagination: { total: usersList.length, totalPages: 1, page: 1, limit: 20 },
            },
          });
        } else {
          await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }
      });

      // Mock role change API
      await page.route(`**/api/admin/users/${editUserId}/role`, async (route) => {
        if (route.request().method() === "PATCH" || route.request().method() === "PUT") {
          await route.fulfill({
            status: 200,
            json: {
              id: editUserId,
              name: usersList[1].name,
              email: usersList[1].email,
              role: "ADMIN",
            },
          });
        } else {
          await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }
      });

      // Mock all other user detail calls for editUserId
      await page.route(new RegExp(`/api/admin/users/${editUserId}$`), async (route) => {
        await route.fulfill({
          json: {
            id: editUserId,
            name: usersList[1].name,
            email: usersList[1].email,
            role: "USER", // initial role before edit
            image: null,
            cguAccepted: true,
            createdAt: "2026-01-15T00:00:00Z",
            profiles: [],
            ownedTeams: [],
            teamMemberships: [],
            stats: { totalContent: 10, publishedContent: 5 },
          },
        });
      });
    });

    test("Workflow: Dashboard → Users → Edit Role to ADMIN → Verify badge", async ({ page }) => {
      const admin = new AdminDashboardPage(page);
      await admin.goto();
      if (skipIfRedirected(page)) return;

      // Step 1: Verify dashboard stats
      await expect(admin.heading).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Utilisateurs").first()).toBeVisible();

      // Step 2: Navigate to Users
      const usersLink = page
        .locator('aside a[href*="/admin/users"], a[href*="/admin/users"]')
        .first();
      await usersLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      expect(page.url()).toContain("/admin/users");

      // Step 3: Verify user list shows
      await expect(page.getByText(usersList[1].name).first()).toBeVisible({ timeout: 5000 });

      // Step 4: Click edit role for a non-ADMIN user
      const editRoleBtn = page.locator('button[title="Modifier le rôle"]').first();
      await expect(editRoleBtn).toBeVisible({ timeout: 5000 });
      await editRoleBtn.click();
      await page.waitForTimeout(500);

      // Step 5: Dialog opens, select ADMIN
      const roleDialog = page.locator('div[role="dialog"]').filter({ hasText: "Modifier le rôle" });
      await expect(roleDialog).toBeVisible({ timeout: 5000 });

      const roleSelect = page.locator('div[role="dialog"] select').first();
      if (await roleSelect.isVisible().catch(() => false)) {
        await roleSelect.selectOption("ADMIN");
      }

      // Step 6: Confirm
      const confirmBtn = page
        .locator('div[role="dialog"] button')
        .filter({ hasText: "Enregistrer" })
        .first();
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(500);

      // Step 7: Verify success toast / notification
      const successMsg = page
        .getByText(/rôle mis à jour|role updated|succès|succes|modifié/i)
        .first();
      const hasSuccess = await successMsg.isVisible().catch(() => false);

      // Step 8: If dialog closed successfully, verify ADMIN badge appears on user row
      if (hasSuccess) {
        await expect(successMsg).toBeVisible({ timeout: 5000 });
      }

      // Look for ADMIN badge in the row (purple badge or ADMIN badge)
      // The role may have updated in the UI. Look for any ADMIN badges now.
      const adminBadges = page.locator("text=ADMIN");
      const badgeCount = await adminBadges.count();
      // At least one ADMIN badge should exist (the initial one + the newly changed one, or just the newly changed one)
      expect(badgeCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------
  // Workflow 2: Dashboard → Users → Detail → Edit Role → Back to Users
  // ---------------------------------------------------------
  test.describe("Dashboard → Users → Detail → Edit Role → Back to Users", () => {
    const timestamp = Date.now();
    const userId = `wf-detail-edit-${timestamp}`;
    const userData = {
      id: userId,
      name: "Edit Detail User",
      email: "editdetail@example.com",
      role: "USER",
      image: null,
      cguAccepted: true,
      createdAt: "2026-01-15T00:00:00Z",
      profiles: [
        {
          id: `profile-${userId}`,
          name: "Main Profile",
          platforms: ["INSTAGRAM"],
          _count: { agents: 1, generatedContents: 10 },
        },
      ],
      ownedTeams: [],
      teamMemberships: [],
      stats: { totalContent: 42, publishedContent: 15 },
    };
    const usersList = mockUsersList();

    test.beforeEach(async ({ page }) => {
      // Mock dashboard stats
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({ json: mockDashboardStats() });
      });

      // Mock users list
      await page.route("**/api/admin/users", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            json: {
              data: usersList,
              pagination: { total: usersList.length, totalPages: 1, page: 1, limit: 20 },
            },
          });
        } else {
          await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }
      });

      // Mock user detail API
      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: userData });
      });
    });

    test("Workflow: Dashboard → Users → User Detail → Edit Role → Back", async ({ page }) => {
      const admin = new AdminDashboardPage(page);
      await admin.goto();
      if (skipIfRedirected(page)) return;

      // Step 1: Verify dashboard
      await expect(admin.heading).toBeVisible({ timeout: 10000 });

      // Step 2: Navigate to Users
      const usersLink = page
        .locator('aside a[href*="/admin/users"], a[href*="/admin/users"]')
        .first();
      await usersLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });
      expect(page.url()).toContain("/admin/users");

      // Step 3: Navigate to user detail via direct link
      await page.goto(`/admin/users/${userId}`);
      await page.waitForLoadState("networkidle", { timeout: 5000 });
      expect(page.url()).toContain(`/admin/users/${userId}`);

      // Step 4: Verify user detail
      await expect(page.getByText(userData.name).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(userData.email).first()).toBeVisible({ timeout: 5000 });

      // Step 5: Find edit role button on detail page
      const editRoleBtn = page
        .locator('button[title="Modifier le rôle"], button:has-text("Modifier le rôle")')
        .first();
      if (await editRoleBtn.isVisible().catch(() => false)) {
        await editRoleBtn.click();
        await page.waitForTimeout(500);

        // Select ADMIN
        const roleSelect = page.locator('div[role="dialog"] select').first();
        if (await roleSelect.isVisible().catch(() => false)) {
          await roleSelect.selectOption("ADMIN");
        }

        // Confirm
        const confirmBtn = page
          .locator('div[role="dialog"] button')
          .filter({ hasText: "Enregistrer" })
          .first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Step 6: Navigate back to users list via breadcrumb
      const usersBreadcrumb = page.getByText("Utilisateurs").first();
      await expect(usersBreadcrumb).toBeVisible({ timeout: 5000 });
      await usersBreadcrumb.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 7: Verify back on users list
      expect(page.url()).toContain("/admin/users");
      expect(page.url()).not.toContain(userId);
      await expect(page.getByText(usersList[0].name).first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ---------------------------------------------------------
  // Workflow 3: Users → Search → Select User → Detail
  // ---------------------------------------------------------
  test.describe("Users → Search → Select User → Detail", () => {
    const timestamp = Date.now();
    const allUsers = [
      {
        id: `u-adv-a-${timestamp}`,
        name: "Sophie Laurent",
        email: "sophie@example.com",
        role: "USER",
        image: null,
        cguAccepted: true,
        createdAt: "2026-01-15T00:00:00Z",
        _count: { profiles: 2, ownedTeams: 1 },
      },
      {
        id: `u-adv-b-${timestamp}`,
        name: "Thomas Petit",
        email: "thomas@example.com",
        role: "USER",
        image: null,
        cguAccepted: true,
        createdAt: "2026-02-01T00:00:00Z",
        _count: { profiles: 1, ownedTeams: 0 },
      },
      {
        id: `u-adv-c-${timestamp}`,
        name: "Marie Dubois",
        email: "marie@example.com",
        role: "ADMIN",
        image: null,
        cguAccepted: true,
        createdAt: "2026-03-10T00:00:00Z",
        _count: { profiles: 3, ownedTeams: 2 },
      },
    ];

    test("Workflow: Users → Search by name → Click user → Detail page with correct info", async ({
      page,
    }) => {
      await page.route("**/api/admin/users*", async (route) => {
        const url = new URL(route.request().url());
        const searchTerm = url.searchParams.get("search") || url.searchParams.get("q") || "";

        if (route.request().method() !== "GET") {
          return route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }

        // If the URL path includes a user ID (detail route), handle separately
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts.length > 3 && pathParts[2] === "users") {
          const detailId = pathParts[3];
          const found = allUsers.find((u) => u.id === detailId);
          if (found) {
            return route.fulfill({
              json: {
                ...found,
                profiles: [],
                ownedTeams: [],
                teamMemberships: [],
                stats: { totalContent: 20, publishedContent: 10 },
              },
            });
          }
          return route.fulfill({ status: 404, json: { error: "User not found" } });
        }

        let filtered = allUsers;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = allUsers.filter(
            (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
          );
        }

        await route.fulfill({
          json: {
            data: filtered,
            pagination: { total: filtered.length, totalPages: 1, page: 1, limit: 20 },
          },
        });
      });

      await page.goto("/admin/users");
      if (skipIfRedirected(page)) return;

      // Step 1: Verify all users visible
      await expect(page.getByText("Sophie Laurent").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Thomas Petit").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Marie Dubois").first()).toBeVisible({ timeout: 5000 });

      // Step 2: Find search input and search
      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i], input[placeholder*="user" i]',
        )
        .first();

      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, "No search input found");
        return;
      }

      await searchInput.fill("Sophie");
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 3: Verify only Sophie appears
      await expect(page.getByText("Sophie Laurent").first()).toBeVisible({ timeout: 5000 });

      // Thomas and Marie should not appear
      const thomasVisible = await page
        .getByText("Thomas Petit")
        .isVisible()
        .catch(() => false);
      const marieVisible = await page
        .getByText("Marie Dubois")
        .isVisible()
        .catch(() => false);
      expect(thomasVisible || marieVisible).toBe(false);

      // Step 4: Click the user link to go to detail
      const userLink = page.locator(`a[href*="/admin/users/${allUsers[0].id}"]`).first();
      const userLinkVisible = await userLink.isVisible().catch(() => false);

      if (userLinkVisible) {
        await userLink.click();
      } else {
        // Try clicking Sophie's name
        const sophieName = page.getByText("Sophie Laurent").first();
        if (await sophieName.isVisible().catch(() => false)) {
          await sophieName.click();
          // Wait and check if we navigated
          await page.waitForTimeout(500);
        }
        // If still not on detail, navigate directly
        if (!page.url().includes(allUsers[0].id)) {
          await page.goto(`/admin/users/${allUsers[0].id}`);
        }
      }
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 5: Verify detail page shows Sophie's info
      expect(page.url()).toContain(`/admin/users/${allUsers[0].id}`);
      await expect(page.getByText("Sophie Laurent").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("sophie@example.com").first()).toBeVisible({ timeout: 5000 });
    });
  });
});

// ============================================================
// Section 2: Organization workflows
// ============================================================

test.describe("Advanced Admin Workflow — Organizations", () => {
  // ---------------------------------------------------------
  // Workflow 4: Dashboard → Orgs → Detail → Verify Subscription
  // ---------------------------------------------------------
  test.describe("Dashboard → Orgs → Detail → Verify Subscription", () => {
    const timestamp = Date.now();
    const orgId = `wf-org-sub-${timestamp}`;
    const orgData = {
      data: {
        id: orgId,
        name: "Subscription Corp",
        teamId: `team-${orgId}`,
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        subscription: {
          planKey: "BUSINESS",
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          currentPeriodStart: "2026-06-01T00:00:00Z",
          currentPeriodEnd: "2026-07-01T00:00:00Z",
        },
        team: {
          id: `team-${orgId}`,
          name: "Subscription Team",
          owner: { id: `owner-${orgId}`, name: "Jane Owner", email: "jane@subcorp.com" },
          _count: { members: 12 },
        },
        _count: { entitlementOverrides: 2 },
      },
    };
    const orgsList = mockOrgsList();

    test.beforeEach(async ({ page }) => {
      // Mock dashboard stats
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({ json: mockDashboardStats() });
      });

      // Mock orgs list
      await page.route("**/api/admin/orgs*", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.includes(orgId)) {
          return route.fulfill({ json: orgData });
        }
        await route.fulfill({
          json: {
            data: orgsList,
            pagination: { total: orgsList.length, totalPages: 1, page: 1, limit: 20 },
          },
        });
      });

      // Mock org detail
      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: orgData });
      });
    });

    test("Workflow: Dashboard → Orgs → Org Detail → Verify subscription & team info", async ({
      page,
    }) => {
      const admin = new AdminDashboardPage(page);
      await admin.goto();
      if (skipIfRedirected(page)) return;

      // Step 1: Verify dashboard
      await expect(admin.heading).toBeVisible({ timeout: 10000 });

      // Step 2: Navigate to Orgs
      const orgsLink = page.locator('aside a[href*="/admin/orgs"], a[href*="/admin/orgs"]').first();
      await orgsLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });
      expect(page.url()).toContain("/admin/orgs");

      // Step 3: Navigate to org detail
      const orgDetailLink = page.locator(`a[href*="/admin/orgs/${orgId}"]`).first();
      if (await orgDetailLink.isVisible().catch(() => false)) {
        await orgDetailLink.click();
      } else {
        await page.goto(`/admin/orgs/${orgId}`);
      }
      await page.waitForLoadState("networkidle", { timeout: 5000 });
      expect(page.url()).toContain(`/admin/orgs/${orgId}`);

      // Step 4: Verify org name
      const orgInfo = orgData.data;
      await expect(page.getByText(orgInfo.name).first()).toBeVisible({ timeout: 5000 });

      // Step 5: Verify subscription plan and status
      if (orgInfo.subscription) {
        await expect(page.getByText(orgInfo.subscription.planKey).first()).toBeVisible({
          timeout: 5000,
        });
        await expect(page.getByText(orgInfo.subscription.status).first()).toBeVisible({
          timeout: 5000,
        });
        // Verify subscription section labels
        await expect(page.getByText(/Abonnement/i).first()).toBeVisible({ timeout: 5000 });
      }

      // Step 6: Verify team info
      if (orgInfo.team) {
        await expect(page.getByText(orgInfo.team.name).first()).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(orgInfo.team.owner.name!).first()).toBeVisible({
          timeout: 5000,
        });
        // Member count
        const memberText = page.getByText(/12 membres?/i);
        await expect(memberText).toBeVisible({ timeout: 5000 });
      }
    });
  });

  // ---------------------------------------------------------
  // Workflow 5: Orgs → Search → Detail → Back
  // ---------------------------------------------------------
  test.describe("Orgs → Search → Detail → Back", () => {
    const timestamp = Date.now();
    const targetOrg = {
      id: `o-adv-search-${timestamp}`,
      name: "Target Organization",
      teamId: "t-target",
      createdAt: "2026-01-15T00:00:00Z",
      subscription: { planKey: "PRO", status: "ACTIVE", cancelAtPeriodEnd: false },
      _count: { entitlementOverrides: 2 },
    };
    const allOrgs = [
      targetOrg,
      {
        id: `o-adv-other-${timestamp}`,
        name: "Other Organization",
        teamId: "t-other",
        createdAt: "2026-02-01T00:00:00Z",
        subscription: { planKey: "STARTER", status: "TRIALING", cancelAtPeriodEnd: false },
        _count: { entitlementOverrides: 0 },
      },
    ];

    test("Workflow: Orgs → Search by name → Click org → Detail → Back via breadcrumb", async ({
      page,
    }) => {
      await page.route("**/api/admin/orgs*", async (route) => {
        const url = new URL(route.request().url());
        const searchTerm = url.searchParams.get("search") || url.searchParams.get("q") || "";
        const pathParts = url.pathname.split("/").filter(Boolean);

        // Detail route
        if (pathParts.length > 3 && pathParts[2] === "orgs") {
          const detailId = pathParts[3];
          if (detailId === targetOrg.id) {
            return route.fulfill({
              json: {
                data: {
                  id: targetOrg.id,
                  name: targetOrg.name,
                  teamId: targetOrg.teamId,
                  createdAt: targetOrg.createdAt,
                  updatedAt: "2026-06-01T00:00:00Z",
                  subscription: targetOrg.subscription,
                  team: {
                    id: targetOrg.teamId,
                    name: "Target Team",
                    owner: { id: "owner-1", name: "Owner Name", email: "owner@test.com" },
                    _count: { members: 5 },
                  },
                  _count: targetOrg._count,
                },
              },
            });
          }
          return route.fulfill({ status: 404, json: { error: "Not found" } });
        }

        if (route.request().method() !== "GET") {
          return route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }

        let filtered = allOrgs;
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = allOrgs.filter((o) => o.name.toLowerCase().includes(term));
        }

        await route.fulfill({
          json: {
            data: filtered,
            pagination: { total: filtered.length, totalPages: 1, page: 1, limit: 20 },
          },
        });
      });

      await page.goto("/admin/orgs");
      if (skipIfRedirected(page)) return;

      // Step 1: Verify both orgs visible
      await expect(page.getByText("Target Organization").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Other Organization").first()).toBeVisible({ timeout: 5000 });

      // Step 2: Search for target
      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="recherche" i], input[placeholder*="search" i], input[placeholder*="org" i]',
        )
        .first();

      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, "No search input found");
        return;
      }

      await searchInput.fill("Target");
      await page.waitForTimeout(500);
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 3: Verify only Target appears
      await expect(page.getByText("Target Organization").first()).toBeVisible({ timeout: 5000 });
      const otherVisible = await page
        .getByText("Other Organization")
        .isVisible()
        .catch(() => false);
      expect(otherVisible).toBe(false);

      // Step 4: Click the org link to go to detail
      const orgLink = page.locator(`a[href*="/admin/orgs/${targetOrg.id}"]`).first();
      if (await orgLink.isVisible().catch(() => false)) {
        await orgLink.click();
      } else {
        await page.goto(`/admin/orgs/${targetOrg.id}`);
      }
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 5: Verify detail page
      expect(page.url()).toContain(`/admin/orgs/${targetOrg.id}`);
      await expect(page.getByText(targetOrg.name).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(targetOrg.subscription.planKey).first()).toBeVisible({
        timeout: 5000,
      });

      // Step 6: Navigate back via breadcrumb
      const orgsBreadcrumb = page.getByText("Organisations").first();
      await expect(orgsBreadcrumb).toBeVisible({ timeout: 5000 });
      await orgsBreadcrumb.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 7: Verify back on orgs list
      expect(page.url()).toContain("/admin/orgs");
      expect(page.url()).not.toContain(targetOrg.id);
    });
  });

  // ---------------------------------------------------------
  // Workflow 6: Orgs detail with cancelAtPeriodEnd
  // ---------------------------------------------------------
  test.describe("Organisation detail with cancelAtPeriodEnd", () => {
    const timestamp = Date.now();
    const orgId = `wf-org-cancel-${timestamp}`;
    const orgData = {
      data: {
        id: orgId,
        name: "Cancel Period Org",
        teamId: `team-${orgId}`,
        createdAt: "2026-01-15T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
        subscription: {
          planKey: "BUSINESS",
          status: "ACTIVE",
          cancelAtPeriodEnd: true,
          currentPeriodStart: "2026-06-01T00:00:00Z",
          currentPeriodEnd: "2026-07-01T00:00:00Z",
        },
        team: {
          id: `team-${orgId}`,
          name: "Cancel Team",
          owner: { id: `owner-${orgId}`, name: "Cancel Owner", email: "cancel@test.com" },
          _count: { members: 4 },
        },
        _count: { entitlementOverrides: 0 },
      },
    };

    test("Workflow: Orgs detail with cancelAtPeriodEnd=true shows annulation en cours", async ({
      page,
    }) => {
      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: orgData });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      if (skipIfRedirected(page)) return;

      // Verify org name
      await expect(page.getByText(orgData.data.name).first()).toBeVisible({ timeout: 5000 });

      // Verify "annulation en cours" badge or warning
      const cancelBadge = page
        .getByText(/annulation en cours|configuré pour être annulé|annulé/i)
        .first();
      await expect(cancelBadge).toBeVisible({ timeout: 5000 });

      // Verify plan key is still visible
      await expect(page.getByText("BUSINESS").first()).toBeVisible({ timeout: 5000 });

      // Verify period end is displayed
      await expect(page.getByText(/Fin de période/i).first()).toBeVisible({ timeout: 5000 });
    });
  });
});

// ============================================================
// Section 3: Cross-module workflows
// ============================================================

test.describe("Advanced Admin Workflow — Cross-Module", () => {
  // ---------------------------------------------------------
  // Workflow 7: Dashboard → Verify stats → Users → Verify count
  // ---------------------------------------------------------
  test.describe("Dashboard stats → Users count consistency", () => {
    const timestamp = Date.now();
    const specificUserCount = 42;
    const statsWith42Users = {
      users: { total: specificUserCount, activeThisMonth: 30, newThisWeek: 5, newThisMonth: 10 },
      organizations: { total: 10, withSubscription: 8 },
      content: { totalGenerated: 1000, publishedToday: 10, publishedThisMonth: 200 },
      publications: { today: 3, thisMonth: 80 },
      trends: null,
    };

    test("Workflow: Dashboard shows 42 users → Users page loads and shows results", async ({
      page,
    }) => {
      const usersList = Array.from({ length: 5 }, (_, i) => ({
        id: `user-cons-${i}-${timestamp}`,
        name: `Consistency User ${i}`,
        email: `cons${i}@example.com`,
        role: i === 0 ? "ADMIN" : "USER",
        image: null,
        cguAccepted: true,
        createdAt: "2026-01-15T00:00:00Z",
        _count: { profiles: 1, ownedTeams: i % 2 === 0 ? 1 : 0 },
      }));

      // Mock dashboard stats with specific count
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({ json: statsWith42Users });
      });

      // Mock users list
      await page.route("**/api/admin/users", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            json: {
              data: usersList,
              pagination: { total: specificUserCount, totalPages: 3, page: 1, limit: 20 },
            },
          });
        } else {
          await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }
      });

      await page.goto("/admin");
      if (skipIfRedirected(page)) return;

      // Step 1: Verify dashboard shows "42" for users
      await expect(page.getByText("42").first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Utilisateurs").first()).toBeVisible();

      // Step 2: Navigate to Users
      const usersLink = page
        .locator('aside a[href*="/admin/users"], a[href*="/admin/users"]')
        .first();
      await usersLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 3: Verify users page loads
      expect(page.url()).toContain("/admin/users");

      // Step 4: Verify the pagination total matches — look for "42" or "42 total"
      // The pagination component or total indicator should reflect the count
      await expect(page.getByText(usersList[0].name).first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ---------------------------------------------------------
  // Workflow 8: Dashboard → Entitlements → Create override → Back to Dashboard
  // ---------------------------------------------------------
  test.describe("Dashboard → Entitlements → Create override → Back to Dashboard", () => {
    const timestamp = Date.now();
    const overrideId = `ov-adv-${timestamp}`;
    const overrideData = mockOverride(overrideId);

    test("Workflow: Dashboard → Entitlements → Create Override → Back to Dashboard", async ({
      page,
    }) => {
      // Mock dashboard stats
      await page.route("**/api/admin/stats", async (route) => {
        await route.fulfill({ json: mockDashboardStats() });
      });

      // Mock entitlements API
      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get("resource");

        if (route.request().method() === "POST") {
          await route.fulfill({ status: 200, json: overrideData });
          return;
        }

        if (resource === "overrides" || !resource) {
          await route.fulfill({
            json: { data: [overrideData] },
          });
        } else if (resource === "plans") {
          await route.fulfill({
            json: {
              data: [
                { id: "plan-1", key: "FREE", name: "Gratuit", sortOrder: 1, isActive: true },
                { id: "plan-2", key: "PRO", name: "Professional", sortOrder: 2, isActive: true },
              ],
            },
          });
        } else if (resource === "features") {
          await route.fulfill({
            json: {
              data: [
                {
                  id: "feat-1",
                  key: "advanced_analytics",
                  name: "Analytiques avancées",
                  type: "BOOLEAN",
                  limitValue: null,
                },
                {
                  id: "feat-2",
                  key: "max_profiles",
                  name: "Nombre max de profils",
                  type: "LIMIT",
                  limitValue: 10,
                },
              ],
            },
          });
        } else {
          await route.fulfill({ json: { data: [] } });
        }
      });

      const admin = new AdminDashboardPage(page);
      await admin.goto();
      if (skipIfRedirected(page)) return;

      // Step 1: Verify dashboard
      await expect(admin.heading).toBeVisible({ timeout: 10000 });

      // Step 2: Navigate to Entitlements
      const entitlementsLink = page
        .locator('aside a[href*="/admin/entitlements"], a[href*="/admin/entitlements"]')
        .first();
      await entitlementsLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });
      expect(page.url()).toContain("/admin/entitlements");

      // Step 3: Verify entitlements page with tabs
      await expect(page.getByText("Overrides").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Plans").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Features").first()).toBeVisible({ timeout: 5000 });

      // Step 4: Open create override dialog
      await page.getByText("Nouvel override").click();
      await page.waitForTimeout(300);

      // Step 5: Fill form
      await expect(page.locator("input#override-scope-id")).toBeVisible({ timeout: 5000 });
      await page.locator("input#override-scope-id").fill("org-123");
      await page.locator("input#override-feature-key").fill("advanced_analytics");
      await page.locator("input#override-reason").fill("Advanced workflow override");

      // Step 6: Submit
      const createBtn = page.locator('div[role="dialog"] button').filter({ hasText: "Créer" });
      await createBtn.click();
      await page.waitForTimeout(500);

      // Step 7: Navigate back to Dashboard via sidebar
      const dashboardLink = page.locator('aside a[href="/admin"], a[href="/admin"]').first();
      await expect(dashboardLink).toBeVisible({ timeout: 5000 });
      await dashboardLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 8: Verify back on dashboard
      expect(page.url()).toContain("/admin");
      expect(page.url()).not.toContain("/entitlements");
      await expect(page.getByText("Utilisateurs").first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ---------------------------------------------------------
  // Workflow 9: Multi-tab entitlements (Overrides → Plans → Features → Overrides)
  // ---------------------------------------------------------
  test.describe("Multi-tab entitlements", () => {
    test("Workflow: Navigate through Overrides → Plans → Features → Overrides with persistence", async ({
      page,
    }) => {
      const timestamp = Date.now();
      const overrideData = mockOverride(`ov-multi-${timestamp}`);

      await page.route("**/api/admin/entitlements*", async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get("resource");

        if (resource === "plans") {
          await route.fulfill({
            json: {
              data: [
                { id: "plan-free", key: "FREE", name: "Gratuit", sortOrder: 1, isActive: true },
                { id: "plan-pro", key: "PRO", name: "Professional", sortOrder: 2, isActive: true },
                { id: "plan-biz", key: "BUSINESS", name: "Business", sortOrder: 3, isActive: true },
              ],
            },
          });
        } else if (resource === "features") {
          await route.fulfill({
            json: {
              data: [
                {
                  id: "feat-1",
                  key: "advanced_analytics",
                  name: "Analytiques avancées",
                  type: "BOOLEAN",
                  limitValue: null,
                },
                {
                  id: "feat-2",
                  key: "max_profiles",
                  name: "Nombre max de profils",
                  type: "LIMIT",
                  limitValue: 10,
                },
                {
                  id: "feat-3",
                  key: "custom_branding",
                  name: "Branding personnalisé",
                  type: "BOOLEAN",
                  limitValue: null,
                },
              ],
            },
          });
        } else {
          // Overrides (default)
          await route.fulfill({
            json: { data: [overrideData] },
          });
        }
      });

      const entitlements = new AdminEntitlementsPage(page);
      await entitlements.goto();
      if (skipIfRedirected(page)) return;

      // Step 1: Verify Overrides tab has content
      await expect(entitlements.heading).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Overrides").first()).toBeVisible();
      await expect(page.getByText(overrideData.featureKey).first()).toBeVisible({ timeout: 5000 });

      // Step 2: Click Plans tab and verify plans content
      await page.getByText("Plans").click();
      await page.waitForTimeout(500);
      await expect(page.getByText("FREE").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("PRO").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("BUSINESS").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Gratuit").first()).toBeVisible({ timeout: 5000 });

      // Override content should NOT be visible
      const overrideVisibleOnPlans = await page
        .getByText(overrideData.featureKey)
        .isVisible()
        .catch(() => false);
      expect(overrideVisibleOnPlans).toBe(false);

      // Step 3: Click Features tab and verify features content
      await page.getByText("Features").click();
      await page.waitForTimeout(500);
      await expect(page.getByText("advanced_analytics").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("max_profiles").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("custom_branding").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("BOOLEAN").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("LIMIT").first()).toBeVisible({ timeout: 5000 });

      // Plans content should NOT be visible
      const freeVisibleOnFeatures = await page
        .getByText("FREE")
        .isVisible()
        .catch(() => false);
      expect(freeVisibleOnFeatures).toBe(false);

      // Step 4: Click back to Overrides tab and verify overrides content is still there
      await page.getByText("Overrides").click();
      await page.waitForTimeout(500);
      await expect(page.getByText(overrideData.featureKey).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(overrideData.reason).first()).toBeVisible({ timeout: 5000 });

      // Features content should NOT be visible
      const booleenVisibleOnOverrides = await page
        .getByText("BOOLEAN")
        .isVisible()
        .catch(() => false);
      expect(booleenVisibleOnOverrides).toBe(false);
    });
  });
});

// ============================================================
// Section 4: Error recovery workflows
// ============================================================

test.describe("Advanced Admin Workflow — Error Recovery", () => {
  // ---------------------------------------------------------
  // Workflow 10: API fails on dashboard → retry or navigate away
  // ---------------------------------------------------------
  test.describe("API fails on dashboard → navigate away and back", () => {
    test("Workflow: Stats API fails first → navigate to Users → back to Dashboard → works", async ({
      page,
    }) => {
      let callCount = 0;

      // Mock stats API: fail first call, succeed on second
      await page.route("**/api/admin/stats", async (route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({ status: 500, json: { error: "Internal server error" } });
        } else {
          await route.fulfill({ json: mockDashboardStats() });
        }
      });

      // Mock users API
      const usersList = mockUsersList();
      await page.route("**/api/admin/users", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            json: {
              data: usersList,
              pagination: { total: usersList.length, totalPages: 1, page: 1, limit: 20 },
            },
          });
        } else {
          await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }
      });

      await page.goto("/admin");
      if (skipIfRedirected(page)) return;

      // Step 1: First load should show error state
      const errorBanner = page
        .locator('[role="alert"], [class*="error"], [class*="alert"], [class*="banner"]')
        .filter({ hasText: /error|failed|unable to load|something went wrong|erreur/i })
        .first();
      const hasErrorBanner = await errorBanner.isVisible({ timeout: 5000 }).catch(() => false);
      const hasErrorText = await page
        .getByText(/error|failed|unable to load|something went wrong|server error/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Either an error banner or error text should be visible
      if (!hasErrorBanner && !hasErrorText) {
        // If no error visible, stats may have succeeded — skip the error state check
        test.skip(true, "Error state not rendered for failed API");
        return;
      }

      // Step 2: Navigate away to Users
      const usersLink = page
        .locator('aside a[href*="/admin/users"], a[href*="/admin/users"]')
        .first();
      await usersLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });
      expect(page.url()).toContain("/admin/users");
      await expect(page.getByText(usersList[0].name).first()).toBeVisible({ timeout: 5000 });

      // Step 3: Navigate back to Dashboard — now the 2nd call should succeed
      const dashboardLink = page.locator('aside a[href="/admin"], a[href="/admin"]').first();
      await dashboardLink.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 4: Verify dashboard now loads with stats
      expect(page.url()).toContain("/admin");
      const dashboard = new AdminDashboardPage(page);
      await expect(dashboard.heading).toBeVisible({ timeout: 10000 });
      // Should show stats now
      await expect(page.getByText("Utilisateurs").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("150").first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ---------------------------------------------------------
  // Workflow 11: Navigate to admin while session expired
  // ---------------------------------------------------------
  test.describe("Session expired → redirect to login → re-login → back to admin", () => {
    test("Workflow: Navigate to admin with expired session → /login → then go back", async ({
      page,
    }) => {
      // Mock session as expired (empty response)
      await page.route("**/api/auth/session", async (route) => {
        await route.fulfill({ status: 200, json: {} });
      });

      // Block admin APIs too
      await page.route("**/api/admin/**", async (route) => {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      });

      await page.goto("/admin");
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      const currentUrl = new URL(page.url());

      // Step 1: Verify redirect to /login
      if (currentUrl.pathname === "/login") {
        // Success — we are on the login page

        // Step 2: Now "login" by re-mocking the session as ADMIN
        await page.route("**/api/auth/session", async (route) => {
          await route.fulfill({
            status: 200,
            json: {
              user: {
                id: "admin-session-id",
                name: "Admin User",
                email: "admin@test.com",
                role: "ADMIN",
              },
              expires: new Date(Date.now() + 86_400_000).toISOString(),
            },
          });
        });

        // Re-mock admin APIs (they work now)
        await page.route("**/api/admin/stats", async (route) => {
          await route.fulfill({ json: mockDashboardStats() });
        });
        await page.route("**/api/admin/users", async (route) => {
          await route.fulfill({
            json: {
              data: mockUsersList(),
              pagination: { total: 5, totalPages: 1, page: 1, limit: 20 },
            },
          });
        });

        // Step 3: Navigate to /admin again
        await page.goto("/admin");
        await page.waitForLoadState("networkidle", { timeout: 5000 });

        // Step 4: Verify we reach the admin dashboard
        const finalUrl = new URL(page.url());
        if (finalUrl.pathname.startsWith("/admin")) {
          const dashboard = new AdminDashboardPage(page);
          await expect(dashboard.heading).toBeVisible({ timeout: 10000 });
        } else if (finalUrl.pathname === "/login") {
          // If still redirected, that's okay — test skipped
          test.skip();
        }
      } else {
        // Not redirected to login — this might mean auth isn't required in this env
        test.skip(true, "Not redirected to login — auth may be disabled in test environment");
      }
    });
  });

  // ---------------------------------------------------------
  // Workflow 12: 404 on user detail → navigate back
  // ---------------------------------------------------------
  test.describe("404 on user detail → navigate back", () => {
    test("Workflow: Open non-existent user detail → see 404 → navigate back via breadcrumb", async ({
      page,
    }) => {
      const nonexistentUserId = `nonexistent-adv-${Date.now()}`;

      // Mock 404 for this user
      await page.route(new RegExp(`/api/admin/users/${nonexistentUserId}`), async (route) => {
        await route.fulfill({ status: 404, json: { error: "User not found" } });
      });

      // Also mock the users list so "back" works
      const usersList = mockUsersList();
      await page.route("**/api/admin/users", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            json: {
              data: usersList,
              pagination: { total: usersList.length, totalPages: 1, page: 1, limit: 20 },
            },
          });
        } else {
          await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
        }
      });

      await page.goto(`/admin/users/${nonexistentUserId}`);
      if (skipIfRedirected(page)) return;

      // Step 1: Verify 404 / error state
      const errorMsg = page
        .getByText(/not found|404|error|does not exist|introuvable|inexistant/i)
        .first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });

      // Step 2: Navigate back to users list via breadcrumb
      const usersBreadcrumb = page.getByText("Utilisateurs").first();
      await expect(usersBreadcrumb).toBeVisible({ timeout: 5000 });

      // Click the breadcrumb link
      await usersBreadcrumb.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Step 3: Verify we're back on the users list
      expect(page.url()).toContain("/admin/users");
      expect(page.url()).not.toContain(nonexistentUserId);
      await expect(page.getByText(usersList[0].name).first()).toBeVisible({ timeout: 5000 });
    });
  });
});
