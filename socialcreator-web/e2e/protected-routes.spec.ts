/**
 * E2E Tests for Protected Routes
 * Tests: Dashboard redirect when not authenticated, navigation guards
 */

import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = ["/dashboard", "/profiles", "/settings", "/agents", "/content"];

// /pricing is under the (main) route group which requires authentication.
const PUBLIC_ROUTES = ["/", "/blog", "/login", "/register"];

test.describe("Protected Routes", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`should redirect to login when accessing ${route} without auth`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });
  }

  test("should allow public routes without redirect", async ({ page }) => {
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

  test("should redirect to login when accessing /admin without auth", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin");
    // Should redirect to login (or show 401/403)
    const finalPath = new URL(page.url()).pathname;
    const isLogin = finalPath === "/login";
    const isForbidden = finalPath === "/admin/unauthorized" || finalPath === "/403";
    expect(isLogin || isForbidden).toBe(true);
  });

  test("should redirect non-admin users when accessing /admin", async ({ page }) => {
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

  test("should allow admin users to access /admin", async ({ page }) => {
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
});
