/**
 * Settings Page Object Model
 * Covers settings navigation and API keys management
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class SettingsPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /settings/i });
  }

  override async goto() {
    await super.goto("/settings");
  }

  async navigateTo(subpage: string) {
    const link = this.page.locator(`a[href*="/settings/${subpage}"]`).first();
    if (await link.isVisible()) {
      await link.click();
    }
  }
}

export class ApiKeysPage extends BasePage {
  readonly heading: Locator;
  readonly createKeyButton: Locator;
  readonly keyList: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /api keys/i });
    this.createKeyButton = page.getByRole("button", { name: /create key|new key|generate key/i });
    this.keyList = page.locator("table, [role='list'], [class*='key-list']").first();
  }

  override async goto() {
    await super.goto("/settings/api-keys");
  }

  async createKey(name: string): Promise<string> {
    await this.createKeyButton.click();

    // Fill name in the modal / form that appears
    const nameInput = this.page.locator("#key-name, [data-testid='key-name']").first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(name);
    }

    const submitBtn = this.page.getByRole("button", { name: /create|generate|confirm/i }).last();
    await submitBtn.click();

    // Return the key value from the success dialog
    const keyDisplay = this.page.locator("[class*='key-display'], code").first();
    if (await keyDisplay.isVisible().catch(() => false)) {
      return (await keyDisplay.textContent()) || "";
    }
    return "";
  }

  async deleteKey(name: string) {
    const row = this.page.locator("tr, [role='listitem']").filter({ hasText: name }).first();
    const deleteBtn = row.getByRole("button", { name: /delete|revoke|remove/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();

      // Confirm deletion dialog
      const confirmBtn = this.page.getByRole("button", { name: /confirm|delete|yes/i }).last();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
    }
  }

  async getKeyCount(): Promise<number> {
    return this.page.locator("tr, [role='listitem'], [class*='key-item']").count();
  }

  async isKeyVisible(name: string): Promise<boolean> {
    return this.page
      .getByText(name)
      .isVisible()
      .catch(() => false);
  }

  async hasMCPTester(): Promise<boolean> {
    return this.page
      .getByText(/mcp tester|mcp test|mcp-tester/i)
      .isVisible()
      .catch(() => false);
  }
}
