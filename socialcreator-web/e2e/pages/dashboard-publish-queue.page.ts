/**
 * Dashboard Publish Queue Page Object Model
 * Covers /dashboard/publish-queue — queue monitoring dashboard
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class DashboardPublishQueuePage extends BasePage {
  readonly heading: Locator;
  readonly queueOverview: Locator;
  readonly refreshButton: Locator;
  readonly autoRefreshCheckbox: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;
  readonly errorBanner: Locator;
  readonly jobsTable: Locator;
  readonly jobRows: Locator;
  readonly statCards: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /publish queue/i });
    this.queueOverview = page.getByRole("heading", { name: /queue overview/i });
    this.refreshButton = page.getByRole("button", { name: /refresh/i });
    this.autoRefreshCheckbox = page.getByLabel(/auto-refresh/i);
    this.emptyState = page.getByText("No jobs in the queue.");
    this.loadingSpinner = page.locator(".animate-spin");
    this.errorBanner = page.locator("div.flex.items-center.gap-2.px-4.py-3.rounded-lg.bg-red-50");
    this.jobsTable = page.locator("table");
    this.jobRows = page.locator("table tbody tr");
    this.statCards = page.locator(".grid.grid-cols-2.md\\:grid-cols-4 > div");
  }

  override async goto() {
    await super.goto("/dashboard/publish-queue");
  }

  async getStatCardValue(cardLabel: string): Promise<number> {
    const card = this.statCards.filter({ hasText: cardLabel });
    const valueText = await card.locator("p.text-display-sm").textContent();
    return Number.parseInt((valueText ?? "0").trim(), 10);
  }

  async getJobCount(): Promise<number> {
    return this.jobRows.count();
  }

  async getJobStatusAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(3) span")
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getJobTypeAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(2)")
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getJobPriorityAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(4) span")
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getRetryButtonCount(): Promise<number> {
    return this.page.getByRole("button", { name: /retry/i }).count();
  }

  async clickRetryOnRow(index: number): Promise<void> {
    const retryBtn = this.jobRows.nth(index).getByRole("button", { name: /retry/i });
    if (await retryBtn.isVisible()) {
      await retryBtn.click();
    }
  }

  async clickRefresh(): Promise<void> {
    await this.refreshButton.click();
  }

  async toggleAutoRefresh(): Promise<void> {
    await this.autoRefreshCheckbox.click();
  }

  async isAutoRefreshChecked(): Promise<boolean> {
    return this.autoRefreshCheckbox.isChecked();
  }

  async getErrorBannerText(): Promise<string | null> {
    if (await this.errorBanner.isVisible().catch(() => false)) {
      return this.errorBanner.textContent();
    }
    return null;
  }

  async getRecentErrorsSection(): Promise<Locator> {
    return this.page.getByRole("heading", { name: /recent errors/i });
  }

  async getTotalJobsText(): Promise<string | null> {
    const totalEl = this.page.getByText(/total jobs in queue/i);
    if (await totalEl.isVisible().catch(() => false)) {
      return totalEl.textContent();
    }
    return null;
  }

  async getJobAttemptsAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(5)")
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getJobCreatedAtAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(6)")
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async isRetryButtonVisibleAt(index: number): Promise<boolean> {
    const retryBtn = this.jobRows.nth(index).getByRole("button", { name: /retry/i });
    return retryBtn.isVisible().catch(() => false);
  }

  async isRecentErrorsSectionVisible(): Promise<boolean> {
    return this.page
      .getByRole("heading", { name: /recent errors/i })
      .isVisible()
      .catch(() => false);
  }
}
