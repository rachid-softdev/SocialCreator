/**
 * Admin Page Object Model
 * Covers admin dashboard, user management, org management, and entitlement overrides
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AdminDashboardPage extends BasePage {
  readonly heading: Locator;
  readonly statsSection: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /admin dashboard/i });
    this.statsSection = page
      .getByText(/total users|active orgs|subscriptions/i)
      .first();
  }

  override async goto() {
    await super.goto("/admin");
  }

  async getStatCard(label: string): Promise<string> {
    const statCards = this.page.locator('[class*="stat-card"], [class*="rounded-xl"][class*="shadow-card"]');
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

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /user management/i });
    this.userTable = page.locator("table, [role='table'], [class*='user-list']").first();
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

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /organization management/i });
  }

  override async goto() {
    await super.goto("/admin/orgs");
  }
}

export class AdminEntitlementsPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /entitlement overrides/i });
  }

  override async goto() {
    await super.goto("/admin/entitlements");
  }
}
