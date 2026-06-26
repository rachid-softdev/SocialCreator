/**
 * E2E Tests for Admin Organization Detail Page (/admin/orgs/[id])
 * Covers: Org info display, subscription, team, overrides, error states, edge cases
 */

import { expect, test } from "@playwright/test";
import { AdminOrgDetailPage } from "./pages/admin-org-detail.page";

const BASE_ORG = {
  id: "",
  name: "Acme Corp",
  teamId: "team-1",
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
    id: "team-1",
    name: "Acme Team",
    owner: { id: "owner-1", name: "John Smith", email: "john@acme.com" },
    _count: { members: 8 },
  },
  _count: {
    entitlementOverrides: 3,
  },
};

function getBaseOrg(id: string) {
  return { ...BASE_ORG, id };
}

test.describe("Admin Org Detail", () => {
  test.describe("Page Display — Success States", () => {
    test("should show org detail page with org name and creation date", async ({ page }) => {
      const orgId = `org-detail-${Date.now()}`;
      const org = getBaseOrg(orgId);

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      const detail = new AdminOrgDetailPage(page);
      await detail.goto(orgId);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Verify org name
      await expect(page.getByText(org.name).first()).toBeVisible({ timeout: 5000 });
      // Should show creation date
      await expect(page.getByText(/Créée le/i).first()).toBeVisible({ timeout: 5000 });
    });

    test("should show org subscription/plan info", async ({ page }) => {
      const orgId = `org-sub-${Date.now()}`;
      const org = getBaseOrg(orgId);

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Plan, status, period end should be visible
      await expect(page.getByText(org.subscription.planKey).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(org.subscription.status).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Abonnement/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Fin de période/i).first()).toBeVisible({ timeout: 5000 });
    });

    test("should show org team info with owner and member count", async ({ page }) => {
      const orgId = `org-team-${Date.now()}`;
      const org = getBaseOrg(orgId);

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Team section should be visible
      await expect(page.getByText(/Équipe/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(org.team.name).first()).toBeVisible({ timeout: 5000 });
      // Owner info
      await expect(page.getByText(org.team.owner.name!).first()).toBeVisible({ timeout: 5000 });
      // Member count
      await expect(page.getByText(/8 membres?/i).first()).toBeVisible({ timeout: 5000 });
    });

    test("should show entitlement overrides count", async ({ page }) => {
      const orgId = `org-overrides-${Date.now()}`;
      const org = getBaseOrg(orgId);

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Overrides section should show count
      await expect(page.getByText(/Surcharges/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(String(org._count.entitlementOverrides)).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("should show breadcrumb with navigation back to org list", async ({ page }) => {
      const orgId = `org-breadcrumb-${Date.now()}`;
      const org = getBaseOrg(orgId);

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Breadcrumb should be visible
      await expect(page.getByText("Administration").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Organisations").first()).toBeVisible({ timeout: 5000 });
      // Back link to org list
      const backLink = page.locator('a[href*="/admin/orgs"]').first();
      await expect(backLink).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Error & Edge States", () => {
    test("should show error when org not found (404)", async ({ page }) => {
      const orgId = `nonexistent-org-${Date.now()}`;

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ status: 404, json: { error: "Organization not found" } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const errorMsg = page.getByText(/not found|introuvable|error|failed/i).first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test("should show error on API failure (500)", async ({ page }) => {
      const orgId = `server-error-org-${Date.now()}`;

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ status: 500, json: { error: "Internal Server Error" } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const errorMsg = page.getByText(/error|failed|internal|server/i).first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test("should show error when accessing another org's detail (403)", async ({ page }) => {
      const orgId = `forbidden-org-${Date.now()}`;

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({
          status: 403,
          json: { error: "Forbidden: not authorized to access this organization" },
        });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const errorMsg = page.getByText(/forbidden|not authorized|access denied|403/i).first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle org with no subscription (free tier)", async ({ page }) => {
      const orgId = `no-sub-${Date.now()}`;
      const org = { ...getBaseOrg(orgId), subscription: null };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show "no subscription" message
      const noSubMsg = page.getByText(/Aucun abonnement/i).first();
      await expect(noSubMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle org with canceled subscription (cancelAtPeriodEnd)", async ({ page }) => {
      const orgId = `cancel-sub-${Date.now()}`;
      const org = {
        ...getBaseOrg(orgId),
        subscription: {
          ...BASE_ORG.subscription,
          cancelAtPeriodEnd: true,
          status: "ACTIVE",
        },
      };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show cancellation warning
      const cancelMsg = page
        .getByText(/annulation en cours|annulé|configuré pour être annulé/i)
        .first();
      await expect(cancelMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle org with no team", async ({ page }) => {
      const orgId = `no-team-${Date.now()}`;
      const org = { ...getBaseOrg(orgId), team: null };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show "no team" message
      const noTeamMsg = page.getByText(/liée à aucune équipe/i).first();
      await expect(noTeamMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle org with zero entitlement overrides", async ({ page }) => {
      const orgId = `zero-overrides-${Date.now()}`;
      const org = { ...getBaseOrg(orgId), _count: { entitlementOverrides: 0 } };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Zero overrides should display
      await expect(page.getByText("0").first()).toBeVisible({ timeout: 5000 });
    });

    test("should handle org with canceled subscription status", async ({ page }) => {
      const orgId = `canceled-status-${Date.now()}`;
      const org = {
        ...getBaseOrg(orgId),
        subscription: { ...BASE_ORG.subscription, status: "CANCELED" },
      };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // CANCELED badge should display with red styling
      const canceledBadge = page.getByText("CANCELED").first();
      await expect(canceledBadge).toBeVisible({ timeout: 5000 });
    });

    test("should handle org with PAST_DUE subscription", async ({ page }) => {
      const orgId = `past-due-${Date.now()}`;
      const org = {
        ...getBaseOrg(orgId),
        subscription: { ...BASE_ORG.subscription, status: "PAST_DUE" },
      };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // PAST_DUE badge should display with yellow styling
      const pastDueBadge = page.getByText("PAST_DUE").first();
      await expect(pastDueBadge).toBeVisible({ timeout: 5000 });
    });

    test("should show loading skeleton while fetching org", async ({ page }) => {
      const orgId = `loading-org-${Date.now()}`;

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({ json: { data: getBaseOrg(orgId) } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const skeleton = page.locator('[class*="skeleton"]').first();
      await expect(skeleton).toBeVisible({ timeout: 3000 });
    });

    test("should handle org with large member count", async ({ page }) => {
      const orgId = `big-team-${Date.now()}`;
      const org = {
        ...getBaseOrg(orgId),
        team: { ...BASE_ORG.team!, _count: { members: 150 } },
      };

      await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
        await route.fulfill({ json: { data: org } });
      });

      await page.goto(`/admin/orgs/${orgId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Large member count should display
      await expect(page.getByText(/150 membres?/i).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Protected Route", () => {
    test("should redirect to login when not authenticated", async ({ page }) => {
      await page.route("**/api/admin/**", async (route) => {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      });

      const orgId = `unauth-org-${Date.now()}`;
      await page.goto(`/admin/orgs/${orgId}`);

      const currentUrl = new URL(page.url());
      const isLogin = currentUrl.pathname === "/login";
      const isForbidden =
        currentUrl.pathname.includes("unauthorized") || currentUrl.pathname.includes("403");
      const hasError = await page
        .getByText(/unauthorized|forbidden|access denied/i)
        .isVisible()
        .catch(() => false);

      expect(isLogin || isForbidden || hasError).toBe(true);
    });
  });
});

test.describe("Admin Org Detail — Navigation & Actions", () => {
  test("should navigate back to orgs list via Retour button", async ({ page }) => {
    const orgId = `nav-back-${Date.now()}`;
    const org = {
      id: orgId,
      name: "Nav Back Org",
      teamId: "team-1",
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      subscription: null,
      team: null,
      _count: { entitlementOverrides: 0 },
    };

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({ json: { data: org } });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Click back button
    const backButton = page.locator('a[href*="/admin/orgs"]').first();
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();
    await page.waitForLoadState("networkidle", { timeout: 5000 });

    // Should be on orgs list page
    expect(page.url()).toContain("/admin/orgs");
  });

  test("should navigate to orgs list via breadcrumb", async ({ page }) => {
    const orgId = `breadcrumb-nav-${Date.now()}`;
    const org = {
      id: orgId,
      name: "Breadcrumb Org",
      teamId: "team-1",
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      subscription: null,
      team: null,
      _count: { entitlementOverrides: 0 },
    };

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({ json: { data: org } });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Click "Organisations" in breadcrumb
    await page.getByText("Organisations").first().click();
    await page.waitForLoadState("networkidle", { timeout: 5000 });

    // Should navigate to orgs list
    expect(page.url()).toContain("/admin/orgs");
    expect(page.url()).not.toContain(orgId);
  });

  test("should show subscription period start and end dates", async ({ page }) => {
    const orgId = `dates-${Date.now()}`;
    const org = {
      id: orgId,
      name: "Dates Org",
      teamId: "team-1",
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
        id: "team-1",
        name: "Dates Team",
        owner: { id: "owner-1", name: "Owner Name", email: "owner@test.com" },
        _count: { members: 5 },
      },
      _count: { entitlementOverrides: 2 },
    };

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({ json: { data: org } });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Period start and end should be visible
    await expect(page.getByText("Début de période").first()).toBeVisible();
    await expect(page.getByText("Fin de période").first()).toBeVisible();
  });

  test("should display team owner name and member count", async ({ page }) => {
    const orgId = `team-info-${Date.now()}`;
    const org = {
      id: orgId,
      name: "Team Info Org",
      teamId: "team-1",
      createdAt: "2026-01-15T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      subscription: {
        planKey: "PRO",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      },
      team: {
        id: "team-1",
        name: "My Team",
        owner: { id: "owner-1", name: "John Smith", email: "john@test.com" },
        _count: { members: 8 },
      },
      _count: { entitlementOverrides: 0 },
    };

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({ json: { data: org } });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Team owner and member count
    await expect(page.getByText(/Propriétaire : John Smith/)).toBeVisible();
    await expect(page.getByText(/8 membres?/i)).toBeVisible();
  });

  test("should display cancelAtPeriodEnd warning in subscription detail", async ({ page }) => {
    const orgId = `cancel-detail-${Date.now()}`;
    const org = {
      id: orgId,
      name: "Cancel Detail Org",
      teamId: "team-1",
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
        id: "team-1",
        name: "Cancel Team",
        owner: { id: "owner-1", name: "Owner", email: "owner@test.com" },
        _count: { members: 3 },
      },
      _count: { entitlementOverrides: 0 },
    };

    await page.route(new RegExp(`/api/admin/orgs/${orgId}`), async (route) => {
      await route.fulfill({ json: { data: org } });
    });

    await page.goto(`/admin/orgs/${orgId}`);
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    // Detailed cancel warning text
    await expect(page.getByText(/configuré pour être annulé/)).toBeVisible();
  });
});
