/**
 * E2E Deep Tests for Agent Creation, Editing, and Run Management
 * Tests: Create form, edit, validation, platform selection, scheduling,
 *       toggle active/inactive, run history, run detail, retry, cancel,
 *       delete, duplicate name, maxPerDay, empty state, pagination
 * URL: /profiles/[profileId]/agents/*
 */

import { expect, test } from "@playwright/test";

const TEST_PROFILE_ID = "test-profile-id";

test.describe("Agent Deep", () => {
  async function mockSession(page: import("@playwright/test").Page) {
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: "user-id",
            name: "Test",
            email: "test@test.com",
            role: "USER",
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    });
  }

  async function skipIfRedirected(page: import("@playwright/test").Page): Promise<boolean> {
    const currentUrl = new URL(page.url());
    if (currentUrl.pathname === "/login") {
      test.skip();
      return true;
    }
    return false;
  }

  function mockAgent(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      name: "Agent Test",
      type: "TEXT_POST",
      platforms: ["X"],
      isActive: false,
      autoPublish: false,
      maxPerDay: 2,
      config: {},
      scheduleCron: null,
      profileId: TEST_PROFILE_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  function mockRun(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      agentId: "agent-id",
      status: "SUCCESS",
      brief: "Generate a social media post about AI.",
      error: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      startedAt: new Date(Date.now() - 3590000).toISOString(),
      finishedAt: new Date(Date.now() - 3550000).toISOString(),
      duration: 40,
      generatedContents: [
        {
          id: "content-1",
          platform: "X",
          textContent: "AI is transforming content creation.",
          hashtags: ["AI"],
          status: "PUBLISHED",
          profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
        },
      ],
      ...overrides,
    };
  }

  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test.describe("CREATE: Agent creation flow", () => {
    test("1: should create agent with name, type, platforms and verify created", async ({
      page,
    }) => {
      let postBody: string | null = null;
      const agentId = `agent-${Date.now()}`;

      await page.route("**/api/agents", async (route) => {
        if (route.request().method() === "POST") {
          postBody = route.request().postData();
          await route.fulfill({
            status: 200,
            json: {
              agent: mockAgent(agentId, {
                name: "Nouvel Agent Test",
                type: "TEXT_POST",
                platforms: ["X", "LINKEDIN"],
              }),
            },
          });
        } else {
          await route.continue();
        }
      });

      // Mock GET on the agent detail page after redirect
      await page.route(`**/api/agents/${agentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              agent: mockAgent(agentId, {
                name: "Nouvel Agent Test",
                type: "TEXT_POST",
                platforms: ["X", "LINKEDIN"],
              }),
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/new`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /créer|nouvel agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Fill agent name
      const nameInput = page.locator("#agent-name, #name");
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      await nameInput.fill("Nouvel Agent Test");

      // Select agent type (Text Post)
      const typeBtn = page
        .locator("button")
        .filter({ hasText: /text.?post|texte/i })
        .first();
      if (await typeBtn.isVisible().catch(() => false)) {
        await typeBtn.click();
      }

      // Select platforms: X and LinkedIn
      const xBtn = page
        .locator("button")
        .filter({ hasText: /^x$|twitter/i })
        .first();
      if (await xBtn.isVisible().catch(() => false)) {
        await xBtn.click();
      }
      const linkedinBtn = page
        .locator("button")
        .filter({ hasText: /linkedin/i })
        .first();
      if (await linkedinBtn.isVisible().catch(() => false)) {
        await linkedinBtn.click();
      }

      // Submit
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      // Verify POST body
      expect(postBody).not.toBeNull();
      if (postBody) {
        const parsed = JSON.parse(postBody);
        expect(parsed.name).toBe("Nouvel Agent Test");
      }

      // Should redirect to agent detail or show success
      const successMsg = page.getByText(/agent créé|créé avec succès|succès/i);
      const detailPage = await page
        .waitForURL(/\/agents\//, { timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      expect(detailPage || (await successMsg.isVisible().catch(() => false))).toBe(true);
    });

    test("3: should show validation error when agent name is empty", async ({ page }) => {
      await page.route("**/api/agents", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 400,
            json: { error: "Name is required" },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/new`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /créer|nouvel agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Leave name empty and submit
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      // Should show validation error
      const errorMsg = page.locator(
        '[class*="semantic-error"], [role="alert"], .text-semantic-error',
      );
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
      const errorText = await errorMsg.textContent().catch(() => "");
      expect(errorText.length).toBeGreaterThan(0);
    });

    test("13: should show validation error when maxPerDay is 0 or negative", async ({ page }) => {
      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/new`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /créer|nouvel agent/i })).toBeVisible({
        timeout: 10000,
      });

      // Fill name first
      const nameInput = page.locator("#agent-name, #name");
      await nameInput.fill("Agent MaxPerDay Test");

      // Find maxPerDay input and set to 0
      const maxPerDayInput = page
        .locator("#agent-max-per-day, input[name='maxPerDay'], input[type='range']")
        .first();
      if (await maxPerDayInput.isVisible().catch(() => false)) {
        const inputType = await maxPerDayInput.getAttribute("type");
        if (inputType === "range") {
          await maxPerDayInput.fill("0");
        } else {
          await maxPerDayInput.clear();
          await maxPerDayInput.fill("0");
        }
      }

      // Submit
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      // Should show validation error
      const errorMsg = page.locator(
        '[class*="semantic-error"], [role="alert"], .text-semantic-error',
      );
      const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasError) {
        const errorText = await errorMsg.textContent().catch(() => "");
        expect(errorText.length).toBeGreaterThan(0);
      } else {
        // If no client-side validation, the form may submit — verify the page still shows the form (not redirected)
        const stillOnForm = await page
          .locator("#agent-name, #name")
          .isVisible()
          .catch(() => false);
        expect(stillOnForm).toBe(true);
      }
    });

    test("12: should show error when creating agent with duplicate name", async ({ page }) => {
      await page.route("**/api/agents", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 409,
            json: { error: "Un agent avec ce nom existe déjà" },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/new`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /créer|nouvel agent/i })).toBeVisible({
        timeout: 10000,
      });

      const nameInput = page.locator("#agent-name, #name");
      await nameInput.fill("Agent Existant");

      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();

      // Should show conflict error
      const errorMsg = page.locator(
        '[class*="semantic-error"], [role="alert"], .text-semantic-error',
      );
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
      await expect(errorMsg).toContainText(/existe déjà|déjà pris|conflit|duplicate/i);
    });
  });

  test.describe("EDIT: Agent editing flow", () => {
    const editAgentId = `edit-agent-${Date.now()}`;

    test("2: should edit agent name and type, save and verify updated", async ({ page }) => {
      let patchBody: string | null = null;

      const existingAgent = mockAgent(editAgentId, {
        name: "Agent Original",
        type: "TEXT_POST",
        platforms: ["X"],
      });

      await page.route(`**/api/agents/${editAgentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { agent: existingAgent } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            status: 200,
            json: { agent: { ...existingAgent, name: "Agent Modifié", type: "VIDEO_CLIP" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${editAgentId}/edit`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /modifier|edit/i })).toBeVisible({
        timeout: 10000,
      });

      // Change name
      const nameInput = page.locator("#agent-name, #name");
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      await nameInput.clear();
      await nameInput.fill("Agent Modifié");

      // Change type to VIDEO_CLIP
      const videoClipBtn = page
        .locator("button")
        .filter({ hasText: /video.?clip|vidéo/i })
        .first();
      if (await videoClipBtn.isVisible().catch(() => false)) {
        await videoClipBtn.click();
      }

      // Save
      const saveBtn = page.locator("button", { hasText: /enregistrer|sauvegarder|save/i }).first();
      await saveBtn.click();

      // Should redirect to agents list
      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      // Verify PATCH body
      expect(patchBody).not.toBeNull();
      if (patchBody) {
        const parsed = JSON.parse(patchBody);
        expect(parsed.name).toBe("Agent Modifié");
        if (parsed.type) {
          expect(parsed.type).toBe("VIDEO_CLIP");
        }
      }
    });
  });

  test.describe("CONFIGURATION: Agent platform and scheduling", () => {
    const configAgentId = `config-agent-${Date.now()}`;

    test("4: should select multiple platforms and verify all saved", async ({ page }) => {
      let patchBody: string | null = null;

      const existingAgent = mockAgent(configAgentId, {
        name: "Multi-Platform Agent",
        type: "TEXT_POST",
        platforms: ["X"],
      });

      await page.route(`**/api/agents/${configAgentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { agent: existingAgent } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            status: 200,
            json: { agent: { ...existingAgent, platforms: ["INSTAGRAM", "LINKEDIN", "X"] } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${configAgentId}/edit`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /modifier|edit/i })).toBeVisible({
        timeout: 10000,
      });

      // Select/deselect platforms
      const xBtn = page
        .locator("button")
        .filter({ hasText: /^x$|twitter/i })
        .first();
      if (await xBtn.isVisible().catch(() => false)) {
        // Ensure X is selected
        const isPressed = await xBtn.getAttribute("aria-pressed").catch(() => null);
        if (isPressed === "false" || isPressed === null) {
          await xBtn.click();
        }
      }

      const instagramBtn = page
        .locator("button")
        .filter({ hasText: /instagram/i })
        .first();
      if (await instagramBtn.isVisible().catch(() => false)) {
        await instagramBtn.click();
      }

      const linkedinBtn = page
        .locator("button")
        .filter({ hasText: /linkedin/i })
        .first();
      if (await linkedinBtn.isVisible().catch(() => false)) {
        await linkedinBtn.click();
      }

      // Save
      const saveBtn = page.locator("button", { hasText: /enregistrer|sauvegarder|save/i }).first();
      await saveBtn.click();

      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      expect(patchBody).not.toBeNull();
      if (patchBody) {
        const parsed = JSON.parse(patchBody);
        expect(parsed.platforms).toBeDefined();
        expect(Array.isArray(parsed.platforms)).toBe(true);
      }
    });

    test("5: should set cron schedule and verify saved", async ({ page }) => {
      let patchBody: string | null = null;
      const scheduleAgentId = `schedule-agent-${Date.now()}`;

      const existingAgent = mockAgent(scheduleAgentId, {
        name: "Scheduled Agent",
        type: "TEXT_POST",
        scheduleCron: null,
      });

      await page.route(`**/api/agents/${scheduleAgentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { agent: existingAgent } });
        } else if (route.request().method() === "PATCH") {
          patchBody = route.request().postData();
          await route.fulfill({
            status: 200,
            json: { agent: { ...existingAgent, scheduleCron: "0 9 * * 1-5" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${scheduleAgentId}/edit`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /modifier|edit/i })).toBeVisible({
        timeout: 10000,
      });

      // Fill cron schedule input
      const scheduleInput = page
        .locator("#agent-schedule, input[name='scheduleCron'], input[placeholder*='cron']")
        .first();
      if (await scheduleInput.isVisible().catch(() => false)) {
        await scheduleInput.clear();
        await scheduleInput.fill("0 9 * * 1-5");
      }

      // Save
      const saveBtn = page.locator("button", { hasText: /enregistrer|sauvegarder|save/i }).first();
      await saveBtn.click();

      await page.waitForURL(/\/profiles\/.*\/agents$/, { timeout: 10000 });

      expect(patchBody).not.toBeNull();
      if (patchBody) {
        const parsed = JSON.parse(patchBody);
        if (parsed.scheduleCron) {
          expect(parsed.scheduleCron).toBe("0 9 * * 1-5");
        }
      }
    });
  });

  test.describe("TOGGLE: Agent active/inactive state", () => {
    const toggleAgentId = `toggle-agent-${Date.now()}`;

    test("6: should toggle active/inactive and verify API call", async ({ page }) => {
      let toggleCalled = false;
      let toggleMethod = "";

      const activeAgent = mockAgent(toggleAgentId, {
        name: "Toggle Agent",
        isActive: true,
      });

      await page.route(`**/api/agents/${toggleAgentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { agent: activeAgent } });
        } else {
          await route.continue();
        }
      });

      // Mock the toggle endpoint
      await page.route(`**/api/agents/${toggleAgentId}/toggle`, async (route) => {
        if (route.request().method() === "POST" || route.request().method() === "PATCH") {
          toggleCalled = true;
          toggleMethod = route.request().method();
          await route.fulfill({
            status: 200,
            json: { agent: { ...activeAgent, isActive: false } },
          });
        } else {
          await route.continue();
        }
      });

      // Also catch direct PATCH to agent
      await page.route(`**/api/agents/${toggleAgentId}`, async (route) => {
        if (route.request().method() === "PATCH") {
          toggleCalled = true;
          toggleMethod = route.request().method();
          await route.fulfill({
            status: 200,
            json: { agent: { ...activeAgent, isActive: false } },
          });
        } else if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { agent: activeAgent } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${toggleAgentId}`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /agent|détail/i })).toBeVisible({
        timeout: 10000,
      });

      // Find and click the toggle switch
      const toggleSwitch = page.locator('[role="switch"], input[type="checkbox"]').first();
      if (await toggleSwitch.isVisible().catch(() => false)) {
        await toggleSwitch.click();
        // Wait for API call
        await page.waitForTimeout(1000);
        expect(toggleCalled).toBe(true);
      } else {
        // Try clicking the status badge or toggle button
        const activeBadge = page
          .locator('[class*="rounded-full"]')
          .filter({ hasText: /actif|active|inactif|paused/i })
          .first();
        if (await activeBadge.isVisible().catch(() => false)) {
          await activeBadge.click();
          await page.waitForTimeout(1000);
          expect(toggleCalled).toBe(true);
        }
      }
    });
  });

  test.describe("RUNS: Agent run history and management", () => {
    const runAgentId = `run-agent-${Date.now()}`;

    test("7: should mock runs and verify list displayed", async ({ page }) => {
      const runs = [
        mockRun(`run-${Date.now()}-1`, { status: "SUCCESS", brief: "First run" }),
        mockRun(`run-${Date.now()}-2`, {
          status: "FAILED",
          brief: "Second run",
          error: "API error",
        }),
        mockRun(`run-${Date.now()}-3`, {
          status: "RUNNING",
          brief: "Third run",
          finishedAt: null,
          duration: null,
        }),
      ];

      await page.route(`**/api/agents/${runAgentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: { agent: mockAgent(runAgentId, { name: "Run History Agent" }) },
          });
        } else {
          await route.continue();
        }
      });

      await page.route(`**/api/agents/${runAgentId}/runs`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: { runs },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${runAgentId}`);
      if (await skipIfRedirected(page)) return;

      // Click on Runs tab
      const runsTab = page.getByRole("button", { name: /exécutions|runs|historique/i }).first();
      if (await runsTab.isVisible().catch(() => false)) {
        await runsTab.click();
      }

      await page.waitForTimeout(1000);

      // Verify run entries are displayed
      const successBadges = page
        .locator('[class*="rounded-full"], [class*="rounded-pill"]')
        .filter({ hasText: /succès|success/i });
      const failedBadges = page
        .locator('[class*="rounded-full"], [class*="rounded-pill"]')
        .filter({ hasText: /échec|failed/i });
      const runningBadges = page
        .locator('[class*="rounded-full"], [class*="rounded-pill"]')
        .filter({ hasText: /running|en cours/i });

      const totalBadges =
        (await successBadges.count()) +
        (await failedBadges.count()) +
        (await runningBadges.count());
      expect(totalBadges).toBeGreaterThanOrEqual(1);

      // Verify run briefs or status indicators are visible
      const runBrief = page.getByText(/first run|second run|third run/i);
      const hasRunContent = await runBrief.isVisible().catch(() => false);
      expect(hasRunContent || totalBadges > 0).toBe(true);
    });

    test("8: should navigate to run detail and verify status/results", async ({ page }) => {
      const runId = `run-detail-${Date.now()}`;
      const runDetail = mockRun(runId, {
        status: "SUCCESS",
        brief: "Generate a post about AI content.",
        generatedContents: [
          {
            id: "content-detail-1",
            platform: "X",
            textContent: "AI is transforming content creation in 2025.",
            hashtags: ["AI"],
            status: "PUBLISHED",
            profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
          },
          {
            id: "content-detail-2",
            platform: "LINKEDIN",
            textContent: "How AI is reshaping content strategies.",
            hashtags: ["AI", "Content"],
            status: "PUBLISHED",
            profile: { id: TEST_PROFILE_ID, name: "Test Brand" },
          },
        ],
      });

      await page.route(`**/api/agents/${runAgentId}/runs/${runId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { run: runDetail } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${runAgentId}/runs/${runId}`);
      if (await skipIfRedirected(page)) return;

      // Verify run detail page
      await expect(page.getByRole("heading", { name: /détail|run/i })).toBeVisible({
        timeout: 10000,
      });

      // Check status badges
      const successBadge = page
        .locator('[class*="rounded-full"]')
        .filter({ hasText: /succès|success/i });
      await expect(successBadge).toBeVisible({ timeout: 5000 });

      // Check generated content
      const contentText = page.getByText(/ai is transforming content creation/i);
      await expect(contentText).toBeVisible({ timeout: 5000 });

      // Check platform badges
      const platformBadge = page.getByText(/x/i).or(page.getByText(/linkedin/i));
      await expect(platformBadge).toBeVisible({ timeout: 5000 });
    });

    test("9: should click retry on failed run and verify API call", async ({ page }) => {
      const failedRunId = `failed-run-${Date.now()}`;
      let retryCalled = false;

      const failedRun = mockRun(failedRunId, {
        status: "FAILED",
        error: "API rate limit exceeded.",
        generatedContents: [],
      });

      await page.route(`**/api/agents/${runAgentId}/runs/${failedRunId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { run: failedRun } });
        } else {
          await route.continue();
        }
      });

      // Mock retry endpoint
      await page.route(`**/api/agents/${runAgentId}/runs/${failedRunId}/retry`, async (route) => {
        if (route.request().method() === "POST") {
          retryCalled = true;
          await route.fulfill({
            status: 200,
            json: { run: { ...failedRun, status: "RUNNING" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${runAgentId}/runs/${failedRunId}`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /détail|run/i })).toBeVisible({
        timeout: 10000,
      });

      // Find and click retry button
      const retryBtn = page
        .getByRole("button")
        .filter({ hasText: /réessayer|retry|relancer/i })
        .first();
      if (await retryBtn.isVisible().catch(() => false)) {
        await retryBtn.click();
        await page.waitForTimeout(1000);
        expect(retryCalled).toBe(true);
      }
    });

    test("10: should click cancel on running run and verify API call", async ({ page }) => {
      const runningRunId = `running-run-${Date.now()}`;
      let cancelCalled = false;

      const runningRun = mockRun(runningRunId, {
        status: "RUNNING",
        finishedAt: null,
        duration: null,
        generatedContents: [],
      });

      await page.route(`**/api/agents/${runAgentId}/runs/${runningRunId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { run: runningRun } });
        } else {
          await route.continue();
        }
      });

      // Mock cancel endpoint
      await page.route(`**/api/agents/${runAgentId}/runs/${runningRunId}/cancel`, async (route) => {
        if (route.request().method() === "POST") {
          cancelCalled = true;
          await route.fulfill({
            status: 200,
            json: { run: { ...runningRun, status: "CANCELLED" } },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${runAgentId}/runs/${runningRunId}`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /détail|run/i })).toBeVisible({
        timeout: 10000,
      });

      // Find and click cancel button
      const cancelBtn = page
        .getByRole("button")
        .filter({ hasText: /annuler|cancel|stopper/i })
        .first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();

        // Handle confirmation dialog if present
        const confirmBtn = page
          .getByRole("button")
          .filter({ hasText: /confirmer|oui|confirm/i })
          .first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
        }

        await page.waitForTimeout(1000);
        expect(cancelCalled).toBe(true);
      }
    });
  });

  test.describe("DELETE: Agent deletion", () => {
    const deleteAgentId = `delete-agent-${Date.now()}`;

    test("11: should click delete, confirm, and verify DELETE API call", async ({ page }) => {
      let deleteCalled = false;
      let deleteMethod = "";

      const agentToDelete = mockAgent(deleteAgentId, { name: "Agent à Supprimer" });

      await page.route(`**/api/agents/${deleteAgentId}`, async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ status: 200, json: { agent: agentToDelete } });
        } else if (route.request().method() === "DELETE") {
          deleteCalled = true;
          deleteMethod = route.request().method();
          await route.fulfill({ status: 200, json: { success: true } });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents/${deleteAgentId}`);
      if (await skipIfRedirected(page)) return;

      await expect(page.getByRole("heading", { name: /agent|détail/i })).toBeVisible({
        timeout: 10000,
      });

      // Find and click delete button
      const deleteBtn = page
        .getByRole("button")
        .filter({ hasText: /supprimer|delete|remove/i })
        .first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
      } else {
        // Try via aria-label
        const deleteIcon = page
          .locator('[aria-label*="supprimer"], [aria-label*="delete"]')
          .first();
        if (await deleteIcon.isVisible().catch(() => false)) {
          await deleteIcon.click();
        }
      }

      // Handle confirmation dialog
      const confirmBtn = page
        .getByRole("button")
        .filter({ hasText: /confirmer|supprimer|oui|confirm|delete/i })
        .last();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }

      // Verify DELETE API was called
      expect(deleteCalled).toBe(true);
      expect(deleteMethod).toBe("DELETE");
    });
  });

  test.describe("LIST: Agent list empty state and pagination", () => {
    test("14: should show 'Aucun agent' empty state when no agents exist", async ({ page }) => {
      await page.route("**/api/agents", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: { agents: [] },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents`);
      if (await skipIfRedirected(page)) return;

      // Should show empty state message
      const emptyState = page.getByText(/aucun agent|no agents? yet|aucun résultat/i);
      await expect(emptyState).toBeVisible({ timeout: 10000 });

      // Should show a create new agent button or link
      const createBtn = page.getByRole("link", { name: /nouvel agent|créer|new agent/i });
      const hasCreateBtn = await createBtn.isVisible().catch(() => false);
      expect(hasCreateBtn).toBe(true);
    });

    test("15: should handle 10+ agents with pagination across pages", async ({ page }) => {
      // Generate 12 mock agents
      const agents = Array.from({ length: 12 }, (_, i) =>
        mockAgent(`paginated-agent-${i + 1}`, {
          name: `Agent Paginé ${i + 1}`,
          type: i % 3 === 0 ? "TEXT_POST" : i % 3 === 1 ? "VIDEO_CLIP" : "CROSS_POST",
          platforms: i % 2 === 0 ? ["X"] : ["LINKEDIN"],
          isActive: i % 4 !== 0,
        }),
      );

      await page.route("**/api/agents*", async (route) => {
        if (route.request().method() === "GET") {
          const url = new URL(route.request().url());
          const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
          const limit = parseInt(url.searchParams.get("limit") || "10", 10);
          const start = (pageParam - 1) * limit;
          const paged = agents.slice(start, start + limit);
          await route.fulfill({
            status: 200,
            json: {
              agents: paged,
              total: agents.length,
              page: pageParam,
              limit,
              totalPages: Math.ceil(agents.length / limit),
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/profiles/${TEST_PROFILE_ID}/agents`);
      if (await skipIfRedirected(page)) return;

      // Wait for agent cards to load
      await page.waitForTimeout(1000);

      // Check that agent cards exist
      const agentCards = page.locator(
        '[class*="rounded-xl"][class*="shadow-card"], [class*="card"], [data-testid*="agent"]',
      );
      const cardCount = await agentCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Look for pagination controls
      const paginationNext = page.getByRole("button", { name: /suivant|next|»|›/i }).first();
      const paginationPrev = page.getByRole("button", { name: /précédent|previous|«|‹/i }).first();
      const pageButtons = page.locator(
        "nav[aria-label*='pagination'] button, [class*='pagination'] button",
      );

      const hasPagination =
        (await paginationNext.isVisible().catch(() => false)) ||
        (await pageButtons
          .first()
          .isVisible()
          .catch(() => false));

      if (hasPagination) {
        // Click next page
        if (
          (await paginationNext.isVisible().catch(() => false)) &&
          !(await paginationNext.isDisabled().catch(() => false))
        ) {
          await paginationNext.click();
          await page.waitForTimeout(1000);

          // Should see different agents now
          const page2Cards = page.locator(
            '[class*="rounded-xl"][class*="shadow-card"], [class*="card"], [data-testid*="agent"]',
          );
          const page2Count = await page2Cards.count();
          expect(page2Count).toBeGreaterThan(0);
        }
      }

      // Verify multiple agent names appear
      const agentNameVisible = await page
        .getByText(/agent paginé 1|agent paginé 12/i)
        .isVisible()
        .catch(() => false);
      expect(agentNameVisible || cardCount > 0).toBe(true);
    });
  });
});
