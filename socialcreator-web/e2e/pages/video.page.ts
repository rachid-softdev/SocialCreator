/**
 * Video Library Page Object Model
 * Covers the video library at /video — list/grid view, filtering, search, pagination
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class VideoLibraryPage extends BasePage {
  readonly heading: Locator;
  readonly newVideoButton: Locator;
  readonly searchInput: Locator;
  readonly viewToggle: Locator;
  readonly videoGrid: Locator;
  readonly videoCards: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /all videos/i });
    this.newVideoButton = page.getByRole("link", { name: /new video/i });
    this.searchInput = page.locator(
      'input[type="search"], input[placeholder*="search"i], input[placeholder*="find"i]',
    );
    this.viewToggle = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();
    this.videoGrid = page.locator('[class*="grid"]');
    this.videoCards = page.locator('[class*="video-card"], [class*="card"]');
  }

  override async goto() {
    await super.goto("/video");
  }

  async clickNewVideo() {
    await this.newVideoButton.click();
  }

  async search(text: string) {
    if (await this.searchInput.isVisible().catch(() => false)) {
      await this.searchInput.fill(text);
    }
  }

  async clearSearch() {
    if (await this.searchInput.isVisible().catch(() => false)) {
      await this.searchInput.clear();
    }
  }

  async getSearchValue(): Promise<string> {
    if (await this.searchInput.isVisible().catch(() => false)) {
      return this.searchInput.inputValue();
    }
    return "";
  }

  async filterByStatus(status: string) {
    const btn = this.page.locator("button").filter({ hasText: new RegExp(status, "i") });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }
  }

  async getActiveFilter(): Promise<string> {
    const activeBtn = this.page
      .locator("button")
      .filter({ hasText: /all|uploaded|transcribed|segments ready|clips ready|ready|error/i })
      .filter({ has: this.page.locator('[class*="active"], [aria-current="page"]') });
    if (await activeBtn.isVisible().catch(() => false)) {
      return (await activeBtn.textContent()) || "";
    }
    return "";
  }

  async getVideoCount(): Promise<number> {
    return this.videoCards.count();
  }

  async getVideoNames(): Promise<string[]> {
    return this.videoCards.locator("h3, h4, [class*='title']").allTextContents();
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return this.page
      .getByText(/no videos yet|upload a video|no content/i)
      .isVisible()
      .catch(() => false);
  }

  async isLoadingVisible(): Promise<boolean> {
    return this.page
      .locator('[class*="spinner"], [class*="loading"], [class*="skeleton"], [role="progressbar"]')
      .first()
      .isVisible()
      .catch(() => false);
  }

  async isErrorVisible(): Promise<boolean> {
    return this.page
      .locator('[role="alert"], [class*="error-banner"]')
      .first()
      .isVisible()
      .catch(() => false);
  }

  async getErrorMessage(): Promise<string> {
    const errorEl = this.page.locator('[role="alert"], [class*="error-banner"]').first();
    if (await errorEl.isVisible().catch(() => false)) {
      return (await errorEl.textContent()) || "";
    }
    return "";
  }

  async isGridView(): Promise<boolean> {
    const grid = this.videoGrid;
    return grid.isVisible().catch(() => false);
  }

  async clickViewToggle() {
    if (await this.viewToggle.isVisible().catch(() => false)) {
      await this.viewToggle.click();
    }
  }

  async clickVideoCard(index = 0) {
    const cards = this.videoCards;
    const count = await cards.count();
    if (count > index) {
      await cards.nth(index).click();
    }
  }

  async getPaginationInfo(): Promise<string> {
    const pagination = this.page
      .locator("nav[aria-label*='pagination' i], [class*='pagination']")
      .first();
    if (await pagination.isVisible().catch(() => false)) {
      return (await pagination.textContent()) || "";
    }
    return "";
  }

  async clickNextPage() {
    const nextBtn = this.page.locator(
      'button[aria-label*="next" i], a[aria-label*="next" i], button:has-text("Next")',
    );
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
    }
  }

  async clickPreviousPage() {
    const prevBtn = this.page.locator(
      'button[aria-label*="previous" i], a[aria-label*="previous" i], button:has-text("Previous")',
    );
    if (await prevBtn.isVisible().catch(() => false)) {
      await prevBtn.click();
    }
  }

  async hasDeleteButton(): Promise<boolean> {
    return this.page
      .getByRole("button")
      .filter({ hasText: /delete|remove/i })
      .first()
      .isVisible()
      .catch(() => false);
  }

  async clickDeleteFirst() {
    const deleteBtn = this.page
      .getByRole("button")
      .filter({ hasText: /delete|remove/i })
      .first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
    }
  }

  async isConfirmDialogVisible(): Promise<boolean> {
    return this.page
      .getByRole("dialog")
      .isVisible()
      .catch(() => false);
  }
}
