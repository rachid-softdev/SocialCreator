/**
 * E2E Tests for Admin Shared Components
 *
 * Covers:
 * - AdminGuard: loading spinner, ADMIN renders children, non-ADMIN redirect, unauthenticated redirect
 * - ConfirmDialog: visibility, destructive variant, cancel close, loading spinner, disabled while loading
 * - Pagination: page indicator, next/prev navigation, disabled states
 * - SearchBar: placeholder, clear button show/hide, clear behavior
 * - Breadcrumb: hierarchy display, navigation via breadcrumb links
 *
 * Strategy: Uses page.route() to mock APIs, test.skip() when redirected to /login.
 * Follows patterns established in admin.spec.ts.
 */

import { expect, test } from "@playwright/test";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Skip the current test if the page redirected to /login (not authenticated).
 */
async function skipIfRedirected(page: import("@playwright/test").Page): Promise<boolean> {
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === "/login") {
    test.skip();
    return true;
  }
  return false;
}

/**
 * Mock /api/auth/session to return a given role or empty (unauthenticated).
 *
 * @param role - "ADMIN", "USER", or null for unauthenticated
 */
async function mockSession(page: import("@playwright/test").Page, role: "ADMIN" | "USER" | null) {
  await page.route("**/api/auth/session", async (route) => {
    if (role === null) {
      // Unauthenticated — next-auth returns {} with 200
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

/**
 * Build the mock response body for the admin/users API.
 */
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

const DEFAULT_USERS = [
  {
    id: "user-1",
    email: "alice@example.com",
    name: "Alice Martin",
    role: "USER",
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "user-2",
    email: "bob@example.com",
    name: "Bob Dupont",
    role: "USER",
    createdAt: "2026-02-01T00:00:00Z",
  },
];

// ════════════════════════════════════════════════════════════════════════════
// 1. AdminGuard
// ════════════════════════════════════════════════════════════════════════════

test.describe("AdminGuard", () => {
  test("should show loading spinner while session is loading", async ({ page }) => {
    // Make the session API response slow so AdminGuard stays in loading state
    await page.route("**/api/auth/session", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: "admin-id",
            name: "Admin",
            email: "admin@test.com",
            role: "ADMIN",
          },
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        },
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Verify loading spinner and text
    await expect(page.locator(".lucide-loader2")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Verifying access...")).toBeVisible();
  });

  test("should render children when user is ADMIN", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Wait for the page to fully render (children should be visible)
    await page.waitForTimeout(1000);

    // The admin dashboard should show its heading or stats content
    // (this content is rendered inside AdminGuard's children)
    const hasHeading = await page
      .getByRole("heading", { name: /administration/i })
      .isVisible()
      .catch(() => false);
    const hasContent = await page
      .getByText(/plateforme|vue d'ensemble/i)
      .isVisible()
      .catch(() => false);
    expect(hasHeading || hasContent).toBe(true);
  });

  test("should redirect to /dashboard when user is not ADMIN", async ({ page }) => {
    await mockSession(page, "USER");

    await page.goto("/admin");

    // If server-side layout redirects to /login first, skip
    if (await skipIfRedirected(page)) return;

    // Wait for potential redirect from AdminGuard
    await page.waitForLoadState("networkidle", { timeout: 8000 });

    const currentUrl = new URL(page.url());
    // AdminGuard redirects non-admin users to /dashboard
    expect(currentUrl.pathname).toBe("/dashboard");
  });

  test("should redirect to /dashboard when user is unauthenticated", async ({ page }) => {
    await mockSession(page, null);

    await page.goto("/admin");

    // If server-side layout redirects to /login, skip
    if (await skipIfRedirected(page)) return;

    // Wait for potential redirect from AdminGuard
    await page.waitForLoadState("networkidle", { timeout: 8000 });

    const currentUrl = new URL(page.url());
    // AdminGuard redirects unauthenticated users to /dashboard
    expect(currentUrl.pathname).toBe("/dashboard");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. ConfirmDialog
// ════════════════════════════════════════════════════════════════════════════

test.describe("ConfirmDialog", () => {
  test("should show confirmation dialog with title and description", async ({ page }) => {
    await mockSession(page, "ADMIN");

    // Mock users API to return users (delete button appears for other users)
    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    // Wait for table to render
    await page.waitForTimeout(1000);

    // Find and click the delete button (Trash2, title="Supprimer")
    const deleteBtn = page.locator('button[title="Supprimer"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Verify dialog content
    await expect(page.getByText("Supprimer l'utilisateur ?")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/Êtes-vous sûr de vouloir supprimer/i)).toBeVisible();
  });

  test("should have destructive variant styling on confirm button", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Open the delete dialog
    const deleteBtn = page.locator('button[title="Supprimer"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // The confirm button in the dialog has variant="destructive"
    // The Button component applies "bg-semantic-error" class for destructive variant
    const confirmBtn = page.locator('div[role="dialog"] button').filter({ hasText: "Supprimer" });
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });

    // Check for destructive styling classes
    await expect(confirmBtn).toHaveClass(/bg-semantic-error/);
  });

  test("should close on cancel", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Open dialog
    const deleteBtn = page.locator('button[title="Supprimer"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Dialog should be visible
    await expect(page.getByText("Supprimer l'utilisateur ?")).toBeVisible({ timeout: 3000 });

    // Click "Annuler"
    const cancelBtn = page.locator('div[role="dialog"] button').filter({ hasText: "Annuler" });
    await expect(cancelBtn).toBeVisible({ timeout: 3000 });
    await cancelBtn.click();

    // Dialog should close
    await expect(page.getByText("Supprimer l'utilisateur ?")).not.toBeVisible({
      timeout: 3000,
    });
  });

  test("should show loading spinner on confirm button when loading", async ({ page }) => {
    await mockSession(page, "ADMIN");

    // Stub the DELETE API to be slow so the dialog stays in loading state
    await page.route("**/api/admin/users*", async (route, request) => {
      if (request.method() === "DELETE") {
        await new Promise((r) => setTimeout(r, 5000));
        await route.fulfill({ status: 200, json: { success: true } });
      } else {
        await route.fulfill({
          json: buildUsersResponse(DEFAULT_USERS, {
            total: 2,
            totalPages: 1,
            page: 1,
            limit: 20,
          }),
        });
      }
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Open dialog
    const deleteBtn = page.locator('button[title="Supprimer"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Click confirm to trigger loading state
    const confirmBtn = page.locator('div[role="dialog"] button').filter({ hasText: "Supprimer" });
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Check for Loader2 spinner inside the confirm button
    await expect(confirmBtn.locator(".lucide-loader2")).toBeVisible({ timeout: 3000 });
  });

  test("should disable buttons while loading", async ({ page }) => {
    await mockSession(page, "ADMIN");

    // Stub the DELETE API to be slow
    await page.route("**/api/admin/users*", async (route, request) => {
      if (request.method() === "DELETE") {
        await new Promise((r) => setTimeout(r, 5000));
        await route.fulfill({ status: 200, json: { success: true } });
      } else {
        await route.fulfill({
          json: buildUsersResponse(DEFAULT_USERS, {
            total: 2,
            totalPages: 1,
            page: 1,
            limit: 20,
          }),
        });
      }
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Open dialog
    const deleteBtn = page.locator('button[title="Supprimer"]').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Both buttons should initially be enabled
    const confirmBtn = page.locator('div[role="dialog"] button').filter({ hasText: "Supprimer" });
    const cancelBtn = page.locator('div[role="dialog"] button').filter({ hasText: "Annuler" });

    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await expect(confirmBtn).not.toBeDisabled();
    await expect(cancelBtn).not.toBeDisabled();

    // Click confirm — this triggers loading
    await confirmBtn.click();

    // Both buttons should now be disabled
    await expect(confirmBtn).toBeDisabled({ timeout: 3000 });
    await expect(cancelBtn).toBeDisabled({ timeout: 3000 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Pagination (shared component)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Pagination", () => {
  test("should show page indicator", async ({ page }) => {
    await mockSession(page, "ADMIN");

    const pageParam = { current: 1 };

    // AdminUsersPage hardcodes limit=20; need totalItems > 40 for totalPages > 2
    await page.route("**/api/admin/users*", async (route) => {
      const url = new URL(route.request().url());
      pageParam.current = parseInt(url.searchParams.get("page") || "1", 10);
      const users = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${pageParam.current}-${i}`,
        email: `user${pageParam.current}-${i}@test.com`,
        name: `User ${pageParam.current}-${i}`,
        role: "USER",
        createdAt: "2026-01-15T00:00:00Z",
      }));
      await route.fulfill({
        json: buildUsersResponse(users, {
          total: 100,
          totalPages: 5,
          page: pageParam.current,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    // Wait for pagination to render
    await page.waitForTimeout(1000);

    // The Pagination component shows: "Page {current} of {totalPages}"
    await expect(page.getByText("Page 1 of 5")).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to next page", async ({ page }) => {
    await mockSession(page, "ADMIN");

    const pageParam = { current: 1 };

    // AdminUsersPage hardcodes limit=20; need totalItems > 40 for totalPages > 2
    await page.route("**/api/admin/users*", async (route) => {
      const url = new URL(route.request().url());
      pageParam.current = parseInt(url.searchParams.get("page") || "1", 10);
      const users = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${pageParam.current}-${i}`,
        email: `user${pageParam.current}-${i}@test.com`,
        name: `User ${pageParam.current}-${i}`,
        role: "USER",
        createdAt: "2026-01-15T00:00:00Z",
      }));
      await route.fulfill({
        json: buildUsersResponse(users, {
          total: 100,
          totalPages: 5,
          page: pageParam.current,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Should start on page 1
    await expect(page.getByText("Page 1 of 5")).toBeVisible({ timeout: 5000 });

    // Click the Next button (ChevronRight, aria-label="Next page")
    const nextBtn = page.locator('button[aria-label="Next page"]');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Wait for re-render after page change (triggers loading → refetch → render)
    await page.waitForTimeout(1000);

    // Should now be on page 2
    await expect(page.getByText("Page 2 of 5")).toBeVisible({ timeout: 5000 });
  });

  test("should disable previous button on first page", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 25,
          totalPages: 5,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Previous button should be disabled on first page
    const prevBtn = page.locator('button[aria-label="Previous page"]');
    await expect(prevBtn).toBeVisible({ timeout: 5000 });
    await expect(prevBtn).toBeDisabled();
  });

  test("should disable next button on last page", async ({ page }) => {
    await mockSession(page, "ADMIN");

    const pageParam = { current: 1 };

    // AdminUsersPage hardcodes limit=20; need totalItems > 40 for totalPages > 2
    await page.route("**/api/admin/users*", async (route) => {
      const url = new URL(route.request().url());
      pageParam.current = parseInt(url.searchParams.get("page") || "1", 10);
      const users = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${pageParam.current}-${i}`,
        email: `user${pageParam.current}-${i}@test.com`,
        name: `User ${pageParam.current}-${i}`,
        role: "USER",
        createdAt: "2026-01-15T00:00:00Z",
      }));
      await route.fulfill({
        json: buildUsersResponse(users, {
          total: 60,
          totalPages: 3,
          page: pageParam.current,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Navigate to page 3 (last page)
    const nextBtn = page.locator('button[aria-label="Next page"]');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    await page.waitForTimeout(500);
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // Should be on page 3
    await expect(page.getByText("Page 3 of 3")).toBeVisible({ timeout: 5000 });

    // Next button should be disabled on last page
    await expect(nextBtn).toBeDisabled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. SearchBar (shared component)
// ════════════════════════════════════════════════════════════════════════════

test.describe("SearchBar", () => {
  test("should show search input with placeholder", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // The SearchBar on admin/users has placeholder "Rechercher par email ou nom..."
    const searchInput = page.locator('input[placeholder="Rechercher par email ou nom..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("should show clear button when search has text", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // The clear button (X icon) should not be visible initially
    const clearBtn = page
      .locator("button")
      .filter({ has: page.locator(".lucide-x") })
      .first();
    await expect(clearBtn).not.toBeVisible({ timeout: 3000 });

    // Type in the search input
    const searchInput = page.locator('input[placeholder="Rechercher par email ou nom..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("alice");

    // The clear button should now appear
    await expect(clearBtn).toBeVisible({ timeout: 3000 });
  });

  test("should clear search on clear button click", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Type in search
    const searchInput = page.locator('input[placeholder="Rechercher par email ou nom..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("alice");

    // Clear button should be visible
    const clearBtn = page
      .locator("button")
      .filter({ has: page.locator(".lucide-x") })
      .first();
    await expect(clearBtn).toBeVisible({ timeout: 3000 });

    // Click clear button
    await clearBtn.click();

    // Wait for state update
    await page.waitForTimeout(500);

    // Input should be empty
    await expect(searchInput).toHaveValue("");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Breadcrumb navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Breadcrumb", () => {
  test("should show breadcrumb on admin dashboard", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: {
          users: { total: 10, activeThisMonth: 5, newThisWeek: 1, newThisMonth: 3 },
          organizations: { total: 3, withSubscription: 2 },
          content: { totalGenerated: 100, publishedToday: 5, publishedThisMonth: 30 },
          publications: { today: 2, thisMonth: 15 },
          trends: null,
        },
      });
    });

    await page.goto("/admin");
    if (await skipIfRedirected(page)) return;

    // Wait for page to render
    await page.waitForTimeout(1500);

    // Breadcrumb on admin dashboard: "Administration"
    await expect(page.getByText("Administration").first()).toBeVisible({ timeout: 5000 });
  });

  test("should show breadcrumb hierarchy on users page", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // Breadcrumb: "Administration > Utilisateurs"
    await expect(page.getByText("Administration").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Utilisateurs").first()).toBeVisible({ timeout: 5000 });
  });

  test("should show breadcrumb hierarchy on user detail", async ({ page }) => {
    const userId = `test-user-detail-${Date.now()}`;
    const userName = "Jane Test";

    await mockSession(page, "ADMIN");

    // Mock user detail API
    await page.route(new RegExp(`/api/admin/users/${userId}`), async (route) => {
      await route.fulfill({
        json: {
          id: userId,
          email: "jane.test@example.com",
          name: userName,
          image: null,
          role: "USER",
          cguAccepted: true,
          createdAt: "2026-01-15T00:00:00Z",
          profiles: [],
          ownedTeams: [],
          teamMemberships: [],
          stats: { totalContent: 0, publishedContent: 0 },
        },
      });
    });

    await page.goto(`/admin/users/${userId}`);
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1500);

    // Breadcrumb: "Administration > Utilisateurs > Jane Test"
    await expect(page.getByText("Administration").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Utilisateurs").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(userName).first()).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to parent page via breadcrumb link", async ({ page }) => {
    await mockSession(page, "ADMIN");

    await page.route("**/api/admin/users*", async (route) => {
      await route.fulfill({
        json: buildUsersResponse(DEFAULT_USERS, {
          total: 2,
          totalPages: 1,
          page: 1,
          limit: 20,
        }),
      });
    });

    // Mock admin dashboard stats so the target page loads
    await page.route("**/api/admin/stats*", async (route) => {
      await route.fulfill({
        json: {
          users: { total: 10, activeThisMonth: 5, newThisWeek: 1, newThisMonth: 3 },
          organizations: { total: 3, withSubscription: 2 },
          content: { totalGenerated: 100, publishedToday: 5, publishedThisMonth: 30 },
          publications: { today: 2, thisMonth: 15 },
          trends: null,
        },
      });
    });

    await page.goto("/admin/users");
    if (await skipIfRedirected(page)) return;

    await page.waitForTimeout(1000);

    // "Administration" in the breadcrumb should be a link (href="/admin")
    const adminLink = page.locator('nav a[href="/admin"]').first();
    await expect(adminLink).toBeVisible({ timeout: 5000 });
    await expect(adminLink).toContainText("Administration");

    // Click the breadcrumb link
    await adminLink.click();
    await page.waitForLoadState("networkidle", { timeout: 8000 });

    // Should navigate to /admin
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/admin");
  });
});
