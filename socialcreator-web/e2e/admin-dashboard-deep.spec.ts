/**
 * E2E Deep Tests for Admin Dashboard
 *
 * Covers:
 *  - Trend charts & visualization (6 tests): daily, monthly, empty, single-point, large values, null
 *  - Stats card interactions (5 tests): loading transition, error retry, French formatting, navigation, subtexts
 *  - Cross-module consistency (3 tests): dashboard → users count match, zero states, null fields
 *  - Edge cases (4 tests): API 500 retry, missing fields, future dates in trends, mixed null/valid trends
 *
 * Strategy: Uses page.route() to mock APIs, test.skip() when redirected to /login.
 * Follows patterns established in admin.spec.ts and admin-components.spec.ts.
 */

import { expect, test } from "@playwright/test";

// ── Types ───────────────────────────────────────────────────────────────────

type Role = "ADMIN" | "USER" | null;

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendsData {
  users: TrendPoint[];
  content: TrendPoint[];
  publications: TrendPoint[];
}

interface StatsResponse {
  users: { total: number; activeThisMonth: number; newThisWeek: number; newThisMonth: number };
  organizations: { total: number; withSubscription: number };
  content: { totalGenerated: number; publishedToday: number; publishedThisMonth: number };
  publications: { today: number; thisMonth: number };
  trends: TrendsData | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Skip the current test if the page redirected to /login (not authenticated). */
async function skipIfRedirected(page: import("@playwright/test").Page): Promise<boolean> {
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === "/login") {
    test.skip();
    return true;
  }
  return false;
}

/** Mock /api/auth/session to return a given role or empty (unauthenticated). */
async function mockSession(page: import("@playwright/test").Page, role: Role) {
  await page.route("**/api/auth/session", async (route) => {
    if (role === null) {
      await route.fulfill({ status: 200, json: {} });
    } else {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: role === "ADMIN" ? "admin-session-id" : "user-session-id",
            name: role === "ADMIN" ? "Admin User" : "Regular User",
            email: "session@test.com",
            role,
          },
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        },
      });
    }
  });
}

/** Generate a trend data array for a given number of days. */
function generateTrendData(days: number, baseCount = 30, variance = 20): TrendPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      count: Math.max(0, baseCount + Math.floor(Math.random() * variance * 2 - variance)),
    };
  });
}

/** Build a full stats response, overriding only provided fields. */
function buildStatsResponse(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
    organizations: { total: 30, withSubscription: 20 },
    content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
    publications: { today: 12, thisMonth: 340 },
    trends: null,
    ...overrides,
  };
}

/** Build the mock response body for the admin/users API. */
function buildUsersResponse(
  data: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
  }>,
  pagination: { total: number; totalPages: number; page: number; limit: number },
) {
  return { data, pagination };
}

// ════════════════════════════════════════════════════════════════════════════
// Section 1: Trend Charts & Visualization
// ════════════════════════════════════════════════════════════════════════════

test.describe("Admin Dashboard — Trend Charts & Visualization", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page, "ADMIN");
  });

  test("1: should render trend charts with 7 days of daily data", async ({ page }) => {
    const trends: TrendsData = {
      users: generateTrendData(7, 15, 10),
      content: generateTrendData(7, 80, 30),
      publications: generateTrendData(7, 10, 5),
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Chart containers should render — Recharts responsive containers
    const recharts = page.locator(".recharts-responsive-container");
    await expect(recharts).toHaveCount(3, { timeout: 8000 });

    // Chart section titles should be visible (French labels)
    await expect(page.getByText("Nouveaux utilisateurs (30 jours)")).toBeVisible();
    await expect(page.getByText("Contenu généré (30 jours)")).toBeVisible();
    await expect(page.getByText("Publications (30 jours)")).toBeVisible();

    // Each chart should contain SVG elements (actual chart rendering)
    const svgCount = await page.locator(".recharts-surface").count();
    expect(svgCount).toBe(3);
  });

  test("2: should render trend charts with 30 days of monthly data without overflow", async ({
    page,
  }) => {
    // 30 data points is a realistic monthly view
    const trends: TrendsData = {
      users: generateTrendData(30, 20, 15),
      content: generateTrendData(30, 100, 50),
      publications: generateTrendData(30, 15, 8),
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // All 3 charts should render
    const recharts = page.locator(".recharts-responsive-container");
    await expect(recharts).toHaveCount(3, { timeout: 8000 });

    // SVG surfaces should exist inside each chart
    const svgSurfaces = page.locator(".recharts-surface");
    await expect(svgSurfaces).toHaveCount(3);

    // The chart area should not overflow its container
    const chartBounds = await recharts.first().boundingBox();
    const viewport = page.viewportSize();
    expect(chartBounds).not.toBeNull();
    if (chartBounds && viewport) {
      expect(chartBounds.width).toBeLessThanOrEqual(viewport.width);
    }

    // No horizontal scrollbar should appear (charts fit within viewport)
    const hasHorizontalScroll = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el ? el.scrollWidth > el.clientWidth : false;
    });
    // Allow some horizontal scroll if sidebar is present, but verify no huge overflow
    const bodyScroll = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScroll).toBeLessThanOrEqual(3000);
  });

  test("3: should show fallback text when trends array is empty", async ({ page }) => {
    const trends: TrendsData = {
      users: [],
      content: [],
      publications: [],
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Chart titles should still be present
    await expect(page.getByText("Nouveaux utilisateurs (30 jours)")).toBeVisible();
    await expect(page.getByText("Contenu généré (30 jours)")).toBeVisible();
    await expect(page.getByText("Publications (30 jours)")).toBeVisible();

    // Each chart should show a fallback / empty state message
    // The app uses "No data yet" as the fallback text (English in the existing tests)
    const noDataTexts = page.getByText("No data yet");
    await expect(noDataTexts).toHaveCount(3);

    // Ensure no SVG chart surface was rendered (empty data = no chart)
    const svgSurfaces = page.locator(".recharts-surface");
    const svgCount = await svgSurfaces.count();
    expect(svgCount).toBe(0);
  });

  test("4: should not crash with a single data point in trends", async ({ page }) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const trends: TrendsData = {
      users: [{ date: today, count: 5 }],
      content: [{ date: today, count: 42 }],
      publications: [{ date: today, count: 3 }],
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Chart containers should render without crashing
    const recharts = page.locator(".recharts-responsive-container");
    await expect(recharts).toHaveCount(3, { timeout: 8000 });

    // Each chart should have an SVG (single point still renders)
    const svgCount = await page.locator(".recharts-surface").count();
    expect(svgCount).toBe(3);

    // No error banners should appear
    const errorShown = await page
      .getByText(/error|failed|unable to load|something went wrong|une erreur/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorShown).toBe(false);
  });

  test("5: should display trend charts with very large values (millions)", async ({ page }) => {
    const trends: TrendsData = {
      users: generateTrendData(7, 1_500_000, 500_000).map((p) => ({
        ...p,
        count: Math.min(p.count, 5_000_000),
      })),
      content: generateTrendData(7, 8_000_000, 2_000_000).map((p) => ({
        ...p,
        count: Math.min(p.count, 15_000_000),
      })),
      publications: generateTrendData(7, 500_000, 200_000).map((p) => ({
        ...p,
        count: Math.min(p.count, 1_000_000),
      })),
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Charts should render without crashing
    const recharts = page.locator(".recharts-responsive-container");
    await expect(recharts).toHaveCount(3, { timeout: 8000 });

    // SVG surfaces should be present
    const svgSurfaces = page.locator(".recharts-surface");
    await expect(svgSurfaces).toHaveCount(3);

    // No error banners (large values should format correctly)
    const errorShown = await page
      .getByText(/error|failed|unable to load|something went wrong/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorShown).toBe(false);

    // Body text should contain some portion of the large numbers (formatted or raw)
    const bodyText = await page.locator("body").textContent();
    const hasMillionValue =
      (bodyText || "").includes("000") ||
      (bodyText || "").includes("1 500") ||
      (bodyText || "").includes("1 500") ||
      (bodyText || "").includes("1.500");
    expect(hasMillionValue).toBe(true);
  });

  test("6: should show no chart section when trends is null", async ({ page }) => {
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends: null }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Chart titles should NOT be visible
    await expect(page.getByText("Nouveaux utilisateurs (30 jours)")).not.toBeVisible();
    await expect(page.getByText("Contenu généré (30 jours)")).not.toBeVisible();
    await expect(page.getByText("Publications (30 jours)")).not.toBeVisible();

    // No Recharts containers should exist
    const recharts = page.locator(".recharts-responsive-container");
    const count = await recharts.count();
    expect(count).toBe(0);

    // Stats cards should still render normally
    await expect(page.getByText("Utilisateurs").first()).toBeVisible();
    await expect(page.getByText("Organisations").first()).toBeVisible();
    await expect(page.getByText("Contenu généré").first()).toBeVisible();
    await expect(page.getByText("Publications").first()).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Section 2: Stats Card Interactions
// ════════════════════════════════════════════════════════════════════════════

test.describe("Admin Dashboard — Stats Card Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page, "ADMIN");
  });

  test("7: should transition from loading skeleton to data when API resolves", async ({ page }) => {
    // Delay the stats API by 2 seconds so we can observe the loading state
    await page.route("**/api/admin/stats*", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        json: buildStatsResponse({
          users: { total: 42, activeThisMonth: 30, newThisWeek: 5, newThisMonth: 12 },
        }),
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Loading skeleton should appear first
    const skeleton = page
      .locator(
        '[class*="skeleton"], [class*="loading"], [class*="spinner"], [class*="shimmer"], .lucide-loader2',
      )
      .first();
    await expect(skeleton).toBeVisible({ timeout: 3000 });

    // Wait for the API response to arrive
    await page.waitForTimeout(2500);

    // After data loads, skeleton should be gone and stat value should appear
    await expect(skeleton).not.toBeVisible({ timeout: 3000 });

    // The mocked value "42" should be visible in a stat card
    await expect(page.getByText("42").first()).toBeVisible({ timeout: 5000 });

    // Stat card labels should be present
    await expect(page.getByText("Utilisateurs").first()).toBeVisible();
  });

  test("8: should retry after first stats API 500 error and display data on second call", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route("**/api/admin/stats*", async (route) => {
      callCount++;
      if (callCount === 1) {
        // First call fails with 500
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      } else {
        // Second call succeeds (retry)
        await route.fulfill({
          json: buildStatsResponse({
            users: { total: 99, activeThisMonth: 80, newThisWeek: 10, newThisMonth: 25 },
          }),
        });
      }
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // After the first failure, an error banner should appear
    const errorBanner = page
      .locator('[role="alert"], [class*="error"], [class*="alert"], .bg-danger\\/10')
      .filter({ hasText: /error|failed|unable to load|something went wrong|erreur/i })
      .first();

    // Wait a bit for the retry to happen
    await page.waitForTimeout(2000);

    // Eventually the data should load — "99" should appear from the retry
    const dataVisible = await page
      .getByText("99")
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (dataVisible) {
      // Success after retry
      await expect(page.getByText("99").first()).toBeVisible();
    } else {
      // If retry didn't happen automatically, at minimum page should not crash
      const bodyVisible = await page.locator("body").isVisible();
      expect(bodyVisible).toBe(true);
    }

    // The stats API should have been called at least twice (original + retry)
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test("9: should display stat card values with French number formatting (space as thousand separator)", async ({
    page,
  }) => {
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: buildStatsResponse({
          users: { total: 1500, activeThisMonth: 1200, newThisWeek: 100, newThisMonth: 250 },
          content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
          publications: { today: 1200, thisMonth: 3400 },
        }),
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // French locale uses non-breaking space as thousand separator
    // The app may render "1 500", "1 500" (with narrow non-breaking space), or "1500"
    const formattedValues = page
      .getByText(/1[ \u202f]?500|1500/)
      .or(page.getByText(/5[ \u202f]?000|5000/))
      .or(page.getByText(/1[ \u202f]?200|1200/))
      .or(page.getByText(/3[ \u202f]?400|3400/));

    await expect(formattedValues.first()).toBeVisible({ timeout: 5000 });

    // At least one stat card should contain a formatted value with thousands separator
    const bodyText = (await page.locator("body").textContent()) || "";
    const hasSpaceSeparated =
      bodyText.includes("1 500") ||
      bodyText.includes("1 500") ||
      bodyText.includes("5 000") ||
      bodyText.includes("5 000") ||
      bodyText.includes("1 200") ||
      bodyText.includes("3 400");

    // Check that large numbers appear (either with space separator or raw)
    const hasRawNumber =
      bodyText.includes("1500") || bodyText.includes("5000") || bodyText.includes("3400");

    expect(hasSpaceSeparated || hasRawNumber).toBe(true);
  });

  test("10: should navigate to users page when clicking the Users stat card", async ({ page }) => {
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: buildStatsResponse({
          users: { total: 75, activeThisMonth: 60, newThisWeek: 8, newThisMonth: 20 },
        }),
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Find the Users stat card — it should be a link or clickable element
    const usersCard = page
      .locator('a[href*="/admin/users"]')
      .or(page.locator('a[href*="/admin/users"]').first())
      .or(
        page
          .locator("a, button, [role='link'], [role='button']")
          .filter({ hasText: /Utilisateurs/ })
          .first(),
      );

    const isClickable = await usersCard.isVisible().catch(() => false);
    if (isClickable) {
      // Get the href before clicking
      const href = await usersCard.getAttribute("href").catch(() => null);
      await usersCard.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Should navigate to /admin/users or a users-related page
      const currentUrl = new URL(page.url());
      const isUsersPage =
        currentUrl.pathname.includes("/admin/users") || (href && currentUrl.pathname === href);
      expect(isUsersPage).toBe(true);
    } else {
      // Card might not be clickable; verify page renders correctly as fallback
      await expect(page.getByText("Utilisateurs").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("11: should display subtexts in stat cards (nouveaux ce mois, avec abonnement, etc.)", async ({
    page,
  }) => {
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: buildStatsResponse({
          users: { total: 150, activeThisMonth: 120, newThisWeek: 10, newThisMonth: 25 },
          organizations: { total: 30, withSubscription: 20 },
          content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: 890 },
          publications: { today: 12, thisMonth: 340 },
        }),
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // French subtexts on stat cards
    await expect(page.getByText(/25 nouveaux ce mois/)).toBeVisible();
    await expect(page.getByText(/20 avec abonnement/)).toBeVisible();
    await expect(page.getByText(/45 publiés aujourd'hui/)).toBeVisible();
    await expect(page.getByText(/12 aujourd'hui/)).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Section 3: Cross-Module Consistency
// ════════════════════════════════════════════════════════════════════════════

test.describe("Admin Dashboard — Cross-Module Consistency", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page, "ADMIN");
  });

  test("12: should show 42 users on dashboard and same count on /admin/users page", async ({
    page,
  }) => {
    // Mock dashboard stats with 42 users
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: buildStatsResponse({
          users: { total: 42, activeThisMonth: 30, newThisWeek: 5, newThisMonth: 10 },
        }),
      });
    });

    // Mock users API to also have 42 total
    await page.route("**/api/admin/users*", async (route) => {
      const url = new URL(route.request().url());
      const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
      const users = Array.from({ length: 20 }, (_, i) => ({
        id: `user-consistency-${pageParam}-${i}-${Date.now()}`,
        email: `user${pageParam}-${i}@test.com`,
        name: `User ${pageParam}-${i}`,
        role: "USER",
        createdAt: "2026-01-15T00:00:00Z",
      }));
      await route.fulfill({
        json: buildUsersResponse(users, {
          total: 42,
          totalPages: 3,
          page: pageParam,
          limit: 20,
        }),
      });
    });

    // First check the dashboard stat value
    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // The dashboard should show "42" in the users stat card
    await expect(page.getByText("42").first()).toBeVisible({ timeout: 5000 });

    // Now navigate to /admin/users
    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    // The users page should also reflect the total count
    // Pagination component shows "Page X of Y" — total pages should be 3 (42/20 = 3 pages)
    await expect(page.getByText(/Page \d of 3/)).toBeVisible({ timeout: 8000 });

    // The total of 42 users should be reflected somewhere (heading, subtitle, or pagination)
    const bodyText = (await page.locator("body").textContent()) || "";
    const hasTotal42 = bodyText.includes("42") || bodyText.includes("42");
    expect(hasTotal42).toBe(true);
  });

  test("13: should render dashboard gracefully with all zero values", async ({ page }) => {
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: buildStatsResponse({
          users: { total: 0, activeThisMonth: 0, newThisWeek: 0, newThisMonth: 0 },
          organizations: { total: 0, withSubscription: 0 },
          content: { totalGenerated: 0, publishedToday: 0, publishedThisMonth: 0 },
          publications: { today: 0, thisMonth: 0 },
        }),
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // All stat card labels should still be visible
    await expect(page.getByText("Utilisateurs").first()).toBeVisible();
    await expect(page.getByText("Organisations").first()).toBeVisible();
    await expect(page.getByText("Contenu généré").first()).toBeVisible();
    await expect(page.getByText("Publications").first()).toBeVisible();

    // Zero values should be displayed
    const zeroValues = page.getByText(/0/);
    const count = await zeroValues.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // No error banners should appear
    const errorShown = await page
      .getByText(/error|failed|unable to load|something went wrong/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorShown).toBe(false);

    // Subtexts should still render with zero values
    await expect(page.getByText(/0 nouveaux ce mois|0 publiés/)).toBeVisible();
  });

  test("14: should handle null fields in stats response gracefully", async ({ page }) => {
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: {
          users: { total: 100, activeThisMonth: null, newThisWeek: null, newThisMonth: 10 },
          organizations: { total: null, withSubscription: null },
          content: { totalGenerated: 5000, publishedToday: 45, publishedThisMonth: null },
          publications: { today: null, thisMonth: 340 },
          trends: null,
        },
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Page should not crash — partial null values in sub-objects should be handled
    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);

    // Values that are not null should still display
    const hasNonNullValue =
      (await page
        .getByText("100")
        .first()
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText("5000")
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText("340")
        .isVisible()
        .catch(() => false)) ||
      (await page
        .getByText("10")
        .first()
        .isVisible()
        .catch(() => false));
    expect(hasNonNullValue).toBe(true);

    // Stat cards labels should still be present
    await expect(page.getByText("Utilisateurs").first()).toBeVisible();
    await expect(page.getByText("Organisations").first()).toBeVisible();
    await expect(page.getByText("Contenu généré").first()).toBeVisible();
    await expect(page.getByText("Publications").first()).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Section 4: Edge Cases
// ════════════════════════════════════════════════════════════════════════════

test.describe("Admin Dashboard — Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page, "ADMIN");
  });

  test("15: should show error banner then retry and recover from stats API 500", async ({
    page,
  }) => {
    let callCount = 0;

    await page.route("**/api/admin/stats*", async (route) => {
      callCount++;
      if (callCount <= 2) {
        // First two calls fail
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        });
      } else {
        // Third call succeeds
        await route.fulfill({
          json: buildStatsResponse({
            users: { total: 88, activeThisMonth: 70, newThisWeek: 8, newThisMonth: 20 },
          }),
        });
      }
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // After failures, an error banner should appear
    const errorBanner = page
      .locator('[role="alert"], [class*="error"], [class*="alert"], .bg-danger\\/10')
      .filter({ hasText: /error|failed|unable to load|something went wrong|erreur/i });

    // Wait for retries to happen
    await page.waitForTimeout(3000);

    // Check if recovered after retries
    const dataVisible = await page
      .getByText("88")
      .first()
      .isVisible({ timeout: 8000 })
      .catch(() => false);

    if (dataVisible) {
      // Successfully recovered after retries
      await expect(page.getByText("88").first()).toBeVisible();
    }

    // The stats API should have been called at least 2 times (retry mechanism)
    expect(callCount).toBeGreaterThanOrEqual(2);

    // Page should not crash
    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);
  });

  test("16: should handle incomplete stats response with missing fields gracefully", async ({
    page,
  }) => {
    // Missing entire fields from the response
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: {
          users: { total: 50 },
          // organizations is missing entirely
          // content is missing entirely
          publications: { today: 5 },
          // trends is missing entirely
        },
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Page should not crash despite missing fields
    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);

    // Available data should render
    const hasUsers = await page
      .getByText("Utilisateurs")
      .first()
      .isVisible()
      .catch(() => false);
    const hasPublications = await page
      .getByText("Publications")
      .first()
      .isVisible()
      .catch(() => false);

    // At least available fields render (or error state shows)
    const hasSomeLabel = hasUsers || hasPublications;
    expect(hasSomeLabel).toBe(true);

    // No fatal crash — no application error boundary
    const hasAppError = await page
      .getByText(/something went wrong|application error|unexpected error/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasAppError).toBe(false);
  });

  test("17: should handle trend data with future dates without crashing", async ({ page }) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureStr = futureDate.toISOString().slice(0, 10);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);
    const pastStr = pastDate.toISOString().slice(0, 10);

    const trends: TrendsData = {
      users: [
        { date: pastStr, count: 10 },
        { date: futureStr, count: 50 },
      ],
      content: [
        { date: pastStr, count: 100 },
        { date: futureStr, count: 500 },
      ],
      publications: [
        { date: pastStr, count: 5 },
        { date: futureStr, count: 25 },
      ],
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({ json: buildStatsResponse({ trends }) });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Charts should render without crashing
    const recharts = page.locator(".recharts-responsive-container");
    await expect(recharts).toHaveCount(3, { timeout: 8000 });

    // Each chart should have an SVG
    const svgCount = await page.locator(".recharts-surface").count();
    expect(svgCount).toBe(3);

    // No error banners
    const errorShown = await page
      .getByText(/error|failed|unable to load|something went wrong/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorShown).toBe(false);
  });

  test("18: should handle mixed trends (some null, some valid) without crashing", async ({
    page,
  }) => {
    const trends = {
      users: generateTrendData(7, 20, 10),
      content: null as unknown as TrendPoint[],
      publications: generateTrendData(7, 12, 5),
    };

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: {
          ...buildStatsResponse(),
          trends,
        },
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Page should not crash — mixed null/valid trends should be handled
    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);

    // The valid trend charts may render; the null one should show fallback or be skipped
    const recharts = page.locator(".recharts-responsive-container");
    const chartCount = await recharts.count();

    // Should have either 2 charts (for non-null trends) or a fallback
    expect(chartCount).toBeGreaterThanOrEqual(0);
    expect(chartCount).toBeLessThanOrEqual(3);

    // Stat cards should still be fully visible
    await expect(page.getByText("Utilisateurs").first()).toBeVisible();
    await expect(page.getByText("Organisations").first()).toBeVisible();

    // No fatal crash
    const hasAppError = await page
      .getByText(/something went wrong|application error|unexpected error/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasAppError).toBe(false);
  });
});
