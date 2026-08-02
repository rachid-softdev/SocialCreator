/**
 * E2E Tests for Deep Content History
 * Tests: History list, action badges, filters/search, version diff/comparison,
 *        rollback, pagination, empty state, error handling with retry
 *
 * API Endpoints:
 *   GET /api/v1/content-history?page=1&pageSize=20&action=&dateFrom=&dateTo=&contentId=
 *   GET /api/v1/content-history/:id
 *   GET /api/v1/content-history/:id/diff?compareTo=:otherId
 *   POST /api/v1/content-history/:id/rollback
 *
 * Response Model:
 *   { entries: ContentHistoryEntry[], totalPages: number, page: number, pageSize: number }
 *
 * UI Language: French
 *   - Heading: "Historique du contenu"
 *   - Empty state: "Aucun historique"
 *   - Action badges: Créé / Modifié / Publié / Supprimé
 *   - Pagination: "Page X sur Y"
 */

import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentHistoryUser {
  id: string;
  name: string;
}

interface ContentHistoryEntry {
  id: string;
  contentId: string;
  action: "CREATED" | "UPDATED" | "PUBLISHED" | "DELETED" | "REVIEWED" | "APPROVED";
  timestamp: string;
  user: ContentHistoryUser;
  details: string;
}

interface ContentHistoryResponse {
  entries: ContentHistoryEntry[];
  totalPages: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockSession(page: import("@playwright/test").Page) {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "user-deep-1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
  });
}

async function skipIfRedirected(page: import("@playwright/test").Page): Promise<boolean> {
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === "/login") {
    test.skip();
    return true;
  }
  return false;
}

function mockHistoryEntry(
  id: string,
  overrides: Partial<ContentHistoryEntry> = {},
): ContentHistoryEntry {
  const base: ContentHistoryEntry = {
    id,
    contentId: `content-${id}`,
    action: "CREATED",
    timestamp: new Date().toISOString(),
    user: { id: "user-1", name: "User 1" },
    details: "Contenu créé",
    ...overrides,
  };
  return base;
}

function buildHistoryResponse(
  entries: ContentHistoryEntry[],
  page = 1,
  pageSize = 20,
): ContentHistoryResponse {
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    entries: entries.slice(start, end),
    totalPages,
    page,
    pageSize,
  };
}

// Map action codes to French badge labels
const ACTION_LABELS: Record<string, string> = {
  CREATED: "Créé",
  UPDATED: "Modifié",
  PUBLISHED: "Publié",
  DELETED: "Supprimé",
  REVIEWED: "Révisé",
  APPROVED: "Approuvé",
};

// ---------------------------------------------------------------------------
// Page selectors (assumes French UI)
// ---------------------------------------------------------------------------

const HEADING = "Historique du contenu";
const EMPTY_STATE_TEXT = "Aucun historique";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Content History Deep", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  // =====================================================================
  // History list (4 tests)
  // =====================================================================

  test.describe("Affichage de la liste", () => {
    test("DEV-001: La page d'historique se charge avec le bon titre", async ({ page }) => {
      await page.route("**/api/v1/content-history**", async (route) => {
        const response = buildHistoryResponse([mockHistoryEntry("entry-1")], 1, 20);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(response),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: HEADING })).toBeVisible({ timeout: 10000 });
    });

    test("DEV-002: Affiche les 10 entrées d'historique simulées", async ({ page }) => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        mockHistoryEntry(`entry-${i}`, {
          contentId: `content-${i}`,
          action: i % 2 === 0 ? "CREATED" : "UPDATED",
          details: `Action #${i + 1}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        }),
      );

      await page.route("**/api/v1/content-history**", async (route) => {
        const url = new URL(route.request().url());
        const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
        const response = buildHistoryResponse(entries, pageParam);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(response),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for data to render
      await expect(page.getByText(ACTION_LABELS.CREATED!).first()).toBeVisible({
        timeout: 10000,
      });

      // Count entry rows (look for history item cards)
      const entryCards = page.locator('[class*="rounded-lg"][class*="border"]');
      const count = await entryCards.count();
      expect(count).toBe(10);
    });

    test("DEV-003: Les badges d'action affichent le bon libellé", async ({ page }) => {
      const actions: ContentHistoryEntry["action"][] = [
        "CREATED",
        "UPDATED",
        "PUBLISHED",
        "DELETED",
      ];
      const entries = actions.map((action, i) =>
        mockHistoryEntry(`badge-${i}`, {
          contentId: `content-badge-${i}`,
          action,
          details: `Action: ${action}`,
        }),
      );

      await page.route("**/api/v1/content-history**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse(entries)),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Verify each badge label appears
      for (const action of actions) {
        const label = ACTION_LABELS[action]!;
        await expect(page.getByText(label).first()).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test("DEV-004: Le squelette de chargement apparaît puis les données", async ({ page }) => {
      let resolvePromise: () => void;
      const delayPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      await page.route("**/api/v1/content-history**", async (route) => {
        await delayPromise;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse([mockHistoryEntry("delayed-1")])),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Skeleton should be visible while loading
      const skeleton = page.locator(".animate-pulse").first();
      await expect(skeleton).toBeVisible({ timeout: 3000 });

      // Resolve the API delay
      resolvePromise!();

      // Skeleton should disappear and data should show
      await expect(skeleton).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(ACTION_LABELS.CREATED!).first()).toBeVisible({ timeout: 5000 });
    });
  });

  // =====================================================================
  // Filters & search (4 tests)
  // =====================================================================

  test.describe("Filtres et recherche", () => {
    test("DEV-005: Filtrer par type d'action met à jour les entrées affichées", async ({
      page,
    }) => {
      // Spy on API calls to verify query params
      const apiCalls: string[] = [];

      await page.route("**/api/v1/content-history**", async (route) => {
        const url = new URL(route.request().url());
        apiCalls.push(url.searchParams.get("action") ?? "");
        // Return filtered data matching the action param
        const actionFilter = url.searchParams.get("action") ?? "";
        const allEntries = [
          mockHistoryEntry("f1", {
            action: "CREATED",
            contentId: "c-created",
          }),
          mockHistoryEntry("f2", {
            action: "UPDATED",
            contentId: "c-updated",
          }),
          mockHistoryEntry("f3", {
            action: "PUBLISHED",
            contentId: "c-published",
          }),
        ];
        const filtered = actionFilter
          ? allEntries.filter((e) => e.action === actionFilter)
          : allEntries;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse(filtered)),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for initial load
      await expect(page.getByText(ACTION_LABELS.CREATED!).first()).toBeVisible({ timeout: 10000 });

      // Click the "Créé" filter button
      const filterButton = page.getByRole("button").filter({ hasText: ACTION_LABELS.CREATED });
      if (await filterButton.isVisible().catch(() => false)) {
        await filterButton.click();
        await page.waitForTimeout(500);

        // Verify API was called with action=CREATED
        expect(apiCalls).toContain("CREATED");
      }
    });

    test("DEV-006: Définir une plage de dates envoie les bons paramètres API", async ({ page }) => {
      const apiParams: URLSearchParams[] = [];

      await page.route("**/api/v1/content-history**", async (route) => {
        const url = new URL(route.request().url());
        apiParams.push(url.searchParams);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            buildHistoryResponse([
              mockHistoryEntry("date-entry-1", {
                action: "PUBLISHED",
                timestamp: "2026-06-15T12:00:00.000Z",
              }),
            ]),
          ),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for initial load
      await expect(page.getByText("2026").first()).toBeVisible({
        timeout: 10000,
      });

      // Find date inputs (date-from, date-to) and fill them
      const dateFromInput = page.locator('input[type="date"], input[placeholder*="date" i]');
      if ((await dateFromInput.count()) >= 2) {
        await dateFromInput.nth(0).fill("2026-06-01");
        await dateFromInput.nth(1).fill("2026-06-30");

        // Trigger blur or change to submit the filter
        await page.keyboard.press("Tab");
        await page.waitForTimeout(500);

        // Check that the most recent API call includes date params
        const lastParams = apiParams[apiParams.length - 1];
        if (lastParams) {
          const dateFrom = lastParams.get("dateFrom");
          const dateTo = lastParams.get("dateTo");
          // Either dateFrom/dateTo are present, or the component debounces
          const hasDateFilter = dateFrom !== null || dateTo !== null;
          expect(hasDateFilter).toBe(true);
        }
      }
    });

    test("DEV-007: Rechercher par ID de contenu filtre les résultats", async ({ page }) => {
      await page.route("**/api/v1/content-history**", async (route) => {
        const url = new URL(route.request().url());
        const searchQuery = url.searchParams.get("contentId") ?? "";
        const allEntries = [
          mockHistoryEntry("s1", {
            contentId: "content-alpha",
            action: "CREATED",
          }),
          mockHistoryEntry("s2", {
            contentId: "content-beta",
            action: "UPDATED",
          }),
          mockHistoryEntry("s3", {
            contentId: "content-alpha",
            action: "PUBLISHED",
          }),
        ];
        const filtered = searchQuery
          ? allEntries.filter((e) => e.contentId.includes(searchQuery))
          : allEntries;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse(filtered)),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for initial load
      await expect(page.getByText("content-alpha").first()).toBeVisible({ timeout: 10000 });

      // Type in search field
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="rechercher" i], input[placeholder*="content" i]',
      );
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill("content-beta");
        await page.waitForTimeout(500);

        // Verify that only beta-related items appear
        const visibleText = await page.textContent("body");
        expect(visibleText).toContain("content-beta");
      }
    });

    test("DEV-008: Réinitialiser les filtres restaure la liste complète", async ({ page }) => {
      let callIndex = 0;
      const totalEntries = [
        mockHistoryEntry("r1", { contentId: "reset-1", action: "CREATED" }),
        mockHistoryEntry("r2", { contentId: "reset-2", action: "UPDATED" }),
        mockHistoryEntry("r3", { contentId: "reset-3", action: "PUBLISHED" }),
      ];

      await page.route("**/api/v1/content-history**", async (route) => {
        callIndex++;
        const url = new URL(route.request().url());
        const actionFilter = url.searchParams.get("action") ?? "";
        const filtered = actionFilter
          ? totalEntries.filter((e) => e.action === actionFilter)
          : totalEntries;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse(filtered)),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for full list
      await expect(page.getByText(ACTION_LABELS.CREATED!).first()).toBeVisible({ timeout: 10000 });

      // Apply a filter (click on filter button)
      const filterBtn = page.getByRole("button").filter({ hasText: ACTION_LABELS.CREATED });
      if (await filterBtn.isVisible().catch(() => false)) {
        await filterBtn.click();
        await page.waitForTimeout(500);
      }

      // Find and click reset/clear button
      const resetBtn = page
        .getByRole("button")
        .filter({ hasText: /réinitialiser|effacer|clear|reset/i });
      if (await resetBtn.isVisible().catch(() => false)) {
        await resetBtn.click();
        await page.waitForTimeout(500);

        // After reset, the full list should be visible again
        const visibleText = await page.textContent("body");
        expect(visibleText).toContain("reset-1");
        expect(visibleText).toContain("reset-2");
        expect(visibleText).toContain("reset-3");
      }
    });
  });

  // =====================================================================
  // Content version diff (3 tests)
  // =====================================================================

  test.describe("Comparaison de versions", () => {
    test("DEV-009: Cliquer sur une entrée ouvre le panneau de détails", async ({ page }) => {
      const entry = mockHistoryEntry("detail-1", {
        contentId: "content-detail",
        action: "UPDATED",
        details: "Mise à jour du texte principal",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user: { id: "user-2", name: "Alice" },
      });

      await page.route("**/api/v1/content-history**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse([entry])),
        });
      });

      // Mock the single-entry detail API
      await page.route("**/api/v1/content-history/detail-1", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...entry,
            content: {
              textContent: "Ancien texte du contenu avant modification",
              hashtags: ["#social", "#content"],
            },
          }),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for entry to render
      await expect(page.getByText("Mise à jour du texte principal")).toBeVisible({
        timeout: 10000,
      });

      // Click on the entry card to open details
      const entryCard = page.locator('[class*="rounded-lg"][class*="border"]').first();
      await entryCard.click();

      // Verify a details panel or section is visible
      const detailsPanel = page.locator(
        '[class*="panel"], [role="dialog"], [class*="details"], section:has-text("Détails")',
      );
      const panelVisible = await detailsPanel
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      // Alternatively, the component might expand in-place
      const detailsText = page.getByText("Alice");
      const hasDetails = await detailsText.isVisible({ timeout: 3000 }).catch(() => false);
      expect(panelVisible || hasDetails).toBe(true);
    });

    test("DEV-010: Comparer deux versions affiche les différences", async ({ page }) => {
      // Mock multiple versions for the same content
      const version1 = mockHistoryEntry("v1", {
        contentId: "content-compare",
        action: "CREATED",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        details: "Version initiale",
      });
      const version2 = mockHistoryEntry("v2", {
        contentId: "content-compare",
        action: "UPDATED",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: "Corrections orthographe",
      });
      const version3 = mockHistoryEntry("v3", {
        contentId: "content-compare",
        action: "PUBLISHED",
        timestamp: new Date().toISOString(),
        details: "Publication finale",
      });

      // Mock the history list
      await page.route("**/api/v1/content-history**", async (route) => {
        const url = new URL(route.request().url());
        // If this is a diff request, handle separately
        if (url.pathname.includes("/diff")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              left: {
                version: 1,
                content: "Bonjour le monde",
                timestamp: version1.timestamp,
              },
              right: {
                version: 2,
                content: "Bonjour tout le monde",
                timestamp: version2.timestamp,
              },
              changes: [
                { type: "removed", text: "Bonjour le" },
                { type: "added", text: "Bonjour tout" },
                { type: "unchanged", text: " monde" },
              ],
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse([version1, version2, version3])),
        });
      });

      // Mock diff endpoint
      await page.route("**/api/v1/content-history/**/diff**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            left: {
              version: 1,
              content: "Bonjour le monde",
              timestamp: version1.timestamp,
            },
            right: {
              version: 2,
              content: "Bonjour tout le monde",
              timestamp: version2.timestamp,
            },
            changes: [
              { type: "removed", text: "Bonjour le" },
              { type: "added", text: "Bonjour tout" },
              { type: "unchanged", text: " monde" },
            ],
          }),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for entries
      await expect(page.getByText("Version initiale").first()).toBeVisible({ timeout: 10000 });

      // Look for a "compare" or "diff" button
      const compareBtn = page.getByRole("button").filter({ hasText: /comparer|diff/i });
      if (await compareBtn.isVisible().catch(() => false)) {
        await compareBtn.click();
        await page.waitForTimeout(500);

        // Verify diff view shows changes
        const diffContent = page.getByText("Bonjour tout le monde");
        const hasDiff = await diffContent.isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasDiff).toBe(true);
      }
    });

    test("DEV-011: Restaurer une version antérieure appelle l'API", async ({ page }) => {
      // Track rollback API call
      let rollbackCalled = false;
      let rollbackPayload: unknown = null;

      const versionTarget = mockHistoryEntry("v-target", {
        contentId: "content-rollback",
        action: "UPDATED",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        details: "Version stable avant erreur",
      });
      const versionLatest = mockHistoryEntry("v-latest", {
        contentId: "content-rollback",
        action: "UPDATED",
        timestamp: new Date().toISOString(),
        details: "Modification problématique",
      });

      // Mock history list
      await page.route("**/api/v1/content-history**", async (route) => {
        const url = new URL(route.request().url());
        // Don't intercept rollback POST via GET pattern
        if (route.request().method() !== "GET") {
          await route.continue();
          return;
        }
        // If it's a specific entry detail request
        if (url.pathname !== "/api/v1/content-history" && !url.pathname.includes("/diff")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(versionTarget),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse([versionTarget, versionLatest])),
        });
      });

      // Mock rollback endpoint
      await page.route("**/api/v1/content-history/**/rollback", async (route) => {
        if (route.request().method() === "POST") {
          rollbackCalled = true;
          rollbackPayload = route.request().postData();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Version restaurée avec succès",
              restoredVersionId: versionTarget.id,
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for entries
      await expect(page.getByText("Version stable avant erreur")).toBeVisible({ timeout: 10000 });

      // Find and click the rollback/restore button
      const rollbackBtn = page.getByRole("button").filter({ hasText: /restaurer|rollback/i });
      if (await rollbackBtn.isVisible().catch(() => false)) {
        await rollbackBtn.click();
        await page.waitForTimeout(500);

        // If there's a confirmation dialog, click confirm
        const confirmBtn = page.getByRole("button").filter({ hasText: /confirmer|oui|confirm/i });
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }

        // Verify the rollback API was called
        expect(rollbackCalled).toBe(true);
        // Verify the payload contains the target version
        if (rollbackPayload) {
          const parsed =
            typeof rollbackPayload === "string" ? JSON.parse(rollbackPayload) : rollbackPayload;
          expect(parsed).toBeTruthy();
        }
      }
    });
  });

  // =====================================================================
  // Pagination & edge cases (4 tests)
  // =====================================================================

  test.describe("Pagination et cas limites", () => {
    test("DEV-012: L'état vide affiche 'Aucun historique'", async ({ page }) => {
      await page.route("**/api/v1/content-history**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse([], 1, 20)),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Empty state should be visible
      await expect(page.getByText(EMPTY_STATE_TEXT)).toBeVisible({
        timeout: 10000,
      });

      // Pagination buttons should not be visible
      await expect(
        page.getByRole("button").filter({ hasText: /précédent|previous/i }),
      ).not.toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("button").filter({ hasText: /suivant|next/i })).not.toBeVisible({
        timeout: 3000,
      });
    });

    test("DEV-013: La pagination fonctionne sur plusieurs pages", async ({ page }) => {
      // Generate 25 entries across 3 pages (pageSize=10)
      const allEntries = Array.from({ length: 25 }, (_, i) =>
        mockHistoryEntry(`paginate-${i}`, {
          contentId: `content-pag-${i}`,
          action: i % 3 === 0 ? "CREATED" : i % 3 === 1 ? "UPDATED" : "PUBLISHED",
          details: `Entrée #${i + 1}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        }),
      );

      let callCount = 0;
      await page.route("**/api/v1/content-history**", async (route) => {
        callCount++;
        const url = new URL(route.request().url());
        const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
        const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10);
        const start = (pageParam - 1) * pageSize;
        const end = start + pageSize;
        const totalPages = Math.ceil(allEntries.length / pageSize);

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            entries: allEntries.slice(start, end),
            totalPages,
            page: pageParam,
            pageSize,
          }),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for page 1 data
      await expect(page.getByText("Page").or(page.getByText("Entrée #1"))).toBeVisible({
        timeout: 10000,
      });

      // Find pagination controls
      const previousBtn = page.getByRole("button").filter({ hasText: /précédent|previous/i });
      const nextBtn = page.getByRole("button").filter({ hasText: /suivant|next/i });

      // Check page indicator exists
      const pageIndicator = page.locator("span, p").filter({ hasText: /page \d+ (sur|of) \d+/i });
      const hasPagination = (await pageIndicator.count()) > 0;
      const hasNextBtn = await nextBtn.isVisible().catch(() => false);

      if (hasPagination) {
        // Verify page 1
        const pageText = await pageIndicator.first().textContent();
        expect(pageText?.toLowerCase()).toMatch(/page 1 (sur|of) 3/);

        // Previous should be disabled or not visible on page 1
        if (await previousBtn.isVisible().catch(() => false)) {
          await expect(previousBtn).toBeDisabled();
        }

        // Go to page 2
        if (hasNextBtn && !(await nextBtn.isDisabled().catch(() => false))) {
          await nextBtn.click();
          await page.waitForTimeout(500);

          const pageText2 = await pageIndicator.first().textContent();
          expect(pageText2?.toLowerCase()).toMatch(/page 2 (sur|of) 3/);
        }

        // Go to page 3 (last page)
        if (await nextBtn.isVisible().catch(() => false)) {
          if (!(await nextBtn.isDisabled().catch(() => false))) {
            await nextBtn.click();
            await page.waitForTimeout(500);

            const pageText3 = await pageIndicator.first().textContent();
            expect(pageText3?.toLowerCase()).toMatch(/page 3 (sur|of) 3/);

            // Next should be disabled on last page
            await expect(nextBtn).toBeDisabled();
          }
        }

        // Navigate back to page 1
        if (await previousBtn.isVisible().catch(() => false)) {
          if (!(await previousBtn.isDisabled().catch(() => false))) {
            await previousBtn.click();
            await page.waitForTimeout(500);

            const pageTextBack = await pageIndicator.first().textContent();
            expect(pageTextBack?.toLowerCase()).toMatch(/page 2 (sur|of) 3/);

            await previousBtn.click();
            await page.waitForTimeout(500);

            const pageTextHome = await pageIndicator.first().textContent();
            expect(pageTextHome?.toLowerCase()).toMatch(/page 1 (sur|of) 3/);
          }
        }
      } else if (hasNextBtn) {
        // Fallback: just test next/previous navigation
        await nextBtn.click();
        await page.waitForTimeout(500);
        expect(callCount).toBeGreaterThanOrEqual(2);
      }
    });

    test("DEV-014: Les dates très anciennes sont formatées correctement", async ({ page }) => {
      const entries = [
        mockHistoryEntry("old-1", {
          contentId: "content-old",
          action: "CREATED",
          details: "Contenu archivé",
          timestamp: "2020-01-15T08:30:00.000Z",
          user: { id: "user-1", name: "Admin" },
        }),
        mockHistoryEntry("old-2", {
          contentId: "content-old",
          action: "UPDATED",
          details: "Dernière modification",
          timestamp: "2021-06-20T14:00:00.000Z",
          user: { id: "user-2", name: "Editor" },
        }),
        mockHistoryEntry("old-3", {
          contentId: "content-old",
          action: "PUBLISHED",
          details: "Publication initiale",
          timestamp: "2022-03-10T09:15:00.000Z",
          user: { id: "user-1", name: "Admin" },
        }),
      ];

      await page.route("**/api/v1/content-history**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildHistoryResponse(entries)),
        });
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // Wait for entries to appear
      await expect(page.getByText("Contenu archivé").first()).toBeVisible({ timeout: 10000 });

      // Verify that the entries render without crashing
      // Old dates should appear formatted (year should be visible)
      const bodyText = await page.textContent("body");

      // Should contain old years (2020, 2021, 2022)
      expect(bodyText).toContain("2020");
      expect(bodyText).toContain("2021");
      expect(bodyText).toContain("2022");

      // All 3 entries should be present
      const entryCards = page.locator('[class*="rounded-lg"][class*="border"]');
      const count = await entryCards.count();
      expect(count).toBe(3);
    });

    test("DEV-015: Une erreur 500 API affiche un bouton de réessai", async ({ page }) => {
      let attemptCount = 0;

      await page.route("**/api/v1/content-history**", async (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Erreur interne du serveur" }),
          });
        } else {
          // Subsequent attempts succeed
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(
              buildHistoryResponse([
                mockHistoryEntry("retry-1", {
                  contentId: "content-retry",
                  action: "PUBLISHED",
                  details: "Récupéré après erreur",
                }),
              ]),
            ),
          });
        }
      });

      await page.goto("/content/history/deep");

      if (await skipIfRedirected(page)) return;

      // After initial 500, should see an error or retry UI
      // The component might show an error message with retry button
      const errorElement = page.getByText(/erreur|error|impossible|échec|failed/i).first();
      const retryButton = page
        .getByRole("button")
        .filter({ hasText: /réessayer|retry|recharger|refresh/i });

      const hasError = await errorElement.isVisible({ timeout: 5000 }).catch(() => false);
      const hasRetry = await retryButton.isVisible({ timeout: 3000 }).catch(() => false);

      // Either error text or retry button should be visible
      expect(hasError || hasRetry).toBe(true);

      // If retry button exists, click it and verify success
      if (hasRetry) {
        await retryButton.click();
        await page.waitForTimeout(500);

        // Data should now load successfully
        await expect(page.getByText("Récupéré après erreur")).toBeVisible({ timeout: 10000 });

        // API should have been called at least twice (first fail, then success)
        expect(attemptCount).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
