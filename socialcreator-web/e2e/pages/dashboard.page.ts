/**
 * Dashboard Page Object Model
 * Enriched with selectors for all dashboard components:
 * - StatsGrid (server-rendered stat cards)
 * - QuickActions (New Profile, New Agent, View Content)
 * - RecentContent (content list with platform badges)
 * - ActiveAgents (agent cards with name/type/platform)
 * - DashboardStats (client-side analytics section)
 * - Onboarding (new user welcome flow)
 * - Loading & error states
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class DashboardPage extends BasePage {
  // ── Header / Navigation ─────────────────────────────────
  readonly heading: Locator;
  readonly greeting: Locator;
  readonly dateDisplay: Locator;
  readonly breadcrumb: Locator;

  // ── New User Onboarding ─────────────────────────────────
  readonly welcomeSection: Locator;
  readonly welcomeDescription: Locator;
  readonly onboardingSteps: Locator;
  readonly onboardingStepCards: Locator;
  readonly createFirstProfileCta: Locator;
  readonly onboardingHeadline: Locator;

  // ── Stats Grid (server-rendered) ─────────────────────────
  readonly statsGrid: Locator;
  readonly statTotalProfiles: Locator;
  readonly statActiveAgents: Locator;
  readonly statPendingDrafts: Locator;
  readonly statPublishedThisWeek: Locator;

  // ── Quick Actions ───────────────────────────────────────
  readonly quickActionsSection: Locator;
  readonly quickActionNewProfile: Locator;
  readonly quickActionNewAgent: Locator;
  readonly quickActionViewContent: Locator;

  // ── Recent Content ──────────────────────────────────────
  readonly recentContentSection: Locator;
  readonly recentContentItems: Locator;
  readonly recentContentEmptyState: Locator;

  // ── Active Agents ───────────────────────────────────────
  readonly activeAgentsSection: Locator;
  readonly activeAgentCards: Locator;
  readonly activeAgentsEmptyState: Locator;

  // ── Analytics / DashboardStats (client-side) ────────────
  readonly analyticsSection: Locator;
  readonly analyticsLoading: Locator;
  readonly analyticsCards: Locator;
  readonly analyticsError: Locator;

  // ── Loading / Error ─────────────────────────────────────
  readonly pageLoading: Locator;
  readonly skeleton: Locator;
  readonly errorBanner: Locator;
  readonly errorAlert: Locator;

  // ── Publish Chart ───────────────────────────────────────
  readonly chartSection: Locator;
  readonly chartContainer: Locator;
  readonly chartEmptyState: Locator;
  readonly chartLoading: Locator;

  // ── Mobile / Responsive ────────────────────────────────
  readonly mobileMenuButton: Locator;
  readonly sidebarDesktop: Locator;
  readonly sidebarNav: Locator;
  readonly sidebarNavDashboard: Locator;

  // ── Stat card value texts (for exact verification) ─────
  readonly statValueTexts: Locator;

  constructor(page: Page) {
    super(page);

    // ── Header / Navigation ──
    this.heading = page.locator("h1").first();
    this.greeting = page.locator("h1").first();
    this.dateDisplay = page
      .locator("header + div p.text-body-md.text-muted, div:has(> h1) + p.text-body-md")
      .first();
    this.breadcrumb = page
      .locator("nav")
      .filter({ hasText: /Dashboard/i })
      .first();

    // ── New User Onboarding ──
    this.welcomeSection = page.locator("div.max-w-lg.mx-auto.text-center");
    this.welcomeDescription = page.getByText(/you're just a few steps away/i);
    this.onboardingSteps = page.locator("div.grid.grid-cols-1.sm\\:grid-cols-3").first();
    this.onboardingStepCards = page.locator("div.grid.grid-cols-1.sm\\:grid-cols-3 > div");
    this.createFirstProfileCta = page
      .locator('a[href="/profiles/new"]')
      .filter({ hasText: /Create Your First Profile/i });
    this.onboardingHeadline = page.getByText(/Create your first profile/i);

    // ── Stats Grid ──
    this.statsGrid = page
      .locator("div.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4.gap-4")
      .first();
    this.statTotalProfiles = page
      .locator("p.text-caption.text-muted")
      .filter({ hasText: "Total Profiles" })
      .locator("..")
      .locator("p.text-display-sm");
    this.statActiveAgents = page
      .locator("p.text-caption.text-muted")
      .filter({ hasText: "Active Agents" })
      .locator("..")
      .locator("p.text-display-sm");
    this.statPendingDrafts = page
      .locator("p.text-caption.text-muted")
      .filter({ hasText: "Pending Drafts" })
      .locator("..")
      .locator("p.text-display-sm");
    this.statPublishedThisWeek = page
      .locator("p.text-caption.text-muted")
      .filter({ hasText: "Published This Week" })
      .locator("..")
      .locator("p.text-display-sm");

    // ── Quick Actions ──
    this.quickActionsSection = page.getByText("Quick Actions").locator("..");
    this.quickActionNewProfile = page
      .locator('a[href="/profiles/new"]')
      .filter({ hasText: "New Profile" });
    this.quickActionNewAgent = page
      .locator('a[href="/agents/new"]')
      .filter({ hasText: "New Agent" });
    this.quickActionViewContent = page
      .locator('a[href="/content"]')
      .filter({ hasText: "View Content" });

    // ── Recent Content ──
    this.recentContentSection = page.getByText("Recent Content").locator("..");
    this.recentContentItems = page.locator("div.space-y-3 > div").first();
    this.recentContentEmptyState = page.getByText(/No content yet\./i);

    // ── Active Agents ──
    this.activeAgentsSection = page.getByText("Active Agents").locator("..");
    this.activeAgentCards = page.locator("div.grid.grid-cols-1.md\\:grid-cols-2.gap-4 > div");
    this.activeAgentsEmptyState = page.getByText(/No active agents\./i);

    // ── Analytics / DashboardStats ──
    this.analyticsSection = page.getByText("Analytics").locator("..");
    this.analyticsLoading = page.locator("div.animate-pulse").first();
    this.analyticsCards = page.locator(
      "div.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4.gap-4",
    );
    this.analyticsError = page.locator('div[role="alert"]').first();

    // ── Loading / Error ──
    this.pageLoading = page.locator('[class*="animate-pulse"]').first();
    this.skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]').first();
    this.errorBanner = page.locator('[role="alert"], div.bg-red-50, div.bg-semantic-error').first();
    this.errorAlert = page.getByText(/error|failed|unable to load|something went wrong/i).first();

    // ── Publish Chart (Publications chart section) ──
    this.chartSection = page.getByText(/Publications? \(7 days\)/i).first();
    this.chartContainer = page.locator(".recharts-responsive-container, .recharts-wrapper").first();
    this.chartEmptyState = page.getByText(/No data yet/i).first();
    this.chartLoading = page.locator("div.animate-pulse").first();

    // ── Mobile / Responsive ──
    this.mobileMenuButton = page.getByLabel("Open navigation menu");
    this.sidebarDesktop = page.locator("aside.fixed.top-0.left-0").first();
    this.sidebarNav = page.locator('nav[aria-label="Main navigation"]').first();
    this.sidebarNavDashboard = page
      .locator('nav[aria-label="Main navigation"] a[href="/dashboard"]')
      .first();

    // ── Stat card value texts ──
    this.statValueTexts = page.locator("p.text-display-sm");
  }

  override async goto() {
    await super.goto("/dashboard");
  }

  async isVisible(timeout = 10000): Promise<boolean> {
    try {
      await this.heading.waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** Check if current page redirected to login (unauthenticated) */
  async isRedirectedToLogin(): Promise<boolean> {
    return this.page.url().includes("/login");
  }

  /** Get the text content of a stat card value by its label */
  async getStatValue(label: string): Promise<string> {
    const card = this.statsGrid.locator(":scope > div").filter({ hasText: label });
    const valueEl = card.locator("p.text-display-sm");
    return (await valueEl.textContent())?.trim() ?? "";
  }

  /** Get count of visible stat cards in the StatsGrid */
  async getStatCardCount(): Promise<number> {
    return this.statsGrid.locator(":scope > div").count();
  }

  /** Get count of items in the recent content list */
  async getRecentContentCount(): Promise<number> {
    const container = this.recentContentSection.locator("div.space-y-3");
    return container.locator(":scope > div").count();
  }

  /** Get text of the nth recent content item */
  async getRecentContentText(index: number): Promise<string> {
    return (await this.page.locator("div.space-y-3 > div").nth(index).textContent())?.trim() ?? "";
  }

  /** Get count of active agent cards */
  async getActiveAgentCount(): Promise<number> {
    return this.activeAgentCards.count();
  }

  /** Get name of the nth active agent */
  async getActiveAgentName(index: number): Promise<string> {
    return (await this.activeAgentCards.nth(index).locator("h4").textContent())?.trim() ?? "";
  }

  /** Check if the dashboard is showing the new-user onboarding flow */
  async isNewUserView(): Promise<boolean> {
    const hasCta = await this.createFirstProfileCta.isVisible().catch(() => false);
    const hasSteps = await this.onboardingStepCards
      .first()
      .isVisible()
      .catch(() => false);
    return hasCta || hasSteps;
  }

  /** Check for error banner visibility */
  async hasError(): Promise<boolean> {
    return this.errorAlert.isVisible().catch(() => false);
  }

  /** Get the analytics card value by label */
  async getAnalyticsCardValue(label: string): Promise<string> {
    const grid = this.analyticsCards;
    const card = grid.locator(":scope > div").filter({ hasText: label });
    const valueEl = card.locator("p.text-display-sm");
    return (await valueEl.textContent())?.trim() ?? "";
  }

  /** Get page title (document.title) */
  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  /** Check if the mobile hamburger menu button is visible */
  async isMobileMenuVisible(): Promise<boolean> {
    return this.mobileMenuButton.isVisible().catch(() => false);
  }

  /** Check if the desktop sidebar is on-screen (left edge >= 0) */
  async isSidebarOnScreen(): Promise<boolean> {
    try {
      const rect = await this.sidebarDesktop.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width };
      });
      return rect.left >= 0 && rect.left < rect.width;
    } catch {
      return false;
    }
  }

  /** Get the number of visible content items in the recent content list */
  async getContentItemCount(): Promise<number> {
    const count = await this.recentContentItems.count().catch(() => 0);
    return count;
  }

  /** Get the text content of a specific stat card by its label */
  async getStatCardValueText(label: string): Promise<string> {
    const card = this.statsGrid.locator(":scope > div").filter({ hasText: label });
    const valueEl = card.locator("p.text-display-sm");
    return (await valueEl.textContent())?.trim() ?? "";
  }

  /** Get all stat card values as an array of strings */
  async getAllStatValues(): Promise<string[]> {
    const count = await this.statValueTexts.count();
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await this.statValueTexts.nth(i).textContent())?.trim() ?? "";
      if (text) values.push(text);
    }
    return values;
  }

  /** Check if the sidebar navigation "Dashboard" link has aria-current="page" */
  async isDashboardNavActive(): Promise<boolean> {
    try {
      const ariaCurrent = await this.sidebarNavDashboard.getAttribute("aria-current");
      return ariaCurrent === "page";
    } catch {
      return false;
    }
  }
}
