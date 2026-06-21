/**
 * Content Page Object Model
 * Covers content list, generation, and editing
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ContentPage extends BasePage {
  readonly heading: Locator;
  readonly generateLink: Locator;
  readonly historyLink: Locator;
  readonly calendarLink: Locator;
  readonly queueLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /content/i }).first();
    this.generateLink = page.locator('a[href="/content/generate"]');
    this.historyLink = page.locator('a[href="/content/history"]');
    this.calendarLink = page.locator('a[href="/content/calendar"]');
    this.queueLink = page.locator('a[href="/content/queue"]');
  }

  override async goto() {
    await super.goto("/content");
  }

  async clickGenerate() {
    await this.generateLink.click();
  }

  async clickHistory() {
    await this.historyLink.click();
  }

  async filterByStatus(status: string) {
    const statusBtn = this.page
      .getByRole("button")
      .filter({ hasText: new RegExp(`^${status}$`, "i") });
    if (await statusBtn.isVisible()) {
      await statusBtn.click();
    }
  }

  async getContentCardCount(): Promise<number> {
    return this.page.locator('[class*="content-card"]').count();
  }
}

export class GenerationPanelPage extends BasePage {
  readonly heading: Locator;
  readonly profileSelect: Locator;
  readonly platformSelect: Locator;
  readonly briefTextarea: Locator;
  readonly keywordsInput: Locator;
  readonly brandVoiceInput: Locator;
  readonly generateButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /content generation/i });
    this.profileSelect = page.locator("#gen-profile");
    this.platformSelect = page.locator("#gen-platform");
    this.briefTextarea = page.locator("#gen-brief");
    this.keywordsInput = page.locator("#gen-keywords");
    this.brandVoiceInput = page.locator("#gen-brand-voice");
    this.generateButton = page
      .getByRole("button", { name: /generate/i })
      .filter({ hasNotText: /generating/i });
  }

  override async goto() {
    await super.goto("/content/generate");
  }

  async selectProfile(profileId: string) {
    await this.profileSelect.selectOption(profileId);
  }

  async selectPlatform(platformValue: string) {
    await this.platformSelect.selectOption(platformValue);
  }

  async fillBrief(text: string) {
    await this.briefTextarea.fill(text);
  }

  async fillKeywords(text: string) {
    await this.keywordsInput.fill(text);
  }

  async fillBrandVoice(text: string) {
    await this.brandVoiceInput.fill(text);
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async isGenerating(): Promise<boolean> {
    const btn = this.page.getByRole("button", { name: /generating/i });
    return btn.isVisible().catch(() => false);
  }

  async waitForGenerationComplete(timeout = 15000) {
    // Wait for results heading to appear, or error
    await expect(
      this.page
        .getByRole("heading", { name: /generated content/i })
        .or(this.page.locator('[role="alert"]')),
    ).toBeVisible({ timeout });
  }
}

export class ContentDetailPage extends BasePage {
  readonly editButton: Locator;
  readonly saveDraftButton: Locator;

  constructor(page: Page) {
    super(page);
    this.editButton = page.getByRole("link", { name: /edit/i }).first();
    this.saveDraftButton = page.getByRole("button", { name: /save draft/i });
  }

  override async goto(contentId: string) {
    await super.goto(`/content/${contentId}`);
  }

  async clickEdit() {
    await this.editButton.click();
  }

  async editText(newText: string) {
    const textarea = this.page.locator("textarea").first();
    await textarea.fill(newText);
  }

  async saveDraft() {
    await this.saveDraftButton.click();
  }
}
