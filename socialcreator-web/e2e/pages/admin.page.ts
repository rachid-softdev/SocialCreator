/**
 * Admin Page Object Model
 * Covers admin dashboard, user management, org management, and entitlement overrides
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AdminDashboardPage extends BasePage {
  readonly heading: Locator;
  readonly statsSection: Locator;
  readonly statCards: Locator;
  readonly statCardLabels: Locator;
  readonly loadingSpinner: Locator;
  readonly errorAlert: Locator;
  readonly breadcrumb: Locator;
  readonly pageHeader: Locator;
  readonly trendCharts: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /admin dashboard/i });
    this.statsSection = page.getByText(/total users|active orgs|subscriptions/i).first();
    this.statCards = page.locator(".rounded-lg.border.border-hairline.bg-surface-card.p-5");
    this.statCardLabels = page.locator(".text-caption.text-muted");
    this.loadingSpinner = page.locator('svg.lucide-loader2, svg[class*="animate-spin"]');
    this.errorAlert = page.locator(".rounded-lg.bg-danger\\/10");
    this.breadcrumb = page.getByText("Administration");
    this.pageHeader = page.locator("h1");
    this.trendCharts = page.locator(".recharts-responsive-container");
  }

  override async goto() {
    await super.goto("/admin");
  }

  async getStatCard(label: string): Promise<string> {
    const statCards = this.page.locator(
      '[class*="stat-card"], [class*="rounded-xl"][class*="shadow-card"]',
    );
    const count = await statCards.count();
    for (let i = 0; i < count; i++) {
      const card = statCards.nth(i);
      const cardText = await card.textContent();
      if (cardText?.includes(label)) {
        const value = await card.locator("p").first().textContent();
        return value || "";
      }
    }
    return "";
  }

  async getUserCount(): Promise<string> {
    return this.getStatCard("Total Users");
  }

  async getOrgCount(): Promise<string> {
    return this.getStatCard("Active Organizations");
  }
}

export class AdminUsersPage extends BasePage {
  readonly heading: Locator;
  readonly userTable: Locator;
  readonly searchInput: Locator;
  readonly userRows: Locator;
  readonly editRoleButtons: Locator;
  readonly deleteButtons: Locator;
  readonly pagination: Locator;
  readonly editDialog: Locator;
  readonly editDialogTitle: Locator;
  readonly editRoleSelect: Locator;
  readonly editDialogConfirmButton: Locator;
  readonly editDialogCancelButton: Locator;
  readonly deleteDialog: Locator;
  readonly errorAlert: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;
  readonly adminBadges: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /user management/i });
    this.userTable = page.locator("table, [role='table'], [class*='user-list']").first();
    this.searchInput = page.locator('input[placeholder*="Rechercher"]');
    this.userRows = page.locator("table tbody tr");
    this.editRoleButtons = page.locator('button[title="Modifier le rôle"]');
    this.deleteButtons = page.locator('button[title="Supprimer"]');
    this.pagination = page.locator('nav[aria-label="Pagination"]');
    this.editDialog = page.locator('div[role="dialog"]', { hasText: "Modifier le rôle" });
    this.editDialogTitle = page.getByText("Modifier le rôle");
    this.editRoleSelect = page.locator("select");
    this.editDialogConfirmButton = page
      .locator('div[role="dialog"] button')
      .filter({ hasText: "Enregistrer" });
    this.editDialogCancelButton = page
      .locator('div[role="dialog"] button')
      .filter({ hasText: "Annuler" });
    this.deleteDialog = page.locator('div[role="dialog"]', { hasText: "Supprimer l'utilisateur" });
    this.errorAlert = page.locator(".bg-danger\\/10");
    this.loadingSpinner = page.locator("svg.lucide-loader2");
    this.emptyState = page.getByText("Aucun utilisateur trouvé");
    this.adminBadges = page.locator(".bg-purple-500\\/10");
  }

  override async goto() {
    await super.goto("/admin/users");
  }

  async getUserRowCount(): Promise<number> {
    const rows = this.page.locator("table tbody tr, [role='row']");
    return rows.count();
  }
}

export class AdminOrgsPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly orgLinks: Locator;
  readonly statusBadges: Locator;
  readonly planBadges: Locator;
  readonly overridesCells: Locator;
  readonly pagination: Locator;
  readonly errorAlert: Locator;
  readonly loadingSkeleton: Locator;
  readonly emptyState: Locator;
  readonly cancelAtPeriodEndBadges: Locator;
  readonly noSubscriptionLabels: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /organization management/i });
    this.searchInput = page.locator('input[placeholder*="Rechercher"]');
    this.orgLinks = page.locator('a[href*="/admin/orgs/"]');
    this.statusBadges = page.locator("table tbody tr td:nth-child(3) span");
    this.planBadges = page.locator("table tbody tr td:nth-child(2) span");
    this.overridesCells = page.locator("table tbody tr td:nth-child(4)");
    this.pagination = page.locator('nav[aria-label="Pagination"]');
    this.errorAlert = page.locator(".bg-danger\\/10");
    this.loadingSkeleton = page.locator('[class*="skeleton"]');
    this.emptyState = page.getByText("Aucune organisation trouvée");
    this.cancelAtPeriodEndBadges = page.getByText("annulation en cours");
    this.noSubscriptionLabels = page.getByText("Aucun abonnement");
  }

  override async goto() {
    await super.goto("/admin/orgs");
  }
}

export class AdminEntitlementsPage extends BasePage {
  readonly heading: Locator;
  readonly tabs: Locator;
  readonly overridesTable: Locator;
  readonly plansTable: Locator;
  readonly featuresTable: Locator;
  readonly createOverrideButton: Locator;
  readonly createDialog: Locator;
  readonly createDialogScope: Locator;
  readonly createDialogScopeId: Locator;
  readonly createDialogFeatureKey: Locator;
  readonly createDialogEnabled: Locator;
  readonly createDialogReason: Locator;
  readonly createDialogSubmit: Locator;
  readonly createDialogCancel: Locator;
  readonly createDialogError: Locator;
  readonly deleteDialog: Locator;
  readonly errorAlert: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyStateOverrides: Locator;
  readonly emptyStatePlans: Locator;
  readonly emptyStateFeatures: Locator;
  readonly isActiveBadges: Locator;
  readonly deleteOverrideButtons: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /entitlement overrides/i });
    this.tabs = page.locator('button[type="button"]', { hasText: /Overrides|Plans|Features/ });
    this.overridesTable = page.locator("table").first();
    this.plansTable = page.locator("table").first();
    this.featuresTable = page.locator("table").first();
    this.createOverrideButton = page.locator("button", { hasText: "Nouvel override" });
    this.createDialog = page.locator('div[role="dialog"]', { hasText: "Nouvel override" });
    this.createDialogScope = page.locator("select#override-scope");
    this.createDialogScopeId = page.locator("input#override-scope-id");
    this.createDialogFeatureKey = page.locator("input#override-feature-key");
    this.createDialogEnabled = page.locator("select#override-enabled");
    this.createDialogReason = page.locator("input#override-reason");
    this.createDialogSubmit = page
      .locator('div[role="dialog"] button')
      .filter({ hasText: "Créer" });
    this.createDialogCancel = page
      .locator('div[role="dialog"] button')
      .filter({ hasText: "Annuler" });
    this.createDialogError = page.locator('div[role="dialog"] .bg-red-500\\/10');
    this.deleteDialog = page.locator('div[role="dialog"]', { hasText: "Supprimer l'override" });
    this.errorAlert = page.locator(".bg-danger\\/10");
    this.loadingSpinner = page.locator("svg.lucide-loader2");
    this.emptyStateOverrides = page.getByText("Aucun override");
    this.emptyStatePlans = page.getByText("Aucun plan trouvé");
    this.emptyStateFeatures = page.getByText("Aucune feature trouvée");
    this.isActiveBadges = page.locator("table tbody tr td:nth-child(4) span");
    this.deleteOverrideButtons = page.locator('button[title="Supprimer"]');
  }

  override async goto() {
    await super.goto("/admin/entitlements");
  }
}
