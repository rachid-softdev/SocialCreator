/**
 * Dashboard Page Object Model
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class DashboardPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator("h1").first();
  }

  override async goto() {
    await super.goto("/dashboard");
  }

  async isVisible(timeout = 10000): Promise<boolean> {
    try {
      await this.heading.waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  }
}
