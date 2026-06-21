/**
 * Billing Page Object Model
 * Covers pricing table, plan selection, subscription management
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class PricingPage extends BasePage {
  readonly heading: Locator;
  readonly faqSection: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /simple, transparent pricing/i });
    this.faqSection = page.getByText(/frequently asked questions/i);
  }

  override async goto() {
    await super.goto("/pricing");
  }

  async selectPlan(planName: string) {
    // Each plan card has a "Select Plan" or "Current Plan" button
    const planCard = this.page
      .locator("div.grid > div")
      .filter({ hasText: new RegExp(planName, "i") });
    const selectBtn = planCard.getByRole("button", { name: /select plan/i });
    await expect(selectBtn).toBeVisible({ timeout: 5000 });
    await selectBtn.click();
  }

  async getPlanPrice(planName: string): Promise<string> {
    const planCard = this.page
      .locator("div.grid > div")
      .filter({ hasText: new RegExp(planName, "i") });
    const price = planCard.locator("p").filter({ hasText: /\$/ });
    return (await price.textContent()) || "";
  }

  async isPlanCurrent(planName: string): Promise<boolean> {
    const planCard = this.page
      .locator("div.grid > div")
      .filter({ hasText: new RegExp(planName, "i") });
    const currentBtn = planCard.getByRole("button", { name: /current plan/i });
    return currentBtn.isVisible().catch(() => false);
  }

  async toggleFaq(index: number) {
    const details = this.page.locator("details").nth(index);
    await details.locator("summary").click();
  }

  async isFaqAnswerVisible(index: number): Promise<boolean> {
    const details = this.page.locator("details").nth(index);
    return details
      .locator("div")
      .isVisible()
      .catch(() => false);
  }
}

export class BillingSettingsPage extends BasePage {
  readonly heading: Locator;
  readonly managePortalButton: Locator;
  readonly viewPlansLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /billing & subscription/i });
    this.managePortalButton = page.getByRole("button", { name: /manage subscription/i });
    this.viewPlansLink = page.locator('a[href="/pricing"]').filter({ hasText: /view all plans/i });
  }

  override async goto() {
    await super.goto("/settings/billing");
  }

  async clickManagePortal() {
    await this.managePortalButton.click();
  }

  async clickViewPlans() {
    await this.viewPlansLink.click();
  }

  async getCurrentPlanName(): Promise<string> {
    const planEl = this.page
      .locator('[class*="rounded-xl"][class*="border"][class*="bg-surface-card"]')
      .first();
    return (await planEl.locator("h3").first().textContent()) || "";
  }
}
