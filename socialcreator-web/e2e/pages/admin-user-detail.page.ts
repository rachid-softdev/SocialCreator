/**
 * Admin User Detail Page Object Model
 * Covers user profile details, usage stats, profiles, and teams
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AdminUserDetailPage extends BasePage {
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly userInfoCard: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;
  readonly userRole: Locator;
  readonly statsSection: Locator;
  readonly profilesSection: Locator;
  readonly teamsSection: Locator;
  readonly errorAlert: Locator;
  readonly loadingSkeleton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /administration/i });
    this.backButton = page.locator('a[href*="/admin/users"] button, button:has-text("Retour")').first();
    this.userInfoCard = page.locator(".rounded-lg.border").first();
    this.userName = page.locator("h2").first();
    this.userEmail = page.locator("text=@" ).first();
    this.userRole = page.locator("text=USER, text=ADMIN").first();
    this.statsSection = page.getByText(/Statistiques d'utilisation|Contenu généré|Publications/i);
    this.profilesSection = page.getByText(/Profils|Aucun profil/i).first();
    this.teamsSection = page.getByText(/Équipes|Aucune équipe/i).first();
    this.errorAlert = page.locator(".rounded-lg.bg-danger\\/10, [class*='bg-danger']").first();
    this.loadingSkeleton = page.locator('[class*="skeleton"]').first();
  }

  async goto(userId: string) {
    await super.goto(`/admin/users/${userId}`);
  }

  async waitForUserDetail() {
    await this.page.waitForLoadState("networkidle");
  }

  async getUserName(): Promise<string> {
    return (await this.userName.textContent()) || "";
  }

  async getUserEmail(): Promise<string> {
    return (await this.userEmail.textContent()) || "";
  }

  async isErrorVisible(): Promise<boolean> {
    return this.errorAlert.isVisible().catch(() => false);
  }

  async getErrorText(): Promise<string> {
    return (await this.errorAlert.textContent()) || "";
  }

  async isLoading(): Promise<boolean> {
    return this.loadingSkeleton.isVisible().catch(() => false);
  }
}
