/**
 * Agent Page Object Model
 * Covers agent creation, configuration, runs, results viewing, and pause/activation
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AllAgentsPage extends BasePage {
  readonly heading: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /all agents/i });
    this.emptyState = page.getByText(/no agents yet/i);
  }

  override async goto() {
    await super.goto("/agents");
  }

  async getAgentCard(name: string): Promise<Locator> {
    return this.page.locator(`h3:has-text("${name}")`).locator("..").locator("..");
  }

  async openAgent(name: string) {
    const card = await this.getAgentCard(name);
    const link = card.locator("a").first();
    if (await link.isVisible()) {
      await link.click();
    }
  }

  async isAgentVisible(name: string): Promise<boolean> {
    return this.page
      .locator(`h3:has-text("${name}")`)
      .isVisible()
      .catch(() => false);
  }

  async getAgentCount(): Promise<number> {
    return this.page.locator('[class*="rounded-xl"][class*="shadow-card"]').count();
  }

  async filterByProfile(profileName: string) {
    const filterBtn = this.page.getByRole("button").filter({ hasText: profileName });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
    }
  }
}

export class AgentsListPage extends BasePage {
  readonly heading: Locator;
  readonly newAgentButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /ai agents/i });
    this.newAgentButton = page.locator('a[href*="/agents/new"]').filter({ hasText: /new agent/i });
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}/agents`);
  }

  async clickNewAgent() {
    await this.newAgentButton.click();
  }

  async getAgentCount(): Promise<number> {
    return this.page.locator('[class*="rounded-xl"][class*="shadow-card"]').count();
  }

  async openAgent(agentId: string) {
    const link = this.page.locator(`a[href*="/agents/${agentId}"]`).first();
    if (await link.isVisible()) {
      await link.click();
    }
  }
}

export class NewAgentPage extends BasePage {
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /create agent/i });
    this.nameInput = page.locator("#name");
    this.submitButton = page.locator('button[type="submit"]');
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}/agents/new`);
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async selectAgentType(typeLabel: string) {
    const btn = this.page.getByRole("button").filter({ hasText: typeLabel });
    if (await btn.isVisible()) {
      await btn.click();
    }
  }

  async selectPlatform(platformLabel: string) {
    const btn = this.page.getByRole("button").filter({ hasText: platformLabel });
    if (await btn.isVisible()) {
      await btn.click();
    }
  }

  async toggleAutoPublish() {
    const toggle = this.page.locator('[role="switch"], input[type="checkbox"]').last();
    if (await toggle.isVisible()) {
      await toggle.click();
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async getError(): Promise<string> {
    const errorEl = this.page.locator('[role="alert"], .text-semantic-error').first();
    if (await errorEl.isVisible().catch(() => false)) {
      return (await errorEl.textContent()) || "";
    }
    return "";
  }
}

export class AgentDetailPage extends BasePage {
  readonly overviewTab: Locator;
  readonly runsTab: Locator;
  readonly contentTab: Locator;
  readonly runButton: Locator;

  constructor(page: Page) {
    super(page);
    this.overviewTab = page.getByRole("button", { name: /overview/i });
    this.runsTab = page.getByRole("button", { name: /runs/i });
    this.contentTab = page.getByRole("button", { name: /content/i });
    this.runButton = page.getByRole("button", { name: /run agent/i });
  }

  // NOTE: not using override because signature differs from BasePage.goto(path: string)
  async gotoAgent(profileId: string, agentId: string) {
    await super.goto(`/profiles/${profileId}/agents/${agentId}`);
  }

  async clickOverview() {
    await this.overviewTab.click();
  }

  async clickRuns() {
    await this.runsTab.click();
  }

  async clickContent() {
    await this.contentTab.click();
  }

  async clickRunAgent() {
    await this.runButton.click();
  }

  async toggleActive() {
    // Toggle is the first button before "Run Agent"
    const toggleBtn = this.page.locator("div.flex.items-center.gap-3 > button").first();
    await toggleBtn.click();
  }

  async getAgentName(): Promise<string> {
    const h1 = this.page.locator("h1").first();
    return (await h1.textContent()) || "";
  }

  async getStatusText(): Promise<string> {
    const badge = this.page
      .locator('[class*="rounded-full"]')
      .filter({ hasText: /active|paused/i })
      .first();
    return (await badge.textContent()) || "";
  }

  async isRunButtonDisabled(): Promise<boolean> {
    return this.runButton.isDisabled();
  }

  async getConfigurationValue(label: string): Promise<string> {
    const dt = this.page.getByText(label);
    const dd = dt.locator("..").locator("dd");
    return (await dd.textContent()) || "";
  }

  async getStatValue(label: string): Promise<string> {
    const statCards = this.page.locator('[class*="p-4"][class*="bg-surface-strong"]');
    const count = await statCards.count();
    for (let i = 0; i < count; i++) {
      const card = statCards.nth(i);
      const cardText = await card.textContent();
      if (cardText?.includes(label)) {
        const value = await card.locator("p").first().textContent();
        return value || "";
      }
    }
    return "";
  }

  async getTotalRuns(): Promise<string> {
    return this.getStatValue("Total Runs");
  }

  async getSuccessRate(): Promise<string> {
    return this.getStatValue("Success Rate");
  }
}

export class AgentRunModalPage extends BasePage {
  readonly briefTextarea: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.briefTextarea = page.locator("textarea").first();
    this.submitButton = page.getByRole("button", { name: /run/i }).last();
  }

  async fillBrief(text: string) {
    await this.briefTextarea.fill(text);
  }

  async submit() {
    await this.submitButton.click();
  }

  async getError(): Promise<string> {
    const errorEl = this.page.locator('[role="alert"], .text-semantic-error').first();
    if (await errorEl.isVisible().catch(() => false)) {
      return (await errorEl.textContent()) || "";
    }
    return "";
  }
}
