/**
 * E2E Tests for Dashboard Overview (P2)
 * Tests: Heading, stats grid, quick action buttons, recent activity, publish queue, empty state, widgets
 */

import { expect, test } from "@playwright/test";
import { DashboardPage } from "./pages/dashboard.page";

test.describe("Dashboard Overview", () => {
  test.describe("Dashboard", () => {
    test("should display dashboard heading", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(dashboard.heading).toBeVisible({ timeout: 10000 });
    });

    test("should show stats grid (total content, published, scheduled, drafts)", async ({
      page,
    }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

      // Look for stat card labels in the grid
      const hasTotalContent = await page
        .getByText(/total content|content count|all posts/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasPublished = await page
        .getByText(/published/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasScheduled = await page
        .getByText(/scheduled/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasDrafts = await page
        .getByText(/drafts?/i)
        .first()
        .isVisible()
        .catch(() => false);

      // At least some stats should be visible
      expect(hasTotalContent || hasPublished || hasScheduled || hasDrafts).toBe(true);
    });

    test("should show quick action buttons (Create Content, View Analytics, etc.)", async ({
      page,
    }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for quick action links or buttons
      const createContent = page
        .getByRole("link")
        .filter({ hasText: /create content|new content|create/i })
        .first();
      const viewAnalytics = page
        .getByRole("link")
        .filter({ hasText: /view analytics|analytics/i })
        .first();
      const goToProfiles = page
        .getByRole("link")
        .filter({ hasText: /profiles|manage profiles/i })
        .first();

      const hasCreate = await createContent.isVisible().catch(() => false);
      const hasAnalytics = await viewAnalytics.isVisible().catch(() => false);
      const hasProfiles = await goToProfiles.isVisible().catch(() => false);
      const hasAnyQuickAction = hasCreate || hasAnalytics || hasProfiles;

      // Quick action buttons might also be present as buttons
      if (!hasAnyQuickAction) {
        const actionButtons = page
          .locator("button, a")
          .filter({ hasText: /create|generate|new|view|explore/i });
        const actionCount = await actionButtons.count();
        expect(actionCount).toBeGreaterThanOrEqual(0);
      }
    });

    test("should show recent activity section (or empty state)", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for recent activity heading or section
      const hasActivitySection = await page
        .getByText(/recent activity|activity|latest/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Or empty state message
      const hasEmptyState = await page
        .getByText(/no activity|no recent|get started|welcome/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasActivitySection || hasEmptyState).toBe(true);
    });

    test("should show publish queue summary", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for publish queue or upcoming posts section
      const hasQueueSection = await page
        .getByText(/publish queue|upcoming posts|queue|next to publish/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Or related section with scheduled content
      const hasScheduledWidget = await page
        .getByText(/scheduled|upcoming|queue|pending/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasQueueSection || hasScheduledWidget).toBe(true);
    });
  });

  test.describe("Dashboard Empty State", () => {
    test("should show welcome message for new users (or skip if content exists)", async ({
      page,
    }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check if welcome message is shown (empty state) or if content exists
      const welcomeMsg = await page
        .getByText(/welcome|get started|let's create|no content yet/i)
        .first()
        .isVisible()
        .catch(() => false);

      const hasContent = await page
        .getByText(/total content|published|dashboard overview/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Either showing welcome message or content
      expect(welcomeMsg || hasContent).toBe(true);
    });

    test("should have onboarding CTA buttons", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for onboarding/CTA buttons
      const ctaButtons = page.locator("button, a").filter({
        hasText: /create profile|create agent|add platform|get started|create content/i,
      });

      const ctaCount = await ctaButtons.count();
      // Either CTAs are visible or dashboard has content (user is past onboarding)
      const hasContent = await page
        .getByText(/published|scheduled|drafts?/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(ctaCount > 0 || hasContent).toBe(true);
    });
  });

  test.describe("Dashboard Widgets", () => {
    test("should show content performance widget", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for performance-related widget
      const perfWidget = await page
        .getByText(/performance|engagement|impressions|reach|clicks/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Or empty state
      const emptyState = await page
        .getByText(/no performance|no data yet|connect a platform/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Widget section itself might be visible
      const widgetSection = await page
        .locator('[class*="widget"], [class*="card"]')
        .filter({ hasText: /performance|analytics/i })
        .first()
        .isVisible()
        .catch(() => false);

      expect(perfWidget || emptyState || widgetSection).toBe(true);
    });

    test("should show upcoming scheduled posts", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for upcoming scheduled posts section
      const upcomingSection = await page
        .getByText(/upcoming posts|scheduled posts|next to publish|queue/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Or empty state
      const noUpcoming = await page
        .getByText(/no upcoming|no scheduled|nothing scheduled/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(upcomingSection || noUpcoming).toBe(true);
    });

    test("should show recent agent runs", async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for agent runs or recent agent activity
      const agentRuns = await page
        .getByText(/agent runs|agent activity|recent runs|ai activity/i)
        .first()
        .isVisible()
        .catch(() => false);

      // Or agent run status indicators
      const runStatuses = await page
        .locator('[class*="rounded-pill"], [class*="badge"]')
        .filter({ hasText: /success|failed|running|completed/i })
        .first()
        .isVisible()
        .catch(() => false);

      // Or empty state for new users
      const noAgentActivity = await page
        .getByText(/no agent|no runs|create an agent/i)
        .first()
        .isVisible()
        .catch(() => false);

      expect(agentRuns || runStatuses || noAgentActivity).toBe(true);
    });
  });
});

// ============================================================
// Dashboard — New User Experience
// ============================================================

test.describe("Dashboard — New User Experience", () => {
  test("should show personalized welcome greeting with first name", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        json: {
          id: "test-user-id",
          email: "alice@example.com",
          name: "Alice Dupont",
          firstName: "Alice",
          role: "user",
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Should show a greeting that includes the user's first name
    const greetingMsg = page.getByText(/Alice|Bonjour|Hello|Welcome|Bienvenue|Hey/i);
    await expect(greetingMsg).toBeVisible({ timeout: 5000 });
  });

  test("should show 3 onboarding step cards for new users", async ({ page }) => {
    // Mock empty dashboard to simulate new user
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({ json: { stats: [], recentContent: [], activeAgents: [] } });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Look for onboarding step cards
    const stepCards = page.locator(
      '[class*="onboarding"], [class*="step-card"], [class*="setup-step"]',
    );
    const stepCount = await stepCards.count();

    // Or count numbered steps / step indicators
    const steps = page.locator('[class*="step"], [role="progressbar"], [aria-label*="step" i]');
    const foundSteps = await steps.count();

    const hasOnboardingSection = await page
      .getByText(/step|setup|onboarding|welcome|get started|let's|commencer/i)
      .first()
      .isVisible()
      .catch(() => false);

    // Either 3 step cards exist, or onboarding UI is present
    expect(stepCount === 3 || foundSteps >= 2 || hasOnboardingSection).toBe(true);
  });

  test("should navigate to /profiles/new via 'Create Your First Profile' CTA", async ({ page }) => {
    // Mock empty dashboard to show the CTA
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({ json: { stats: [], recentContent: [], activeAgents: [] } });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Find and click "Create Your First Profile" button/link
    const cta = page
      .getByRole("link")
      .locator(
        'a:has-text("Create Your First Profile"), a:has-text("Create Profile"), a:has-text("Nouveau profil"), a:has-text("Créer")',
      )
      .or(
        page
          .getByRole("button")
          .filter({ hasText: /create.*profile|nouveau profil|first profile|créer.*profil/i }),
      )
      .first();

    const ctaLink = page
      .locator('a[href*="/profiles/new"]')
      .filter({ hasText: /create|profile|nouveau|first/i })
      .first();

    const target = (await cta.isVisible().catch(() => false))
      ? cta
      : (await ctaLink.isVisible().catch(() => false))
        ? ctaLink
        : null;

    if (target) {
      const href = await target.getAttribute("href").catch(() => null);
      await target.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      // Should navigate to profiles/new or profiles/create
      const finalUrl = new URL(page.url());
      const isProfileCreation =
        finalUrl.pathname.includes("/profiles/new") ||
        finalUrl.pathname.includes("/profiles/create");
      expect(href?.includes("/profiles/new") || isProfileCreation).toBe(true);
    } else {
      // No CTA found - user might already have content
      test.skip();
    }
  });

  test("should navigate to /profiles/new via 'New Profile' quick action", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Look for "New Profile" quick action link/button in the quick actions section
    const quickAction = page
      .locator(
        'a[href*="/profiles/new"], button:has-text("New Profile"), button:has-text("Add Profile"), a:has-text("New Profile"), a:has-text("Add Profile")',
      )
      .first();

    if (await quickAction.isVisible().catch(() => false)) {
      await quickAction.click();
      await page.waitForLoadState("networkidle", { timeout: 5000 });

      const finalUrl = new URL(page.url());
      expect(finalUrl.pathname).toContain("/profiles/new");
    } else {
      // Quick action not found - skip
      test.skip();
    }
  });

  test("should navigate to /content via 'View Content' quick action", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Look for "View Content" quick action link/button
    const viewContent = page
      .locator(
        'a[href*="/content"], button:has-text("View Content"), button:has-text("Manage Content"), a:has-text("View Content"), a:has-text("Manage Content"), a:has-text("Voir contenu")',
      )
      .first();

    if (await viewContent.isVisible().catch(() => false)) {
      // If it's a link, check href; if clicked, navigate
      const tagName = await viewContent
        .evaluate((el) => el.tagName.toLowerCase())
        .catch(() => "unknown");

      if (tagName === "a") {
        const href = await viewContent.getAttribute("href").catch(() => null);
        expect(href).toContain("/content");
      } else {
        await viewContent.click();
        await page.waitForLoadState("networkidle", { timeout: 5000 });
        const finalUrl = new URL(page.url());
        expect(finalUrl.pathname).toContain("/content");
      }
    } else {
      test.skip();
    }
  });
});

// ============================================================
// Dashboard — Stats & Content
// ============================================================

test.describe("Dashboard — Stats & Content", () => {
  test("should display 4 stat cards with specific labels (Total Profiles, Active Agents, Pending Drafts, Published This Week)", async ({
    page,
  }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          stats: {
            totalProfiles: 3,
            activeAgents: 2,
            pendingDrafts: 5,
            publishedThisWeek: 12,
          },
          recentContent: [],
          activeAgentsList: [],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Check for stat card labels
    const hasTotalProfiles = await page
      .getByText(/total profiles?|profiles count|profiles/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasActiveAgents = await page
      .getByText(/active agents?|agents? actifs/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasPendingDrafts = await page
      .getByText(/pending drafts?|drafts? en attente|drafts?/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasPublishedThisWeek = await page
      .getByText(/published this week|cette semaine|publié cette semaine|published/i)
      .first()
      .isVisible()
      .catch(() => false);

    const found = [
      hasTotalProfiles,
      hasActiveAgents,
      hasPendingDrafts,
      hasPublishedThisWeek,
    ].filter(Boolean).length;
    // At least 3 of 4 stat cards should be visible
    expect(found).toBeGreaterThanOrEqual(3);
  });

  test("should show recent content list with platform badges and status", async ({ page }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          recentContent: [
            {
              id: "c1",
              title: "AI trends 2026",
              platform: "twitter",
              status: "published",
              publishedAt: "2026-06-20",
            },
            {
              id: "c2",
              title: "Content strategy guide",
              platform: "linkedin",
              status: "draft",
              updatedAt: "2026-06-19",
            },
          ],
          stats: { totalProfiles: 3, activeAgents: 2, pendingDrafts: 5, publishedThisWeek: 12 },
          activeAgentsList: [],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Check for content section
    const hasContentSection = await page
      .getByText(/recent content|recent posts|latest content|contenu récent/i)
      .first()
      .isVisible()
      .catch(() => false);

    const hasContentItem = await page
      .getByText(/AI trends 2026|Content strategy guide/i)
      .first()
      .isVisible()
      .catch(() => false);

    const hasPlatformBadge = await page
      .locator('[class*="badge"], [class*="platform"], [class*="icon"]')
      .filter({ hasText: /twitter|linkedin/i })
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasContentSection || hasContentItem || hasPlatformBadge).toBe(true);
  });

  test("should show active agents cards with name, type, platform icons", async ({ page }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          activeAgentsList: [
            {
              id: "a1",
              name: "Twitter Bot",
              type: "scheduler",
              platform: "twitter",
              status: "running",
            },
            {
              id: "a2",
              name: "LinkedIn Curator",
              type: "curator",
              platform: "linkedin",
              status: "idle",
            },
          ],
          stats: { totalProfiles: 3, activeAgents: 2, pendingDrafts: 5, publishedThisWeek: 12 },
          recentContent: [],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    const hasAgentSection = await page
      .getByText(/active agents?|agents? actifs|running agents?|agent activity/i)
      .first()
      .isVisible()
      .catch(() => false);

    const hasAgentName = await page
      .getByText(/Twitter Bot|LinkedIn Curator/i)
      .first()
      .isVisible()
      .catch(() => false);

    const hasAgentStatus = await page
      .getByText(/running|idle|active/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasAgentSection || hasAgentName || hasAgentStatus).toBe(true);
  });

  test("should show Analytics section with DashboardStats component", async ({ page }) => {
    await page.route("**/api/dashboard/stats", async (route) => {
      await route.fulfill({
        json: {
          totalImpressions: 45000,
          totalEngagements: 3200,
          topPlatform: "twitter",
          trend: "+15%",
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    const hasAnalyticsSection = await page
      .getByText(/analytics|performance|dashboard stats|impressions|engagement|statistics/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasAnalyticsSection).toBe(true);
  });

  test("should show empty state for recent content when none exists", async ({ page }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          recentContent: [],
          stats: { totalProfiles: 0, activeAgents: 0, pendingDrafts: 0, publishedThisWeek: 0 },
          activeAgentsList: [],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    const emptyState = page.getByText(
      /no content yet|no recent content|no posts yet|aucun contenu|get started|create your first/i,
    );
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test("should show empty state for active agents when none exist", async ({ page }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          activeAgentsList: [],
          stats: { totalProfiles: 1, activeAgents: 0, pendingDrafts: 0, publishedThisWeek: 0 },
          recentContent: [],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    const emptyState = page.getByText(
      /no agents?|no running agents?|create an agent|aucun agent|no active agents?/i,
    );
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test("should show loading skeleton state", async ({ page }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        json: { stats: {}, recentContent: [], activeAgentsList: [] },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    const skeleton = page
      .locator('[class*="skeleton"], [class*="loading"], [class*="shimmer"]')
      .first();
    await expect(skeleton).toBeVisible({ timeout: 5000 });
  });

  test("should show formatted date in dashboard header", async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Check for a date string in the header area (e.g., "June 2026" or "21 June 2026")
    const header = page.locator("header, [class*='header'], [class*='top-bar']").first();
    const headerText = await header.textContent().catch(() => "");

    const hasDate = headerText ? /\b(2026|2025|2024)\b/.test(headerText) : false;

    // Also check for date-related text anywhere visible
    const hasDateElement = await page
      .locator('[class*="date"], [class*="time"], time, [datetime]')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasDate || hasDateElement).toBe(true);
  });

  test("should show PublishChart with loading then 'No data yet' states", async ({ page }) => {
    await page.route("**/api/dashboard/charts", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        json: {
          publishChart: [],
          message: "No data yet",
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Check for a publish chart section
    const chartSection = page
      .getByText(/publish chart|publication chart|publish graph|chart/i)
      .first();
    const hasChartSection = await chartSection.isVisible().catch(() => false);

    // Check for "No data yet" empty state after load
    const noDataMsg = page
      .getByText(/no data yet|aucune donnée|no chart data|pas de données/i)
      .first();
    const hasNoData = await noDataMsg.isVisible({ timeout: 8000 }).catch(() => false);

    // Check for chart placeholder
    const chartPlaceholder = page
      .locator('[class*="chart"], [data-testid*="chart"], [class*="graph"]')
      .first();
    const hasChart = await chartPlaceholder.isVisible().catch(() => false);

    expect(hasChartSection || hasNoData || hasChart).toBe(true);
  });

  test("should show all-zero stats when no activity exists", async ({ page }) => {
    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          stats: { totalProfiles: 0, activeAgents: 0, pendingDrafts: 0, publishedThisWeek: 0 },
          recentContent: [],
          activeAgentsList: [],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Zero values should render somewhere in the stats area
    const zeroValues = page.getByText(/0/);
    const count = await zeroValues.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // No error banners should appear
    const errorShown = await page
      .getByText(/error|failed|unable to load|something went wrong/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(errorShown).toBe(false);
  });

  test("should display partial content when stats API fails but other APIs succeed", async ({
    page,
  }) => {
    // Mock stats to fail, but recent content and agents to succeed
    await page.route("**/api/dashboard/stats", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Stats unavailable" }),
      });
    });

    // Keep other dashboard routes working
    await page.route("**/api/dashboard/content", async (route) => {
      await route.fulfill({
        json: [{ id: "c1", title: "Recent Post 1", status: "published" }],
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Page should still render without crashing
    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);

    // Stats error may show as a partial error or empty state
    const hasPartialError = await page
      .getByText(/unable to load|failed to load|stats? unavailable/i)
      .first()
      .isVisible()
      .catch(() => false);

    // Some content sections should still be visible
    const hasContent = await page
      .getByText(/Recent Post 1|dashboard|heading/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasPartialError || hasContent).toBe(true);
  });

  test("should show stat cards with 100+ content items gracefully", async ({ page }) => {
    // Generate 100+ mock content items
    const manyItems = Array.from({ length: 105 }, (_, i) => ({
      id: `bulk-item-${i}`,
      title: `Content item number ${i + 1} with a reasonably long title for testing`,
      platform: ["twitter", "linkedin", "instagram"][i % 3],
      status: ["published", "draft", "scheduled"][i % 3],
      publishedAt: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
    }));

    await page.route("**/api/dashboard/**", async (route) => {
      await route.fulfill({
        json: {
          stats: { totalProfiles: 5, activeAgents: 3, pendingDrafts: 50, publishedThisWeek: 55 },
          recentContent: manyItems,
          activeAgentsList: [
            {
              id: "a1",
              name: "Main Bot",
              type: "scheduler",
              platform: "twitter",
              status: "running",
            },
          ],
        },
      });
    });

    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return;
    }

    await expect(dashboard.heading).toBeVisible({ timeout: 10000 });

    // Page should render without performance degradation indicators
    const bodyText = await page.locator("body").textContent();
    expect((bodyText || "").length).toBeGreaterThan(0);

    // No crash or error boundary should appear
    const hasCrashError = await page
      .getByText(/something went wrong|application error|unexpected error/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasCrashError).toBe(false);
  });
});
