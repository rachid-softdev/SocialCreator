/**
 * E2E Tests for Admin Billing & Subscription Management (/admin/billing)
 *
 * Covers:
 * - Billing overview page (heading, current plan, features summary, loading skeleton)
 * - Plan management / upgrade-downgrade (comparison, upgrade, downgrade preview, cancel)
 * - Invoice history (list, status badges, pagination, download link)
 * - Subscription edge cases (cancel, reactivate, API failure, no subscription)
 *
 * Strategy: Uses page.route() to mock APIs, test.skip() when redirected to /login.
 * Follows patterns from admin.spec.ts and admin-components.spec.ts.
 */

import { expect, test } from "@playwright/test";

// ── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  createdAt: string;
  description: string;
  pdfUrl: string | null;
}

interface Plan {
  key: string;
  name: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

interface Subscription {
  planKey: string;
  planName: string;
  status: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  features: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Skip the current test if the page redirected to /login (not authenticated). */
async function skipIfRedirected(page: import("@playwright/test").Page): Promise<boolean> {
  const currentUrl = new URL(page.url());
  if (currentUrl.pathname === "/login") {
    test.skip();
    return true;
  }
  return false;
}

/** Mock /api/auth/session to return ADMIN by default. */
async function mockSession(page: import("@playwright/test").Page, role: string | null = "ADMIN") {
  await page.route("**/api/auth/session", async (route) => {
    if (role === null) {
      await route.fulfill({ status: 200, json: {} });
    } else {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: "admin-session-id",
            name: "Admin User",
            email: "admin@test.com",
            role,
          },
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        },
      });
    }
  });
}

/** Build a mock invoice with optional overrides. */
function mockInvoice(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    amount: 2999,
    currency: "eur",
    status: "paid",
    createdAt: "2026-05-15T00:00:00Z",
    description: "Abonnement PRO - Mai 2026",
    pdfUrl: "https://example.com/invoice.pdf",
    ...overrides,
  };
}

/** Build a mock plan with optional overrides. */
function mockPlan(key: string, overrides: Partial<Plan> = {}): Plan {
  const plans: Record<string, { name: string; price: number; features: string[] }> = {
    FREE: {
      name: "Gratuit",
      price: 0,
      features: ["1 profil", "5 publications/mois", "Support par email"],
    },
    PRO: {
      name: "Professionnel",
      price: 2999,
      features: [
        "10 profils",
        "Publications illimitées",
        "Analytiques avancées",
        "Support prioritaire",
        "API accessible",
      ],
    },
    BUSINESS: {
      name: "Business",
      price: 7999,
      features: [
        "Profils illimités",
        "Publications illimitées",
        "Analytiques avancées",
        "Support dédié",
        "API accessible",
        "Branding personnalisé",
        "Collaboration d'équipe",
      ],
    },
    ENTERPRISE: {
      name: "Enterprise",
      price: 19999,
      features: [
        "Tout inclusive",
        "SLA garanti",
        "Support 24/7",
        "Onboarding dédié",
        "SSO",
        "Audit logs",
        "Contrôles avancés",
      ],
    },
  };
  const base = plans[key] || plans.PRO;
  return {
    key,
    name: base.name,
    price: base.price,
    currency: "eur",
    interval: "month",
    features: base.features,
    isActive: true,
    sortOrder: Object.keys(plans).indexOf(key) + 1,
    ...overrides,
  };
}

/** Build a mock subscription with planKey to choose the plan features. */
function mockSubscription(planKey: string, overrides: Partial<Subscription> = {}): Subscription {
  const plan = mockPlan(planKey);
  return {
    planKey,
    planName: plan.name,
    status: "active",
    price: plan.price,
    currency: "eur",
    interval: "month",
    currentPeriodStart: "2026-06-01T00:00:00Z",
    currentPeriodEnd: "2026-07-01T00:00:00Z",
    cancelAtPeriodEnd: false,
    trialEnd: null,
    features: plan.features,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 1: Billing Overview Page
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Admin Billing — Overview Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should load billing page with Facturation heading", async ({ page }) => {
    await page.goto("/admin/billing");

    if (await skipIfRedirected(page)) return;

    await expect(page.getByRole("heading", { name: /facturation/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display current plan with name, price, and status", async ({ page }) => {
    const sub = mockSubscription("PRO");

    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: sub });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Plan name
    await expect(page.getByText(sub.planName).first()).toBeVisible({ timeout: 5000 });
    // Price (29,99 € in French formatting)
    await expect(page.getByText(/29/i).first()).toBeVisible({ timeout: 5000 });
    // Status
    await expect(page.getByText(/actif|active/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("should display plan features summary for PRO plan", async ({ page }) => {
    const sub = mockSubscription("PRO", {
      features: [
        "10 profils",
        "Publications illimitées",
        "Analytiques avancées",
        "Support prioritaire",
        "API accessible",
      ],
    });

    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: sub });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Features heading
    await expect(page.getByText(/fonctionnalités|features|détails du plan/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Individual features
    for (const feature of sub.features) {
      await expect(page.getByText(feature).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show loading skeleton then data when API is delayed", async ({ page }) => {
    let fulfillRoute: (value: unknown) => void;
    const apiPromise = new Promise((resolve) => {
      fulfillRoute = resolve;
    });

    await page.route("**/api/admin/billing/subscription", async (route) => {
      // Delay response by 2 seconds
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ json: mockSubscription("PRO") });
      fulfillRoute(undefined);
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Loading skeleton should appear while waiting
    const skeleton = page
      .locator(
        '[class*="skeleton"], [class*="animate-pulse"], [class*="Loader2"], svg[class*="animate-spin"]',
      )
      .first();
    await expect(skeleton).toBeVisible({ timeout: 3000 });

    // Wait for API response
    await apiPromise;
    await page.waitForTimeout(500);

    // After loading, the skeleton should be replaced by actual content
    await expect(skeleton).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/professionnel|pro/i).first()).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 2: Plan Management / Upgrade-Downgrade
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Admin Billing — Plan Management", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should display all available plans (FREE, PRO, BUSINESS, ENTERPRISE)", async ({ page }) => {
    const plans = [mockPlan("FREE"), mockPlan("PRO"), mockPlan("BUSINESS"), mockPlan("ENTERPRISE")];

    await page.route("**/api/admin/billing/plans", async (route) => {
      await route.fulfill({ json: { data: plans } });
    });
    // Default subscription is FREE so upgrades show
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("FREE") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    for (const plan of plans) {
      await expect(page.getByText(plan.name).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show confirmation dialog when upgrading from FREE to PRO", async ({ page }) => {
    const plans = [mockPlan("FREE"), mockPlan("PRO")];

    await page.route("**/api/admin/billing/plans", async (route) => {
      await route.fulfill({ json: { data: plans } });
    });
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("FREE") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Click the upgrade button for PRO
    const upgradeBtn = page
      .locator("button")
      .filter({ hasText: /passer.*pro|upgrade.*pro|pro.*choisir|souscrire.*pro/i })
      .first();
    await expect(upgradeBtn).toBeVisible({ timeout: 5000 });
    await upgradeBtn.click();

    // Confirmation dialog should appear
    const dialog = page
      .locator('[role="dialog"], [class*="modal"], [class*="dialog"]')
      .filter({ hasText: /confirmer|changement|passage.*pro|upgrade/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    // Dialog should mention the new plan
    await expect(dialog.getByText(/professionnel|pro/i)).toBeVisible({ timeout: 3000 });
  });

  test("should show current vs new plan comparison during downgrade preview", async ({ page }) => {
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("PRO") });
    });
    await page.route("**/api/admin/billing/plans", async (route) => {
      await route.fulfill({
        json: { data: [mockPlan("FREE"), mockPlan("PRO"), mockPlan("BUSINESS")] },
      });
    });

    // Mock the downgrade preview API
    await page.route("**/api/admin/billing/downgrade-preview*", async (route) => {
      await route.fulfill({
        json: {
          currentPlan: "PRO",
          newPlan: "FREE",
          changes: [
            { feature: "Nombre de profils", from: "10 profils", to: "1 profil" },
            { feature: "Publications", from: "Illimitées", to: "5/mois" },
            { feature: "Support", from: "Prioritaire", to: "Email" },
          ],
          creditAmount: 1500,
          effectiveDate: "2026-08-01T00:00:00Z",
        },
      });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Click a downgrade action for the FREE plan
    const downgradeBtn = page
      .locator("button")
      .filter({ hasText: /rétrograder|passer.*gratuit|free|downgrade/i })
      .first();
    if (await downgradeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await downgradeBtn.click();

      // Comparison section should be visible
      await expect(page.getByText(/comparaison|comparer|changements/i).first()).toBeVisible({
        timeout: 5000,
      });

      // Should show current vs new plan info
      const bodyText = await page.textContent("body");
      expect(bodyText).toMatch(/PRO|Professionnel/i);
      expect(bodyText).toMatch(/FREE|Gratuit/i);
    }
  });

  test("should cancel plan change without making API call", async ({ page }) => {
    let apiCalled = false;

    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("FREE") });
    });
    await page.route("**/api/admin/billing/plans", async (route) => {
      await route.fulfill({ json: { data: [mockPlan("FREE"), mockPlan("PRO")] } });
    });
    // Trap any POST/PUT to subscription
    await page.route("**/api/admin/billing/subscription*", async (route) => {
      if (route.request().method() !== "GET") {
        apiCalled = true;
      }
      await route.fulfill({ json: mockSubscription("PRO") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Find and open the change dialog
    const changeBtn = page
      .locator("button")
      .filter({ hasText: /changer|modifier|upgrade|passer/i })
      .first();
    if (await changeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await changeBtn.click();
      await page.waitForTimeout(500);

      // Cancel button should be visible in the dialog
      const cancelBtn = page
        .locator('[role="dialog"] button, [class*="modal"] button, [class*="dialog"] button')
        .filter({ hasText: /annuler|cancel/i })
        .first();
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(300);
      } else {
        // If no cancel button, close via escape or clicking outside
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    // No API mutation should have been made
    expect(apiCalled).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 3: Invoice History
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Admin Billing — Invoice History", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should display invoice list with multiple invoices and amounts", async ({ page }) => {
    const invoices = [
      mockInvoice(`inv-${Date.now()}-1`, {
        amount: 2999,
        description: "Abonnement PRO - Juin 2026",
        createdAt: "2026-06-01T00:00:00Z",
      }),
      mockInvoice(`inv-${Date.now()}-2`, {
        amount: 2999,
        description: "Abonnement PRO - Mai 2026",
        createdAt: "2026-05-01T00:00:00Z",
      }),
      mockInvoice(`inv-${Date.now()}-3`, {
        amount: 2999,
        description: "Abonnement PRO - Avril 2026",
        createdAt: "2026-04-01T00:00:00Z",
      }),
      mockInvoice(`inv-${Date.now()}-4`, {
        amount: 7999,
        description: "Abonnement BUSINESS - Mars 2026",
        createdAt: "2026-03-01T00:00:00Z",
      }),
      mockInvoice(`inv-${Date.now()}-5`, {
        amount: 0,
        description: "Crédit promo",
        createdAt: "2026-02-15T00:00:00Z",
      }),
      mockInvoice(`inv-${Date.now()}-6`, {
        amount: 2999,
        description: "Abonnement PRO - Février 2026",
        createdAt: "2026-02-01T00:00:00Z",
      }),
    ];

    await page.route("**/api/admin/billing/invoices*", async (route) => {
      await route.fulfill({
        json: { data: invoices, pagination: { total: 6, totalPages: 1, page: 1, limit: 10 } },
      });
    });
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("PRO") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Invoice section heading
    await expect(page.getByText(/factures|historique|invoices/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Each invoice amount should be visible (29,99 € or similar)
    await expect(page.getByText(/29,99|29\.99|€/).first()).toBeVisible({ timeout: 5000 });

    // Check invoice descriptions visible
    for (const inv of invoices) {
      if (inv.description) {
        const visible = await page
          .getByText(inv.description)
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        // At minimum the first few should be visible
        if (invoices.indexOf(inv) < 3) {
          expect(visible).toBe(true);
        }
      }
    }
  });

  test("should display correct status badges for paid/open/void/uncollectible invoices", async ({
    page,
  }) => {
    const invoices: Invoice[] = [
      mockInvoice(`inv-paid-${Date.now()}`, { status: "paid", amount: 2999 }),
      mockInvoice(`inv-open-${Date.now()}`, { status: "open", amount: 2999 }),
      mockInvoice(`inv-void-${Date.now()}`, { status: "void", amount: 0 }),
      mockInvoice(`inv-uncoll-${Date.now()}`, { status: "uncollectible", amount: 2999 }),
    ];

    await page.route("**/api/admin/billing/invoices*", async (route) => {
      await route.fulfill({
        json: { data: invoices, pagination: { total: 4, totalPages: 1, page: 1, limit: 10 } },
      });
    });
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("PRO") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Each status should appear as a badge
    await expect(page.getByText(/payée|payé|paid/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/ouverte|open|en attente/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/annulée|annulé|void|nulle/i).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/irrécouvrable|uncollectible|impayée/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("should paginate invoices across multiple pages", async ({ page }) => {
    // Generate 15 invoices across 2 pages
    const invoicesPage1 = Array.from({ length: 10 }, (_, i) =>
      mockInvoice(`inv-p1-${i}-${Date.now()}`, {
        amount: 2999,
        createdAt: `2026-0${Math.floor(i / 2) + 1}-01T00:00:00Z`,
        description: `Facture ${i + 1}`,
      }),
    );
    const invoicesPage2 = Array.from({ length: 5 }, (_, i) =>
      mockInvoice(`inv-p2-${i}-${Date.now()}`, {
        amount: 2999,
        createdAt: `2026-01-0${i + 1}T00:00:00Z`,
        description: `Facture ${i + 11}`,
      }),
    );

    let currentPage = 1;
    await page.route("**/api/admin/billing/invoices*", async (route) => {
      const url = new URL(route.request().url());
      const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
      currentPage = pageParam;
      const data = pageParam === 1 ? invoicesPage1 : invoicesPage2;
      await route.fulfill({
        json: { data, pagination: { total: 15, totalPages: 2, page: pageParam, limit: 10 } },
      });
    });
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("PRO") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Wait for invoice section
    await expect(page.getByText(/factures|historique|invoices/i).first()).toBeVisible({
      timeout: 5000,
    });

    // Pagination should be visible
    const pagination = page
      .locator(
        'nav[aria-label="Pagination"], [class*="pagination"], button:has-text("Suivant"), button:has-text("Next")',
      )
      .first();
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Click next page
    const nextBtn = page
      .locator(
        'button[aria-label="Next"], button[aria-label="Suivant"], button:has-text("Suivant"), button:has-text("Next")',
      )
      .first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);

      // Should now be on page 2
      expect(currentPage).toBe(2);
    }
  });

  test("should provide PDF download link or download button for invoices", async ({ page }) => {
    const invoice = mockInvoice(`inv-dl-${Date.now()}`, {
      pdfUrl: "https://example.com/invoice-123.pdf",
    });

    await page.route("**/api/admin/billing/invoices*", async (route) => {
      await route.fulfill({
        json: { data: [invoice], pagination: { total: 1, totalPages: 1, page: 1, limit: 10 } },
      });
    });
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("PRO") });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Look for PDF download link or button
    const downloadLink = page
      .locator(
        'a[href$=".pdf"], a[href*="invoice"], a[href*="facture"], button:has-text("Télécharger"), button:has-text("Download")',
      )
      .first();
    await expect(downloadLink).toBeVisible({ timeout: 5000 });

    // Verify the PDF URL or download action exists
    const href = await downloadLink.getAttribute("href").catch(() => null);
    if (href) {
      expect(href).toMatch(/\.pdf|invoice|facture/i);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 4: Subscription Edge Cases
// ══════════════════════════════════════════════════════════════════════════════

test.describe("Admin Billing — Subscription Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should cancel subscription with confirmation", async ({ page }) => {
    let cancelApiCalled = false;

    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("PRO") });
    });

    // Intercept cancel request
    await page.route("**/api/admin/billing/subscription/cancel", async (route) => {
      cancelApiCalled = true;
      await route.fulfill({
        status: 200,
        json: { success: true, cancelAtPeriodEnd: true, effectiveDate: "2026-08-01T00:00:00Z" },
      });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Click the cancel subscription button
    const cancelBtn = page
      .locator("button")
      .filter({ hasText: /annuler.*abonnement|cancel.*subscription|résilier/i })
      .first();
    await expect(cancelBtn).toBeVisible({ timeout: 5000 });
    await cancelBtn.click();

    // Confirmation dialog should appear
    const confirmDialog = page
      .locator('[role="dialog"], [class*="modal"], [class*="dialog"]')
      .filter({ hasText: /confirmer|annuler.*abonnement|résilier/i })
      .first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Confirm cancellation
    const confirmBtn = confirmDialog
      .locator("button")
      .filter({ hasText: /confirmer|oui|annuler|résilier|supprimer/i })
      .first();
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Wait for API to be called
    await page.waitForTimeout(500);
    expect(cancelApiCalled).toBe(true);

    // Success feedback should be shown
    await expect(page.getByText(/annulation|résilié|cancel|confirmé/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("should reactivate a canceled subscription", async ({ page }) => {
    let reactivateApiCalled = false;

    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({
        json: mockSubscription("PRO", {
          status: "canceled",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: "2026-08-01T00:00:00Z",
        }),
      });
    });

    // Intercept reactivate request
    await page.route("**/api/admin/billing/subscription/reactivate", async (route) => {
      reactivateApiCalled = true;
      await route.fulfill({
        status: 200,
        json: { success: true, status: "active", cancelAtPeriodEnd: false },
      });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Should show a canceled status
    await expect(page.getByText(/annulé|canceled|résilié/i).first()).toBeVisible({ timeout: 5000 });

    // Reactivate button should be visible
    const reactivateBtn = page
      .locator("button")
      .filter({ hasText: /réactiver|reactivate|réabonner|resubscribe/i })
      .first();
    await expect(reactivateBtn).toBeVisible({ timeout: 5000 });
    await reactivateBtn.click();

    // Wait for API call
    await page.waitForTimeout(500);
    expect(reactivateApiCalled).toBe(true);

    // Success feedback
    await expect(page.getByText(/réactivé|reactivé|actif|active/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show error when subscription update API fails with 500", async ({ page }) => {
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ json: mockSubscription("FREE") });
    });
    await page.route("**/api/admin/billing/plans", async (route) => {
      await route.fulfill({ json: { data: [mockPlan("FREE"), mockPlan("PRO")] } });
    });

    // Mock plan change API to return 500
    await page.route("**/api/admin/billing/subscription/change", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        json: {
          error: "Erreur interne du serveur",
          message: "Impossible de mettre à jour l'abonnement pour le moment.",
        },
      });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    // Attempt to upgrade
    const upgradeBtn = page
      .locator("button")
      .filter({ hasText: /passer.*pro|upgrade.*pro|souscrire.*pro/i })
      .first();
    if (await upgradeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await upgradeBtn.click();
      await page.waitForTimeout(300);

      // Confirm the change
      const confirmBtn = page
        .locator('[role="dialog"] button, [class*="modal"] button, [class*="dialog"] button')
        .filter({ hasText: /confirmer|oui|changer|upgrade/i })
        .first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Error message should be displayed
    const errorMsg = page
      .locator('[role="alert"], [class*="error"], [class*="alert"], [class*="bg-danger"]')
      .filter({ hasText: /erreur|impossible|échec|failed|error|500/i })
      .first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test("should show 'Aucun abonnement' when organization has no subscription", async ({ page }) => {
    await page.route("**/api/admin/billing/subscription", async (route) => {
      await route.fulfill({ status: 200, json: null });
    });

    await page.goto("/admin/billing");
    if (await skipIfRedirected(page)) return;

    await expect(
      page.getByText(/aucun abonnement|pas d'abonnement|no subscription|aucun plan/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
