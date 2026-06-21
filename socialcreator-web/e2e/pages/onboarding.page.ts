/**
 * Onboarding Page Object Model
 * Covers CGU acceptance, profile creation, and agent configuration
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class CGUPage extends BasePage {
  readonly heading: Locator;
  readonly acceptCheckbox: Locator;
  readonly acceptButton: Locator;
  readonly termsText: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /accept terms/i });
    this.acceptCheckbox = page.locator("#accept-terms");
    this.acceptButton = page.getByRole("button", { name: /accept and continue/i });
    this.termsText = page.locator("pre");
  }

  override async goto() {
    await super.goto("/onboarding/cgu");
  }

  async acceptTerms() {
    await this.acceptCheckbox.check();
    await expect(this.acceptCheckbox).toBeChecked();
  }

  async submit() {
    await this.acceptButton.click();
  }

  async isErrorVisible(): Promise<boolean> {
    return this.page.locator('[role="alert"]').isVisible();
  }
}

export class OnboardingProfilePage extends BasePage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /create your profile/i });
    this.nameInput = page.locator("#name");
    this.submitButton = page.getByRole("button", { name: /continue/i });
  }

  override async goto() {
    await super.goto("/onboarding/profile");
  }

  async fillProfileName(name: string) {
    await this.nameInput.fill(name);
  }

  async selectPlatform(platformName: string) {
    const btn = this.page
      .locator("fieldset")
      .first()
      .getByRole("button")
      .filter({ hasText: platformName });
    await btn.click();
  }

  async submit() {
    await this.submitButton.click();
  }
}

export class OnboardingAgentPage extends BasePage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;
  readonly profileInfo: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /create your agent/i });
    this.nameInput = page.locator("#name");
    this.submitButton = page.getByRole("button", { name: /go to dashboard/i });
    this.profileInfo = page.locator("text=Profile").locator("..");
  }

  override async goto(profileId?: string) {
    const path = profileId ? `/onboarding/agent?profileId=${profileId}` : "/onboarding/agent";
    await super.goto(path);
  }

  async fillAgentName(name: string) {
    await this.nameInput.fill(name);
  }

  async selectPlatform(platformName: string) {
    const btn = this.page
      .locator("fieldset")
      .first()
      .getByRole("button")
      .filter({ hasText: platformName });
    await btn.click();
  }

  async submit() {
    await this.submitButton.click();
  }

  async hasProfileName(expected: string) {
    await expect(this.page.locator("text=Profile").locator("..")).toContainText(expected);
  }
}
