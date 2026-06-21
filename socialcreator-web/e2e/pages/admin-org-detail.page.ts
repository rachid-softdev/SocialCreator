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

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /administration/i });
    this.backButton = page
      .locator('a[href*="/admin/orgs"] button, button:has-text("Retour")')
      .first();
    this.orgName = page.locator("h2").first();
    this.orgInfoCard = page.locator(".rounded-lg.border").first();
    this.subscriptionSection = page.getByText(/Abonnement|Plan|Statut/i).first();
    this.teamSection = page.getByText(/Équipe|Propriétaire/i).first();
    this.overridesSection = page.getByText(/Surcharges|Nombre total/i).first();
    this.errorAlert = page.locator(".rounded-lg.bg-danger\\/10, [class*='bg-danger']").first();
    this.loadingSkeleton = page.locator('[class*="skeleton"]').first();
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
