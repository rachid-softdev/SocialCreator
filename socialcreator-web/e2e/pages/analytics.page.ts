/**
 * Analytics Page Object Model
 * Covers analytics dashboard with date range and profile selection, metrics, and charts
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AnalyticsPage extends BasePage {
  readonly heading: Locator;
  readonly dateRangeSelector: Locator;
  readonly profileSelector: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /analytics/i });
    this.dateRangeSelector = page.locator("#date-range, [data-testid='date-range']").first();
    this.profileSelector = page.locator("#profile-select, [data-testid='profile-select']").first();
  }

  override async goto() {
    await super.goto("/analytics");
  }

  async selectProfile(profileId: string) {
    await this.profileSelector.selectOption(profileId);
  }

  async selectDateRange(label: string) {
    const btn = this.page.getByRole("button").filter({ hasText: label });
    if (await btn.isVisible()) {
      await btn.click();
    }
  }

  async getTotalPosts(): Promise<string> {
    const statCards = this.page.locator('[class*="rounded-xl"][class*="p-4"]');
    const count = await statCards.count();
    for (let i = 0; i < count; i++) {
      const card = statCards.nth(i);
      const cardText = await card.textContent();
      if (cardText?.toLowerCase().includes("posts")) {
        const value = await card.locator("p, span").first().textContent();
        return value || "";
      }
    }
    return "";
  }

  async getEngagementRate(): Promise<string> {
    const statCards = this.page.locator('[class*="rounded-xl"][class*="p-4"]');
    const count = await statCards.count();
    for (let i = 0; i < count; i++) {
      const card = statCards.nth(i);
      const cardText = await card.textContent();
      if (cardText?.toLowerCase().includes("engagement")) {
        const value = await card.locator("p, span").first().textContent();
        return value || "";
      }
    }
    return "";
  }

  async getPlatformBreakdown(): Promise<Record<string, string>> {
    const breakdown: Record<string, string> = {};
    const items = this.page.locator("[class*='platform-item'], [class*='platform-breakdown'] > div");
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const text = await item.textContent();
      if (text) {
        const parts = text.trim().split(/\s+/);
        if (parts.length >= 2) {
          const platform = parts[0];
          const value = parts[parts.length - 1];
          breakdown[platform] = value;
        }
      }
    }
    return breakdown;
  }

  async isChartVisible(): Promise<boolean> {
    return this.page
      .locator("canvas, [data-testid='chart'], svg.recharts-surface")
      .first()
      .isVisible()
      .catch(() => false);
  }
}
