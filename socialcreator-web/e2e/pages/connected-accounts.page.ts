/**
 * Connected Accounts Page Object Model
 * Covers OAuth connection/disconnection for third-party platforms
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ConnectedAccountsPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /connected accounts/i });
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}/accounts`);
  }

  async connectAccount(platform: string): Promise<boolean> {
    const connectBtn = this.page
      .getByRole("button")
      .filter({ hasText: new RegExp(`connect.*${platform}|${platform}.*connect`, "i") });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
      return true;
    }
    return false;
  }

  async disconnectAccount(platform: string) {
    const disconnectBtn = this.page
      .getByRole("button")
      .filter({ hasText: new RegExp(`disconnect.*${platform}|${platform}.*disconnect`, "i") });
    if (await disconnectBtn.isVisible()) {
      await disconnectBtn.click();

      // Confirm disconnection dialog
      const confirmBtn = this.page.getByRole("button", { name: /disconnect|confirm|yes/i }).last();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
    }
  }

  async getConnectedPlatforms(): Promise<string[]> {
    const platforms: string[] = [];
    const items = this.page.locator(
      "[class*='platform-card'], [class*='account-item'], [role='listitem']",
    );
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).textContent();
      if (text) {
        platforms.push(text.trim());
      }
    }
    return platforms;
  }

  async isPlatformConnected(platform: string): Promise<boolean> {
    return this.page
      .getByText(new RegExp(`${platform}.*connected|connected.*${platform}`, "i"))
      .isVisible()
      .catch(() => false);
  }

  async isOAuthButtonVisible(platform: string): Promise<boolean> {
    return this.page
      .getByRole("button")
      .filter({
        hasText: new RegExp(`sign in with ${platform}|connect ${platform}|${platform} login`, "i"),
      })
      .first()
      .isVisible()
      .catch(() => false);
  }
}
