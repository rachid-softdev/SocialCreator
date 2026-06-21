/**
 * Teams Page Object Model
 * Covers team creation, member invitation, role management
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class TeamsPage extends BasePage {
  readonly heading: Locator;
  readonly createTeamButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /teams/i });
    this.createTeamButton = page.getByRole("button", { name: /create team/i });
  }

  override async goto() {
    await super.goto("/settings/teams");
  }

  async clickCreateTeam() {
    await this.createTeamButton.click();
  }

  async fillTeamDialogName(name: string) {
    const input = this.page.locator("#team-name");
    await input.fill(name);
  }

  async submitTeamCreation() {
    const createBtn = this.page.getByRole("button", { name: /create team/i }).last();
    // The dialog has two "Create Team" buttons: trigger + submit
    // The submit one is inside the dialog
    await createBtn.click();
  }

  async cancelTeamCreation() {
    const cancelBtn = this.page.getByRole("button", { name: /cancel/i });
    await cancelBtn.click();
  }

  async viewTeamDetails(_teamName: string) {
    const viewBtn = this.page.getByRole("button", { name: /view details/i }).first();
    if (await viewBtn.isVisible()) {
      await viewBtn.click();
    }
  }

  async inviteMember(_teamId: string, email: string, role = "VIEWER") {
    // Click the invite button (Plus icon) for the team
    const inviteBtn = this.page.locator(`button[title="Invite member"]`).first();
    await inviteBtn.click();

    // Fill invite dialog
    const emailInput = this.page.locator("#invite-email");
    await emailInput.fill(email);

    // Select role
    if (role !== "VIEWER") {
      const roleSelect = this.page.locator("#invite-role");
      await roleSelect.selectOption(role);
    }

    // Send invitation
    const sendBtn = this.page.getByRole("button", { name: /send invitation/i });
    await sendBtn.click();
  }

  async isTeamVisible(teamName: string): Promise<boolean> {
    const teamHeading = this.page.getByRole("heading", { name: teamName });
    return teamHeading.isVisible().catch(() => false);
  }

  async changeMemberRole(memberEmail: string, newRole: string) {
    // Find the member row and change their role via the select
    const memberRow = this.page.locator(`text=${memberEmail}`).locator("..");
    const roleSelect = memberRow.locator("select");
    await roleSelect.selectOption(newRole);
  }

  async removeMember(memberEmail: string) {
    const memberRow = this.page.locator(`text=${memberEmail}`).locator("..");
    const removeBtn = memberRow.locator('button[title="Remove member"]');
    await removeBtn.click();
  }

  async waitForToast() {
    await expect(this.page.getByRole("status").first()).toBeVisible({ timeout: 5000 });
  }
}
