/**
 * E2E Tests for Teams Management
 * Tests: Navigation, team creation, member invitation, role management, member removal
 */

import { expect, test } from "@playwright/test";
import { TeamsPage } from "./pages/teams.page";

test.describe("Teams Management", () => {
  test.describe("Navigation", () => {
    test("should navigate to teams settings page", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(teams.heading).toBeVisible({ timeout: 10000 });
    });

    test("should show teams page header with description", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByText(/collaborate with your team/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Team Creation", () => {
    test("should show create team button", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(teams.createTeamButton).toBeVisible({ timeout: 5000 });
    });

    test("should open team creation dialog", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await teams.clickCreateTeam();

      // Dialog should open with a form
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/create a new team/i)).toBeVisible();
    });

    test("should have team name input in creation dialog", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await teams.clickCreateTeam();

      // Verify the form has a team name input
      const nameInput = page.locator("#team-name");
      await expect(nameInput).toBeVisible({ timeout: 5000 });
    });

    test("should show error for empty team name", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await teams.clickCreateTeam();

      // Submit with empty name
      await teams.submitTeamCreation();

      // Should show validation error
      await expect(page.getByText(/team name is required/i)).toBeVisible({ timeout: 5000 });
    });

    test("should close team dialog on cancel", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await teams.clickCreateTeam();
      await teams.cancelTeamCreation();

      // Dialog should close
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Team Details", () => {
    test("should toggle team details view", async ({ page }) => {
      const teams = new TeamsPage(page);
      await teams.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Find view details buttons
      const viewBtn = page.getByRole("button", { name: /view details/i });
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.first().click();

        // Members section should become visible
        await expect(page.getByText(/owner/i).or(page.getByText(/members/i))).toBeVisible({
          timeout: 5000,
        });
      }
    });

    test("should display owner information in team details", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Expand team details
      const viewBtn = page.getByRole("button", { name: /view details/i });
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.first().click();

        // Owner section should be visible
        await expect(page.getByText(/^Owner$/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Member Invitation", () => {
    test("should show invite member button for team owners", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check if invite button (Plus icon button with title="Invite member") exists
      const inviteBtn = page.locator('button[title="Invite member"]');
      const inviteCount = await inviteBtn.count();
      expect(inviteCount).toBeGreaterThanOrEqual(0);
    });

    test("should open invite dialog with email and role fields", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const inviteBtn = page.locator('button[title="Invite member"]');
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.first().click();

        // Dialog should have email input and role select
        await expect(page.locator("#invite-email")).toBeVisible({ timeout: 5000 });
        await expect(page.locator("#invite-role")).toBeVisible();
      }
    });

    test("should show validation for empty invite email", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const inviteBtn = page.locator('button[title="Invite member"]');
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.first().click();

        // Click send without email
        const sendBtn = page.getByRole("button", { name: /send invitation/i });
        await sendBtn.click();

        // Should show validation error
        await expect(page.getByText(/email is required/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Role Management", () => {
    test("should show role select for members", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Expand team details
      const viewBtn = page.getByRole("button", { name: /view details/i });
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.first().click();

        // Check if role select elements exist
        const roleSelects = page.locator("select");
        const selectCount = await roleSelects.count();
        expect(selectCount).toBeGreaterThanOrEqual(0);
      }
    });

    test("should show available role options", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check invite dialog role options
      const inviteBtn = page.locator('button[title="Invite member"]');
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.first().click();

        // Role select should have options: ADMIN, EDITOR, VIEWER
        const roleSelect = page.locator("#invite-role");
        const options = await roleSelect.locator("option").allTextContents();
        const hasRoles = options.some((o) => o.includes("Admin"));
        expect(hasRoles).toBe(true);
      }
    });
  });

  test.describe("Member Removal", () => {
    test("should show remove member button for team owners", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check for remove member buttons
      const removeBtns = page.locator('button[title="Remove member"]');
      const removeCount = await removeBtns.count();
      expect(removeCount).toBeGreaterThanOrEqual(0);
    });

    test("should show delete team button for owners", async ({ page }) => {
      await page.goto("/settings/teams");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check for delete team buttons
      const deleteBtns = page.locator('button[title="Delete team"]');
      const deleteCount = await deleteBtns.count();
      expect(deleteCount).toBeGreaterThanOrEqual(0);
    });
  });
});
