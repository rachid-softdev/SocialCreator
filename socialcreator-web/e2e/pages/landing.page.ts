/**
 * Landing Page Object Model
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class LandingPage extends BasePage {
  readonly heading: Locator;
  readonly loginLink: Locator;
  readonly registerLink: Locator;
  readonly getStartedBtn: Locator;
  readonly seeHowItWorks: Locator;
  readonly heroDescription: Locator;
  readonly heroSection: Locator;
  readonly featureSection: Locator;
  readonly featureHeadings: Locator;
  readonly navTop: Locator;
  readonly navLinkItems: Locator;
  readonly tryFreeCta: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator("h1").first();
    this.loginLink = page.locator('a[href="/login"]').first();
    this.registerLink = page.locator('a[href="/register"]').first();
    this.getStartedBtn = page.getByRole("link", { name: /get started/i });
    this.seeHowItWorks = page.getByRole("link", { name: /see how it works/i });
    this.heroDescription = page.locator("p").filter({ hasText: /SocialCreator uses AI agents/i });
    this.heroSection = page.locator("section").first();
    this.featureSection = page.locator("#features");
    this.featureHeadings = page.locator("#features h3");
    this.navTop = page.locator("nav").first();
    this.navLinkItems = page.locator("nav a");
    this.tryFreeCta = page.locator("nav").getByRole("link", { name: /try free/i });
  }

  override async goto() {
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

  async clickGetStarted() {
    await this.getStartedBtn.click();
  }

  async clickSeeHowItWorks() {
    await this.seeHowItWorks.click();
  }

  async getFeatureCount(): Promise<number> {
    return await this.featureHeadings.count();
  }

  async getNavLinkCount(): Promise<number> {
    return await this.navLinkItems.count();
  }
}
