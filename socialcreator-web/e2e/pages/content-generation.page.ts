/**
 * Content Generation Panel Page Object Model
 * Covers /content/generate — generation form, results, and interactions
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ContentGenerationPage extends BasePage {
  readonly heading: Locator;
  readonly profileSelect: Locator;
  readonly platformSelect: Locator;
  readonly briefTextarea: Locator;
  readonly keywordsInput: Locator;
  readonly brandVoiceInput: Locator;
  readonly generateButton: Locator;
  readonly generatingButton: Locator;
  readonly countButtons: Locator;
  readonly resultsHeading: Locator;
  readonly errorAlert: Locator;
  readonly charCounter: Locator;
  readonly validationError: Locator;
  readonly resultsItems: Locator;
  readonly briefLabel: Locator;
  readonly editLinks: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /content generation/i });
    this.profileSelect = page.locator("#gen-profile");
    this.platformSelect = page.locator("#gen-platform");
    this.briefTextarea = page.locator("#gen-brief");
    this.keywordsInput = page.locator("#gen-keywords");
    this.brandVoiceInput = page.locator("#gen-brand-voice");
    this.generateButton = page
      .getByRole("button", { name: /^generate$/i })
      .filter({ hasNotText: /generating/i });
    this.generatingButton = page.getByRole("button", { name: /generating/i });
    this.countButtons = page.locator(
      'div.flex.items-center.gap-3 button[type="button"]',
    );
    this.resultsHeading = page.getByRole("heading", { name: /generated content/i });
    this.errorAlert = page.locator(
      'div.flex.items-start.gap-2.p-3.rounded-lg',
    ).filter({ has: page.locator("svg.lucide-x") });
    this.charCounter = page.locator("span.text-caption").filter({ hasText: /\/2000/ });
    this.validationError = page.getByText(/brief must be at least 10 characters/i);
    this.resultsItems = page.locator(
      '[class*="bg-surface-card"][class*="border"][class*="rounded-xl"]',
    ).filter({ has: page.locator('[class*="platform-badge"]') });
    this.briefLabel = page.locator('label[for="gen-brief"]');
    this.editLinks = page.getByRole("link", { name: /edit/i });
  }

  override async goto() {
    await super.goto("/content/generate");
  }

  async selectProfile(profileValue: string): Promise<void> {
    await this.profileSelect.selectOption(profileValue);
  }

  async selectPlatform(platformValue: string): Promise<void> {
    await this.platformSelect.selectOption(platformValue);
  }

  async fillBrief(text: string): Promise<void> {
    await this.briefTextarea.fill(text);
  }

  async fillKeywords(text: string): Promise<void> {
    await this.keywordsInput.fill(text);
  }

  async fillBrandVoice(text: string): Promise<void> {
    await this.brandVoiceInput.fill(text);
  }

  async clickGenerate(): Promise<void> {
    await this.generateButton.click();
  }

  async clickCount(n: number): Promise<void> {
    await this.countButtons.filter({ hasText: String(n) }).click();
  }

  async waitForGenerationComplete(timeout = 15000): Promise<void> {
    await this.page
      .getByRole("heading", { name: /generated content/i })
      .or(this.errorAlert)
      .waitFor({ state: "visible", timeout });
  }

  async isGenerating(): Promise<boolean> {
    return this.generatingButton.isVisible().catch(() => false);
  }

  async getResultsCount(): Promise<number> {
    return this.resultsItems.count();
  }

  async getErrorMessage(): Promise<string | null> {
    if (await this.errorAlert.isVisible().catch(() => false)) {
      return this.errorAlert.textContent();
    }
    return null;
  }

  async getCharCount(): Promise<string> {
    return this.charCounter.textContent().then((t) => (t ?? "").trim());
  }

  async getBriefValue(): Promise<string> {
    return this.briefTextarea.inputValue();
  }

  async getPlatformValue(): Promise<string> {
    return this.platformSelect.inputValue();
  }

  async fillVeryLongBrief(): Promise<void> {
    await this.briefTextarea.fill("A".repeat(2000));
  }
}
