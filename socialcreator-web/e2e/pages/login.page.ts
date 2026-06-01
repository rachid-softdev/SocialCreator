/**
 * Login Page Object Model
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[type="email"]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"]').first();
  }

  async goto() {
    await super.goto("/login");
  }

  async fillEmail(email: string) {
    if (await this.emailInput.isVisible()) {
      await this.emailInput.fill(email);
    }
  }

  async fillPassword(password: string) {
    if (await this.passwordInput.isVisible()) {
      await this.passwordInput.fill(password);
    }
  }

  async submit() {
    if (await this.submitButton.isVisible()) {
      await this.submitButton.click();
    }
  }

  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }
}
