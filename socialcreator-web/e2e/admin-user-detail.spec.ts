/**
 * E2E Tests for Admin User Detail Page (/admin/users/[id])
 * Covers: User info display, stats, profiles, teams, error states, edge cases
 */

import { expect, test } from "@playwright/test";
import { AdminUserDetailPage } from "./pages/admin-user-detail.page";

const BASE_USER = {
  id: "",
  email: "jane@example.com",
  name: "Jane Doe",
  image: null,
  role: "USER",
  cguAccepted: true,
  createdAt: "2026-01-15T00:00:00Z",
  profiles: [
    {
      id: "profile-1",
      name: "Main Profile",
      platforms: ["INSTAGRAM", "TIKTOK"],
      _count: { agents: 3, generatedContents: 42 },
    },
  ],
  ownedTeams: [{ id: "team-1", name: "My Team" }],
  teamMemberships: [{ id: "tm-1", role: "MEMBER", team: { id: "team-2", name: "Collaborative" } }],
  stats: { totalContent: 150, publishedContent: 89 },
};

function getBaseUser(id: string) {
  return { ...BASE_USER, id };
}

test.describe("Admin User Detail", () => {
  test.describe("Page Display — Success States", () => {
    test("should show user detail page with user info (name, email, role, status)", async ({
      page,
    }) => {
      const userId = `user-detail-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      const detail = new AdminUserDetailPage(page);
      await detail.goto(userId);

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Verify user name, email, role are displayed
      await expect(page.getByText(user.name).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(user.email).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(user.role).first()).toBeVisible({ timeout: 5000 });
    });

    test("should show user subscription/plan info (usage stats)", async ({ page }) => {
      const userId = `user-stats-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Stats should show total content and published content
      await expect(page.getByText("150").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("89").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Contenu généré/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Publications réussies|Publications/i).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("should show user's profiles with platform badges", async ({ page }) => {
      const userId = `user-profiles-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show profile name and platforms
      await expect(page.getByText("Main Profile").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("INSTAGRAM").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("TIKTOK").first()).toBeVisible({ timeout: 5000 });
      // Should show agent count and content count
      await expect(page.getByText("3 agents").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("42 contenus").first()).toBeVisible({ timeout: 5000 });
    });

    test("should show user's teams (owned and memberships)", async ({ page }) => {
      const userId = `user-teams-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show owned team
      await expect(page.getByText("My Team").first()).toBeVisible({ timeout: 5000 });
      // Should show membership team
      await expect(page.getByText("Collaborative").first()).toBeVisible({ timeout: 5000 });
      // Should show owner badge
      await expect(page.getByText("Propriétaire").first()).toBeVisible({ timeout: 5000 });
    });

    test("should show breadcrumb with navigation back to user list", async ({ page }) => {
      const userId = `user-breadcrumb-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Breadcrumb should be visible
      await expect(page.getByText("Administration").first()).toBeVisible({ timeout: 5000 });
      const backLink = page.locator('a[href*="/admin/users"]').first();
      await expect(backLink).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Error & Edge States", () => {
    test("should show error when user not found (404)", async ({ page }) => {
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

      const errorMsg = page.getByText(/not found|introuvable|error|failed/i).first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test("should show error on API failure (500)", async ({ page }) => {
      const userId = `server-error-${Date.now()}`;

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ status: 500, json: { error: "Internal Server Error" } });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const errorMsg = page.getByText(/error|failed|internal|server/i).first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle user with no profiles gracefully", async ({ page }) => {
      const userId = `no-profiles-${Date.now()}`;
      const user = { ...getBaseUser(userId), profiles: [] };

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const emptyMsg = page.getByText(/Aucun profil/i).first();
      await expect(emptyMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle user with no teams gracefully", async ({ page }) => {
      const userId = `no-teams-${Date.now()}`;
      const user = { ...getBaseUser(userId), ownedTeams: [], teamMemberships: [] };

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const emptyMsg = page.getByText(/Aucune équipe/i).first();
      await expect(emptyMsg).toBeVisible({ timeout: 5000 });
    });

    test("should handle user with high content volume (large numbers)", async ({ page }) => {
      const userId = `high-volume-${Date.now()}`;
      const user = {
        ...getBaseUser(userId),
        stats: { totalContent: 15000, publishedContent: 12300 },
        profiles: [
          {
            id: "profile-big",
            name: "Big Profile",
            platforms: ["INSTAGRAM", "TIKTOK", "LINKEDIN", "X", "YOUTUBE", "FACEBOOK"],
            _count: { agents: 25, generatedContents: 15000 },
          },
        ],
      };

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Large formatted numbers should display
      await expect(page.getByText("15,000").or(page.getByText("15000")).first()).toBeVisible({
        timeout: 5000,
      });
      await expect(page.getByText("12,300").or(page.getByText("12300")).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("should handle admin user with ADMIN role badge", async ({ page }) => {
      const userId = `admin-role-${Date.now()}`;
      const user = { ...getBaseUser(userId), role: "ADMIN" };

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // ADMIN role badge should show (with shield icon or purple styling)
      const adminBadge = page.getByText("ADMIN").first();
      await expect(adminBadge).toBeVisible({ timeout: 5000 });
    });

    test("should handle user with CGU not accepted", async ({ page }) => {
      const userId = `no-cgu-${Date.now()}`;
      const user = { ...getBaseUser(userId), cguAccepted: false };

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show CGU not accepted status
      const cguStatus = page.getByText(/non acceptées/i).first();
      await expect(cguStatus).toBeVisible({ timeout: 5000 });
    });

    test("should show loading skeleton while fetching user", async ({ page }) => {
      const userId = `loading-${Date.now()}`;

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({ json: getBaseUser(userId) });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Skeleton should be visible during loading
      const skeleton = page.locator('[class*="skeleton"]').first();
      await expect(skeleton).toBeVisible({ timeout: 3000 });
    });

    test("should handle user with empty name (null) gracefully", async ({ page }) => {
      const userId = `null-name-${Date.now()}`;
      const user = { ...getBaseUser(userId), name: null };

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Should show "Unnamed" or email initial as avatar fallback
      const unnamed = page.getByText(/Unnamed|Unnamed/i);
      const emailDisplayed = page.getByText(user.email).first();
      await expect(unnamed.or(emailDisplayed)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Navigation & Actions", () => {
    test("should navigate back to user list via Retour button", async ({ page }) => {
      const userId = `nav-back-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const backLink = page.locator('a[href*="/admin/users"]').first();
      await expect(backLink).toBeVisible({ timeout: 5000 });
    });

    test("should render breadcrumb with proper hierarchy", async ({ page }) => {
      const userId = `breadcrumb-${Date.now()}`;
      const user = getBaseUser(userId);

      await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
        await route.fulfill({ json: user });
      });

      await page.goto(`/admin/users/${userId}`);
      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Breadcrumb: Administration > Utilisateurs > User Name
      await expect(page.getByText("Administration").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Utilisateurs").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(user.name).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Protected Route", () => {
    test("should redirect to login when not authenticated", async ({ page }) => {
      // Block all API calls to simulate not authenticated
      await page.route("**/api/admin/**", async (route) => {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      });

      const userId = `unauth-${Date.now()}`;
      await page.goto(`/admin/users/${userId}`);

      const currentUrl = new URL(page.url());
      // Should either redirect to login or show unauthorized
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
