/**
 * Profile Page Object Model
 * Covers profile creation, brand voice config, settings modification, deletion, and active profile switching
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ProfilesListPage extends BasePage {
  readonly heading: Locator;
  readonly newProfileButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /profiles/i }).first();
    this.newProfileButton = page
      .locator('a[href="/profiles/new"]')
      .filter({ hasText: /new profile/i });
    this.emptyState = page.getByText(/no profiles yet/i);
  }

  override async goto() {
    await super.goto("/profiles");
  }

  async clickNewProfile() {
    await this.newProfileButton.click();
  }

  async getProfileCard(name: string): Promise<Locator> {
    return this.page.locator(`[class*="profile-card"]`).filter({ hasText: name }).first();
  }

  async openProfile(name: string) {
    const card = await this.getProfileCard(name);
    await card.locator("a").first().click();
  }

  async getProfileCount(): Promise<number> {
    return this.page.locator('[class*="profile-card"]').count();
  }

  async isProfileVisible(name: string): Promise<boolean> {
    const card = await this.getProfileCard(name);
    return card.isVisible().catch(() => false);
  }
}

export class NewProfilePage extends BasePage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly brandVoiceTextarea: Locator;
  readonly contentBankTextarea: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /create profile/i });
    this.nameInput = page.locator("#name");
    this.brandVoiceTextarea = page.locator("#brand-voice");
    this.contentBankTextarea = page.locator("textarea").nth(1);
    this.submitButton = page.locator('button[type="submit"]');
  }

  override async goto() {
    await super.goto("/profiles/new");
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillBrandVoice(text: string) {
    await this.brandVoiceTextarea.fill(text);
  }

  async fillContentBank(text: string) {
    await this.contentBankTextarea.fill(text);
  }

  async selectPlatform(platformLabel: string) {
    const btn = this.page
      .locator("fieldset")
      .last()
      .getByRole("button")
      .filter({ hasText: platformLabel });
    if (await btn.isVisible()) {
      await btn.click();
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async isErrorVisible(): Promise<boolean> {
    return this.page
      .locator('[role="alert"]')
      .isVisible()
      .catch(() => false);
  }

  async getValidationError(): Promise<string> {
    const errorEl = this.page.locator("p.text-semantic-error").first();
    return (await errorEl.textContent()) || "";
  }
}

export class ProfileDetailPage extends BasePage {
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly brandVoiceSection: Locator;
  readonly statusBadge: Locator;

  constructor(page: Page) {
    super(page);
    this.editButton = page.locator('a[href*="/edit"]').filter({ hasText: /edit/i });
    this.deleteButton = page.getByRole("button", { name: /delete profile/i });
    this.brandVoiceSection = page
      .getByText(/brand voice/i)
      .locator("..")
      .locator("p")
      .last();
    this.statusBadge = page
      .locator('[class*="rounded-pill"]')
      .filter({ hasText: /active|inactive/i });
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}`);
  }

  async clickEdit() {
    await this.editButton.click();
  }

  async getProfileName(): Promise<string> {
    const h1 = this.page.locator("h1").first();
    return (await h1.textContent()) || "";
  }

  async isBrandVoiceVisible(): Promise<boolean> {
    return this.page
      .getByText(/brand voice/i)
      .isVisible()
      .catch(() => false);
  }

  async getBrandVoiceText(): Promise<string> {
    if (await this.isBrandVoiceVisible()) {
      return (await this.brandVoiceSection.textContent()) || "";
    }
    return "";
  }

  async getStatus(): Promise<string> {
    return (await this.statusBadge.textContent()) || "";
  }
}

export class EditProfilePage extends BasePage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly brandVoiceTextarea: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /edit profile/i });
    this.nameInput = page.locator("#name");
    this.brandVoiceTextarea = page.locator("#brand-voice");
    this.saveButton = page.locator('button[type="submit"]');
    this.deleteButton = page.getByRole("button", { name: /delete profile/i });
    this.confirmDeleteButton = page
      .getByRole("button", { name: /delete/i })
      .filter({ hasText: /^delete$/i });
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}/edit`);
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillBrandVoice(text: string) {
    await this.brandVoiceTextarea.fill(text);
  }

  async save() {
    await this.saveButton.click();
  }

  async clickDelete() {
    await this.deleteButton.click();
  }

  async confirmDelete() {
    // Wait for confirm dialog to appear
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    const confirmBtn = dialog.getByRole("button", { name: /delete/i });
    await confirmBtn.click();
  }
}
