/**
 * E2E Tests for Protected Routes
 * Tests: Dashboard redirect when not authenticated, navigation guards
 */

import { test, expect } from '@playwright/test';

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing profiles without auth', async ({ page }) => {
    await page.goto('/profiles');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing settings without auth', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing agents without auth', async ({ page }) => {
    await page.goto('/agents');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('should redirect to login when accessing content without auth', async ({ page }) => {
    await page.goto('/content');
    await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
  });

  test('should allow public routes without redirect', async ({ page }) => {
    // These should not redirect to login
    const publicRoutes = ['/', '/pricing', '/blog', '/login', '/register'];

    for (const route of publicRoutes) {
      await page.goto(route);
      // Should either stay on the route or redirect to another public route
      const url = page.url();
      expect(url).not.toContain('/login');
    }
  });
});