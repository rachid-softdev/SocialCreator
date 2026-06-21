/**
 * Password Reset Page Object Model
 * Covers forgot password flow and new password submission
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class PasswordResetPage extends BasePage {
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly heading: Locator;
  readonly errorAlert: Locator;

  // New password form fields
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[type="email"]').first();
    this.submitButton = page.locator('button[type="submit"]').first();
    this.heading = page.getByRole("heading").first();
    this.errorAlert = page.locator('[role="alert"]').first();
    this.passwordInput = page.locator('input[name="password"], input[id="password"], input[type="password"]').first();
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"], input[id="confirmPassword"], input[type="password"]').nth(1);
  }

  override async goto() {
    await super.goto("/reset-password");
  }

  async gotoWithToken(token: string) {
    await super.goto(`/reset-password?token=${token}`);
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

  async fillConfirmPassword(password: string) {
    if (await this.confirmPasswordInput.isVisible()) {
      await this.confirmPasswordInput.fill(password);
    }
  }

  async submit() {
    if (await this.submitButton.isVisible()) {
      await this.submitButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async isOnResetPage(): Promise<boolean> {
    return this.page.url().includes("/reset-password") || this.page.url().includes("/forgot-password");
  }

  async getSuccessMessage(): Promise<string> {
    const successEl = this.page.getByText(/email sent|check your email|reset link|password.*updated|password.*changed/i).first();
    return (await successEl.textContent()) || "";
  }

  async hasSuccessMessage(): Promise<boolean> {
    return this.page.getByText(/email sent|check your email|reset link|password.*updated|password.*changed/i).first().isVisible().catch(() => false);
  }
}
