/**
 * Landing Page Object Model
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class LandingPage extends BasePage {
  readonly heading: Locator;
  readonly loginLink: Locator;
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator("h1").first();
    this.loginLink = page.locator('a[href="/login"]').first();
    this.registerLink = page.locator('a[href="/register"]').first();
  }

  async goto() {
    await super.goto("/");
  }

  async clickLogin() {
    if (await this.loginLink.isVisible()) {
      await this.loginLink.click();
    }
  }

  async clickRegister() {
    if (await this.registerLink.isVisible()) {
      await this.registerLink.click();
    }
  }
}
