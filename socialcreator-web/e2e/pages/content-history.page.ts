/**
 * Content History Page Object Model
 * Covers /content/history — publish history list with pagination
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ContentHistoryPage extends BasePage {
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  readonly pageIndicator: Locator;
  readonly historyItems: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /publish history/i });
    this.emptyState = page.getByText("No publish history yet");
    this.previousButton = page.getByRole("button", { name: /previous/i });
    this.nextButton = page.getByRole("button", { name: /next/i });
    this.pageIndicator = page.locator("span").filter({ hasText: /page \d+ of \d+/i });
    this.historyItems = page.locator(
      '[class*="rounded-lg"][class*="border"][class*="bg-canvas"]',
    );
  }

  override async goto() {
    await super.goto("/content/history");
  }

  async getHistoryItemCount(): Promise<number> {
    return this.historyItems.count();
  }

  async getPlatformAt(index: number): Promise<string> {
    return this.historyItems
      .nth(index)
      .locator("span.text-body-strong")
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getStatusAt(index: number): Promise<string> {
    return this.historyItems
      .nth(index)
      .locator('[class*="badge"]')
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getDateAt(index: number): Promise<string> {
    return this.historyItems
      .nth(index)
      .locator("p.text-label-xs")
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getErrorTextAt(index: number): Promise<string | null> {
    const errorEl = this.historyItems
      .nth(index)
      .locator("p.text-semantic-error")
      .first();
    if (await errorEl.isVisible().catch(() => false)) {
      return errorEl.textContent().then((t) => (t ?? "").trim());
    }
    return null;
  }

  async clickPrevious(): Promise<void> {
    await this.previousButton.click();
  }

  async clickNext(): Promise<void> {
    await this.nextButton.click();
  }

  async isPreviousDisabled(): Promise<boolean> {
    return this.previousButton.isDisabled().catch(() => true);
  }

  async isNextDisabled(): Promise<boolean> {
    return this.nextButton.isDisabled().catch(() => true);
  }

  async getPageText(): Promise<string> {
    return this.pageIndicator.textContent().then((t) => (t ?? "").trim());
  }
}
