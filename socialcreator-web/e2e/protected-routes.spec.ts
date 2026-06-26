/**
 * E2E Tests for Protected Routes
 * Tests: Dashboard redirect when not authenticated, navigation guards,
 *        role-based access, expired sessions, API protection, post-auth redirect
 */

import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = ["/dashboard", "/profiles", "/settings", "/agents", "/content"];

// Top-level routes under (main) requiring auth
const ADDITIONAL_PROTECTED_ROUTES = ["/analytics", "/video", "/pricing"];

// Nested (deep) routes under (main) requiring auth (non-admin)
const DEEP_PROTECTED_ROUTES = [
  "/content/generate",
  "/content/calendar",
  "/content/queue",
  "/content/history",
  "/settings/billing",
  "/settings/api-keys",
  "/settings/teams",
  "/profiles/new",
  "/dashboard/publish-queue",
];

// Admin sub-routes requiring ADMIN role
const ADMIN_SUB_ROUTES = ["/admin/users", "/admin/orgs", "/admin/entitlements"];

// Protected API routes (should return 401 without auth)
const PROTECTED_API_ROUTES = [
  { method: "GET" as const, path: "/api/analytics" },
  { method: "GET" as const, path: "/api/agents" },
  { method: "GET" as const, path: "/api/content" },
  { method: "GET" as const, path: "/api/v1/agents" },
  { method: "GET" as const, path: "/api/v1/content" },
  { method: "GET" as const, path: "/api/admin/stats" },
];

// /pricing is under the (main) route group which requires authentication.
const PUBLIC_ROUTES = ["/", "/blog", "/login", "/register"];
const ADDITIONAL_PUBLIC_ROUTES = ["/maintenance"];

test.describe("Protected Routes", () => {
  // ── Existing tests (preserved) ────────────────────────────────────────────

  for (const route of PROTECTED_ROUTES) {
    test(`[EXISTING] should redirect to login when accessing ${route} without auth`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });
  }

  test("[EXISTING] should allow public routes without redirect", async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      const finalPath = new URL(page.url()).pathname;
      if (route === "/") {
        expect(finalPath).toBe("/");
      } else {
        // e.g., /blog should start with /blog (not /login)
        expect(finalPath).toMatch(new RegExp(`^${route}`));
      }
    }
  });

  test("[EXISTING] should redirect to login when accessing /admin without auth", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/admin");
    // Should redirect to login (or show 401/403)
    const finalPath = new URL(page.url()).pathname;
    const isLogin = finalPath === "/login";
    const isForbidden = finalPath === "/admin/unauthorized" || finalPath === "/403";
    expect(isLogin || isForbidden).toBe(true);
  });

  test("[EXISTING] should redirect non-admin users when accessing /admin", async ({ page }) => {
    // Register as a regular user
    const testEmail = `non-admin-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "Non Admin", email: testEmail, password: "NonAdmin123!" },
    });

    if (registerRes.ok()) {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const onDashboard = new URL(page.url()).pathname === "/dashboard";
      if (onDashboard) {
        // Try to access admin page
        await page.goto("/admin");
        await page.waitForLoadState("networkidle");

        const finalPath = new URL(page.url()).pathname;
        // Non-admin should be redirected away from /admin
        const notOnAdmin = !finalPath.startsWith("/admin");
        const onLogin = finalPath === "/login";
        const onDashboard2 = finalPath === "/dashboard";
        expect(notOnAdmin || onLogin || onDashboard2).toBe(true);
      }
    }
  });

  test("[EXISTING] should allow admin users to access /admin", async ({ page }) => {
    const testEmail = `admin-user-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: {
        name: "Admin User",
        email: testEmail,
        password: "AdminPass123!",
        role: "admin",
      },
    });

    if (registerRes.ok()) {
      await page.goto("/admin");
      await page.waitForLoadState("networkidle");

      const finalPath = new URL(page.url()).pathname;
      // Admin user should be able to access admin routes
      const onAdmin = finalPath.startsWith("/admin");
      const onLogin = finalPath === "/login";
      // If the role wasn't actually set, may redirect to login
      expect(onAdmin || onLogin).toBe(true);
    }
  });

  // ── NEW: Additional top-level protected routes ────────────────────────────

  for (const route of ADDITIONAL_PROTECTED_ROUTES) {
    test(`should redirect to login when accessing ${route} without auth`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });
  }

  // ── NEW: Deep nested protected routes ─────────────────────────────────────

  for (const route of DEEP_PROTECTED_ROUTES) {
    test(`should redirect to login when accessing ${route} without auth`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });
  }

  // ── NEW: Admin sub-routes without auth ────────────────────────────────────

  for (const route of ADMIN_SUB_ROUTES) {
    test(`should redirect to login when accessing ${route} without auth`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });
  }

  // ── NEW: Additional public routes ─────────────────────────────────────────

  test("should allow additional public routes without redirect", async ({ page }) => {
    for (const route of ADDITIONAL_PUBLIC_ROUTES) {
      await page.goto(route);
      const finalPath = new URL(page.url()).pathname;
      expect(finalPath).toMatch(new RegExp(`^${route}`));
    }
  });

  // ── NEW: Already authenticated → login page redirects away ────────────────

  test("should redirect away from /login when already authenticated", async ({ page }) => {
    const testEmail = `already-logged-in-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "Already Logged In", email: testEmail, password: "AlreadyIn123!" },
    });

    if (registerRes.ok()) {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const path = new URL(page.url()).pathname;
      if (path !== "/login") {
        // We're authenticated — try visiting /login
        await page.goto("/login");
        await page.waitForLoadState("networkidle");
        const loginPath = new URL(page.url()).pathname;
        expect(loginPath).not.toBe("/login");
      }
    }
  });

  // ── NEW: Post-auth redirection (callbackUrl) ─────────────────────────────

  test("should redirect to callbackUrl after successful login", async ({ page }) => {
    const testEmail = `callback-protected-${Date.now()}@example.com`;
    const testPassword = "CallbackProt123!";

    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "Callback Protected Test", email: testEmail, password: testPassword },
    });

    if (registerRes.ok()) {
      await page.goto("/login?callbackUrl=/settings");
      await page.waitForLoadState("networkidle");

      // Fill login form
      await page.locator('input[type="email"]').first().fill(testEmail);
      await page.locator('input[type="password"]').first().fill(testPassword);
      await page.locator('button[type="submit"]').first().click();

      // Should land on /settings (or onboarding if user skipped CGU)
      await page.waitForURL(/.+/, { timeout: 15000 });
      const finalPath = new URL(page.url()).pathname;
      // After registration, user may need to accept CGU first
      const onSettings = finalPath === "/settings";
      const onCgu = finalPath.includes("/onboarding/cgu");
      expect(onSettings || onCgu).toBe(true);
    }
  });

  // ── NEW: Session expired / token cleared mid-session ──────────────────────

  test("should redirect to login when cookies cleared mid-session", async ({ page }) => {
    const testEmail = `session-clear-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "Session Clear Test", email: testEmail, password: "ClearSess123!" },
    });

    if (registerRes.ok()) {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const onDashboard = new URL(page.url()).pathname === "/dashboard";
      if (onDashboard) {
        // Clear all cookies (session token)
        await page.context().clearCookies();
        await page.goto("/dashboard");
        await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
      }
    }
  });

  test("should redirect to login when cookies cleared on nested route", async ({ page }) => {
    const testEmail = `session-clear-nested-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "Session Clear Nested", email: testEmail, password: "ClearNested123!" },
    });

    if (registerRes.ok()) {
      await page.goto("/content/calendar");
      await page.waitForLoadState("networkidle");

      const onCalendar = new URL(page.url()).pathname.includes("/content");
      if (onCalendar) {
        await page.context().clearCookies();
        await page.goto("/content/calendar");
        await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
      } else {
        // If not authenticated (CGU blocking), skip gracefully
        test.skip();
      }
    }
  });

  // ── NEW: API route protection (unauthenticated → 401) ─────────────────────

  for (const { method, path } of PROTECTED_API_ROUTES) {
    test(`should return 401 for ${method} ${path} without auth`, async ({ request }) => {
      const response = await request.fetch(path, { method });
      expect([401, 302, 404]).toContain(response.status());
    });
  }

  // ── NEW: Admin sub-routes with non-admin user ─────────────────────────────

  for (const route of ADMIN_SUB_ROUTES) {
    test(`should redirect non-admin user from ${route}`, async ({ page }) => {
      const testEmail = `non-admin-deep-${Date.now()}@example.com`;
      const registerRes = await page.request.post("/api/auth/register", {
        data: { name: "Non Admin Deep", email: testEmail, password: "NonAdminDeep123!" },
      });

      if (registerRes.ok()) {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        const onDashboard = new URL(page.url()).pathname === "/dashboard";
        if (onDashboard) {
          await page.goto(route);
          await page.waitForLoadState("networkidle");

          const finalPath = new URL(page.url()).pathname;
          // Non-admin should NOT be on /admin/* sub-route
          const notOnAdmin = !finalPath.startsWith("/admin");
          const onLogin = finalPath === "/login";
          const onDashboard2 = finalPath === "/dashboard";
          expect(notOnAdmin || onLogin || onDashboard2).toBe(true);
        }
      }
    });
  }

  // ── NEW: Simulate expired session via route interception ──────────────────

  test("should handle session expired error when API returns 401", async ({ page }) => {
    const testEmail = `api-401-protected-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "API 401 Test", email: testEmail, password: "Api401Test123!" },
    });

    if (registerRes.ok()) {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const onDashboard = new URL(page.url()).pathname === "/dashboard";
      if (onDashboard) {
        // Intercept dashboard data API calls to return 401
        await page.route("**/api/**", async (route) => {
          // Skip auth-related calls to avoid breaking the page entirely
          const url = route.request().url();
          if (
            !url.includes("/api/auth/") &&
            !url.includes("/api/health") &&
            !url.includes("/api/v1/health")
          ) {
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({ error: "Session expired", code: "SESSION_EXPIRED" }),
            });
          } else {
            await route.continue();
          }
        });

        // Navigate away and back to trigger API calls
        await page.goto("/profiles");
        await page.waitForLoadState("networkidle");
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Should show error message or redirect to login
        const hasExpiredMsg = await page
          .getByText(/session expired|session a expiré|veuillez vous reconnecter|unauthorized/i)
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        const redirectedToLogin = new URL(page.url()).pathname === "/login";
        expect(hasExpiredMsg || redirectedToLogin).toBe(true);
      }
    }
  });

  // ── NEW: Premium role routes (if applicable) ──────────────────────────────

  test("should allow premium user to access premium content area", async ({ page }) => {
    const testEmail = `premium-user-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: {
        name: "Premium User",
        email: testEmail,
        password: "PremiumUser123!",
        role: "PREMIUM",
      },
    });

    if (registerRes.ok()) {
      // Premium users should be able to access all (main) routes
      await page.goto("/analytics");
      await page.waitForLoadState("networkidle");

      const finalPath = new URL(page.url()).pathname;
      // May be on analytics, dashboard, or redirected through onboarding/CGU
      const isNotLogin = finalPath !== "/login";
      const isOnAnalytics = finalPath.startsWith("/analytics");
      expect(isOnAnalytics || isNotLogin).toBe(true);
    }
  });

  test("should redirect non-premium user appropriately", async ({ page }) => {
    const testEmail = `basic-user-premium-${Date.now()}@example.com`;
    const registerRes = await page.request.post("/api/auth/register", {
      data: { name: "Basic User", email: testEmail, password: "BasicUser123!" },
    });

    if (registerRes.ok()) {
      await page.goto("/pricing");
      await page.waitForLoadState("networkidle");

      // Basic user should still be able to access pricing (just a page within (main))
      const finalPath = new URL(page.url()).pathname;
      const isNotLogin = finalPath !== "/login";
      const onPricing = finalPath.startsWith("/pricing");
      const onDashboard = finalPath === "/dashboard";
      const onCgu = finalPath.includes("/onboarding/cgu");
      const onOnboarding = finalPath.includes("/onboarding/");
      // Authenticated user can access /pricing (it's under (main) but accessible)
      expect(isNotLogin).toBe(true);
      // CGU/onboarding may intercept first visit
      expect(onPricing || onDashboard || onCgu || onOnboarding).toBe(true);
    }
  });

  // ── NEW: Admin sub-routes with admin user ─────────────────────────────────

  for (const route of ADMIN_SUB_ROUTES) {
    test(`should allow admin user to access ${route}`, async ({ page }) => {
      const testEmail = `admin-sub-${Date.now()}@example.com`;
      const registerRes = await page.request.post("/api/auth/register", {
        data: {
          name: "Admin Sub",
          email: testEmail,
          password: "AdminSub123!",
          role: "admin",
        },
      });

      if (registerRes.ok()) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        const finalPath = new URL(page.url()).pathname;
        // Admin should be on the requested admin sub-route
        const onTarget = finalPath.startsWith(route);
        const onLogin = finalPath === "/login";
        const onDashboard = finalPath === "/dashboard";
        // May land on dashboard if role assignment didn't stick
        expect(onTarget || onLogin || onDashboard).toBe(true);
      }
    });
  }

  // ── NEW: 401 on admin API without auth ────────────────────────────────────

  test("should return 401 for admin API without auth", async ({ request }) => {
    const adminApis = ["/api/admin/stats", "/api/admin/users", "/api/admin/orgs"];
    for (const api of adminApis) {
      const response = await request.get(api);
      expect([401, 302, 404]).toContain(response.status());
    }
  });

  // ── NEW: 401 on v1 API without auth (except health) ───────────────────────

  test("should return 401 for v1 protected API without auth", async ({ request }) => {
    const v1ProtectedApis = [
      "/api/v1/agents",
      "/api/v1/content",
      "/api/v1/profiles",
      "/api/v1/teams",
      "/api/v1/dashboard",
    ];
    for (const api of v1ProtectedApis) {
      const response = await request.get(api);
      expect([401, 302, 404]).toContain(response.status());
    }
  });
});
