/**
 * Admin Organization Detail Page Object Model
 * Covers org info, subscription details, team info, and overrides
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AdminOrgDetailPage extends BasePage {
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly orgName: Locator;
  readonly orgInfoCard: Locator;
  readonly subscriptionSection: Locator;
  readonly teamSection: Locator;
  readonly overridesSection: Locator;
  readonly errorAlert: Locator;
  readonly loadingSkeleton: Locator;
  readonly orgCreationDate: Locator;
  readonly subscriptionPlanKey: Locator;
  readonly subscriptionStatus: Locator;
  readonly subscriptionPeriodStart: Locator;
  readonly subscriptionPeriodEnd: Locator;
  readonly cancelWarning: Locator;
  readonly teamOwnerInfo: Locator;
  readonly teamMemberCount: Locator;
  readonly overridesCount: Locator;
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /administration/i });
    this.backButton = page.locator('a[href*="/admin/orgs"]').first();
    this.orgName = page.locator("h2").first();
    this.orgInfoCard = page.locator(".rounded-lg.border").first();
    this.subscriptionSection = page.getByText(/Abonnement|Plan|Statut/i).first();
    this.teamSection = page.getByText(/Équipe|Propriétaire/i).first();
    this.overridesSection = page.getByText(/Surcharges|Nombre total/i).first();
    this.errorAlert = page.locator(".rounded-lg.bg-danger\\/10, [class*='bg-danger']").first();
    this.loadingSkeleton = page.locator('[class*="skeleton"]').first();
    this.orgCreationDate = page.getByText("Créée le");
    this.subscriptionPlanKey = page
      .locator(".flex.items-center.justify-between")
      .first()
      .locator(".badge");
    this.subscriptionStatus = page
      .locator(".flex.items-center.justify-between")
      .nth(1)
      .locator(".badge");
    this.subscriptionPeriodStart = page.getByText("Début de période");
    this.subscriptionPeriodEnd = page.getByText("Fin de période");
    this.cancelWarning = page.getByText(/configuré pour être annulé/);
    this.teamOwnerInfo = page.getByText(/Propriétaire/);
    this.teamMemberCount = page.locator(".badge").filter({ hasText: /membre/ });
    this.overridesCount = page.locator(".text-display-sm.font-semibold").last();
    this.breadcrumb = page.getByText("Administration").locator("..");
  }

  override async goto(orgId: string) {
    await super.goto(`/admin/orgs/${orgId}`);
  }

  async waitForOrgDetail() {
    await this.page.waitForLoadState("networkidle");
  }

  async getOrgName(): Promise<string> {
    return (await this.orgName.textContent()) || "";
  }

  async isErrorVisible(): Promise<boolean> {
    return this.errorAlert.isVisible().catch(() => false);
  }

  async isLoading(): Promise<boolean> {
    return this.loadingSkeleton.isVisible().catch(() => false);
  }
}
