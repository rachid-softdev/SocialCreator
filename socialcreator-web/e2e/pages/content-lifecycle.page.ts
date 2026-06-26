/**
 * Content Lifecycle Page Object Model
 * Covers the full content lifecycle progress: onboarding → generation → approval → publish → analytics
 * Provides stage verification, error checks, and progress indicators
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ContentLifecyclePage extends BasePage {
  readonly progressIndicator: Locator;
  readonly stageBadge: Locator;
  readonly errorAlert: Locator;
  readonly successMessage: Locator;
  readonly loadingSkeleton: Locator;

  constructor(page: Page) {
    super(page);
    this.progressIndicator = page
      .locator('[class*="progress"][class*="stepper"]')
      .or(page.locator('[class*="step-indicator"]'));
    this.stageBadge = page
      .locator('[class*="badge"]')
      .filter({ hasText: /setup|generation|publish|analytics|complete/i });
    this.errorAlert = page.locator('[role="alert"], .text-semantic-error, div.error-message');
    this.successMessage = page.getByText(/success|completed|done|published successfully/i);
    this.loadingSkeleton = page.locator(".animate-pulse, [class*='skeleton']");
  }

  /**
   * Returns the text content of the current progress stage badge
   */
  async getCurrentStage(): Promise<string> {
    const activeBadge = this.page
      .locator('[class*="badge"][class*="active"], [class*="step"][class*="active"]')
      .first();
    if (await activeBadge.isVisible().catch(() => false)) {
      return (await activeBadge.textContent())?.trim() ?? "";
    }
    return "";
  }

  /**
   * Wait for a specific lifecycle stage to become active
   */
  async waitForStage(stage: string, timeout = 10000): Promise<void> {
    const stageEl = this.page
      .locator(`[class*="badge"], [class*="step"]`)
      .filter({ hasText: new RegExp(stage, "i") });
    await stageEl.waitFor({ state: "visible", timeout });
  }

  /**
   * Wait for a success message to appear
   */
  async waitForSuccess(timeout = 10000): Promise<void> {
    await this.successMessage.first().waitFor({ state: "visible", timeout });
  }

  /**
   * Check if an error alert is visible
   */
  async hasError(): Promise<boolean> {
    return this.errorAlert
      .first()
      .isVisible()
      .catch(() => false);
  }

  /**
   * Get error message text if visible
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.hasError()) {
      return (await this.errorAlert.first().textContent())?.trim() ?? null;
    }
    return null;
  }

  /**
   * Wait for loading skeleton to appear then disappear
   */
  async waitForLoadingComplete(timeout = 15000): Promise<void> {
    if (await this.loadingSkeleton.isVisible().catch(() => false)) {
      await this.loadingSkeleton.first().waitFor({ state: "hidden", timeout });
    }
  }
}
