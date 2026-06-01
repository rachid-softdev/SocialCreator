/**
 * Base Page Object Model
 * Common utilities for all page objects
 */

import { expect, type Page } from "@playwright/test";

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
  }

  async waitForHeading(text?: RegExp | string, timeout = 10000) {
    const locator = this.page.locator("h1").first();
    if (text) {
      await expect(locator).toContainText(text, { timeout });
    } else {
      await expect(locator).toBeVisible({ timeout });
    }
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async waitForUrl(pattern: RegExp, timeout = 10000) {
    await this.page.waitForURL(pattern, { timeout });
  }
}
