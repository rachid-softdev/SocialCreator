/**
 * E2E Tests for Protected Routes
 * Tests: Dashboard redirect when not authenticated, navigation guards
 */

import { expect, test } from "@playwright/test";

const PROTECTED_ROUTES = ["/dashboard", "/profiles", "/settings", "/agents", "/content"];

const PUBLIC_ROUTES = ["/", "/pricing", "/blog", "/login", "/register"];

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
      const url = page.url();
      expect(url).not.toContain("/login");
    }
  });
});
