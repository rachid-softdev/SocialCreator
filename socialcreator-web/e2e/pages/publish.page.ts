/**
 * Publish Page Object Model
 * Covers publish workflow, scheduling, and history
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class PublishPage extends BasePage {
  readonly heading: Locator;
  readonly historyHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /content/i }).first();
    this.historyHeading = page.getByRole("heading", { name: /publish history/i });
  }

  override async goto() {
    await super.goto("/content");
  }

  async gotoHistory() {
    await super.goto("/content/history");
  }

  async clickPublishOnCard(index = 0) {
    const publishBtns = this.page.getByRole("button", { name: /publish/i });
    const count = await publishBtns.count();
    if (count > index) {
      await publishBtns.nth(index).click();
    }
  }

  async confirmPublication() {
    const confirmBtn = this.page.getByRole("button", { name: /publish now/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
  }

  async cancelPublication() {
    const cancelBtn = this.page.getByRole("button", { name: /cancel/i });
    await cancelBtn.click();
  }

  async waitForPublicationSuccess(timeout = 15000) {
    await expect(this.page.getByRole("heading", { name: /published successfully/i })).toBeVisible({
      timeout,
    });
  }

  async waitForPublicationError(timeout = 15000) {
    await expect(this.page.getByRole("heading", { name: /publication failed/i })).toBeVisible({
      timeout,
    });
  }

  async isHistoryEmpty(): Promise<boolean> {
    const emptyMsg = this.page.getByText(/no publish history/i);
    return emptyMsg.isVisible().catch(() => false);
  }

  async getHistoryEntryCount(): Promise<number> {
    return this.page.locator('[class*="rounded-lg"][class*="border"][class*="bg-canvas"]').count();
  }
}

export class SchedulePublishPage extends BasePage {
  readonly datePicker: Locator;
  readonly scheduleButton: Locator;

  constructor(page: Page) {
    super(page);
    this.datePicker = page.getByRole("button", { name: /schedule/i });
    this.scheduleButton = page.getByRole("button", { name: /schedule publication/i });
  }

  async selectDate(dateString: string) {
    // Click on a specific date in the calendar
    const dateBtn = this.page.getByRole("gridcell", { name: dateString }).first();
    if (await dateBtn.isVisible()) {
      await dateBtn.click();
    }
  }

  async selectTimeSlot(timeLabel: string) {
    const timeBtn = this.page.getByText(timeLabel).first();
    if (await timeBtn.isVisible()) {
      await timeBtn.click();
    }
  }

  async schedule() {
    if (await this.scheduleButton.isVisible()) {
      await this.scheduleButton.click();
    }
  }
}
