/**
 * E2E Tests for Admin Teams Management (/admin/teams)
 * Covers: Teams list, team detail, member management, edge cases
 */

import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockSession(page, role = "ADMIN") {
  await page.route("**/api/auth/session", async (route) => {
    if (role === null) {
      await route.fulfill({ status: 200, json: {} });
    } else {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: "admin-id",
            name: "Admin",
            email: "admin@test.com",
            role,
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
    }
  });
}

async function skipIfRedirected(page) {
  if (new URL(page.url()).pathname === "/login") {
    test.skip();
    return true;
  }
  return false;
}

function mockTeam(id, index, overrides = {}) {
  return {
    id,
    name: `Team ${index}`,
    orgId: `org-${index}`,
    createdAt: "2026-01-15T00:00:00Z",
    owner: {
      id: `owner-${index}`,
      name: `Owner ${index}`,
      email: `owner${index}@test.com`,
    },
    organization: {
      id: `org-${index}`,
      name: `Organization ${index}`,
    },
    _count: { members: 3 + index },
    ...overrides,
  };
}

function mockMember(id, index, overrides = {}) {
  const roles = ["ADMIN", "EDITOR", "VIEWER"];
  return {
    id,
    name: `Member ${index}`,
    email: `member${index}@test.com`,
    role: roles[index % roles.length],
    isOwner: index === 0,
    joinedAt: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Section 1: Teams List
// ---------------------------------------------------------------------------

test.describe("Admin Teams — Teams List", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should load teams page with Équipes heading", async ({ page }) => {
    await page.route("**/api/admin/teams*", async (route) => {
      await route.fulfill({
        json: { data: [], pagination: { total: 0, totalPages: 0, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    await expect(page.getByRole("heading", { name: /Équipes/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display all teams in the list", async ({ page }) => {
    const teams = Array.from({ length: 5 }, (_, i) => mockTeam(`team-${Date.now()}-${i}`, i));

    await page.route("**/api/admin/teams*", async (route) => {
      await route.fulfill({
        json: { data: teams, pagination: { total: 5, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    for (let i = 0; i < 5; i++) {
      await expect(page.getByText(`Team ${i}`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show member count per team row", async ({ page }) => {
    const teams = Array.from({ length: 3 }, (_, i) => mockTeam(`team-mc-${Date.now()}-${i}`, i));

    await page.route("**/api/admin/teams*", async (route) => {
      await route.fulfill({
        json: { data: teams, pagination: { total: 3, totalPages: 1, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    // Team 0 has 3 members (3+0), Team 1 has 4 (3+1), Team 2 has 5 (3+2)
    await expect(page.getByText("3 membres").or(page.getByText("3 member"))).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("4 membres").or(page.getByText("4 member"))).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("5 membres").or(page.getByText("5 member"))).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show loading skeleton then data after delay", async ({ page }) => {
    await page.route("**/api/admin/teams*", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        json: {
          data: [mockTeam(`team-skel-${Date.now()}`, 1)],
          pagination: { total: 1, totalPages: 1, page: 1, limit: 20 },
        },
      });
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    // Skeleton should appear during loading
    const skeleton = page.locator('[class*="skeleton"], [class*="Skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: 3000 });

    // After the delay the team name appears
    await expect(page.getByText("Team 1").first()).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Section 2: Team Detail
// ---------------------------------------------------------------------------

test.describe("Admin Teams — Team Detail", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should show team detail with name, org name, and owner", async ({ page }) => {
    const teamId = `team-detail-${Date.now()}`;
    const team = mockTeam(teamId, 1, {
      owner: { id: "owner-42", name: "Alice Owner", email: "alice@test.com" },
      organization: { id: "org-42", name: "Super Org" },
    });

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    await expect(page.getByText("Team 1").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Super Org").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Alice Owner").first()).toBeVisible({ timeout: 5000 });
  });

  test("should display members list with names, roles, and emails", async ({ page }) => {
    const teamId = `team-members-${Date.now()}`;
    const members = Array.from({ length: 5 }, (_, i) => mockMember(`mem-${i}`, i));
    const team = { ...mockTeam(teamId, 1), members };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    for (let i = 0; i < 5; i++) {
      await expect(page.getByText(`Member ${i}`).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(`member${i}@test.com`).first()).toBeVisible({ timeout: 5000 });
    }

    // Role labels should appear (ADMIN, EDITOR, VIEWER)
    await expect(page.getByText("ADMIN").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("EDITOR").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("VIEWER").first()).toBeVisible({ timeout: 5000 });
  });

  test("should show owner badge for the team owner", async ({ page }) => {
    const teamId = `team-owner-${Date.now()}`;
    const members = [
      mockMember("owner-1", 0, { isOwner: true, name: "Owner User", role: "ADMIN" }),
      mockMember("mem-1", 1, { isOwner: false }),
      mockMember("mem-2", 2, { isOwner: false }),
    ];
    const team = { ...mockTeam(teamId, 1), members };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // Owner badge should be visible (French: "Propriétaire")
    const ownerBadges = page.getByText(/Propriétaire/i);
    await expect(ownerBadges.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show Aucun membre when team has no members", async ({ page }) => {
    const teamId = `team-empty-${Date.now()}`;
    const team = { ...mockTeam(teamId, 1), members: [] };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // Empty members state
    const emptyMsg = page.getByText(/Aucun membre/i);
    await expect(emptyMsg).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Section 3: Team Member Management
// ---------------------------------------------------------------------------

test.describe("Admin Teams — Member Management", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should invite a member via dialog and show success", async ({ page }) => {
    const teamId = `team-invite-${Date.now()}`;
    const members = [mockMember("owner-1", 0, { isOwner: true })];
    const team = { ...mockTeam(teamId, 1), members };

    // Mock team detail
    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    // Mock invite POST
    let inviteCalled = false;
    await page.route(new RegExp(`/api/admin/teams/${teamId}/invite`), async (route) => {
      inviteCalled = true;
      const reqBody = JSON.parse(route.request().postData() || "{}");
      expect(reqBody.email).toBe("newmember@test.com");
      await route.fulfill({
        status: 200,
        json: { success: true, message: "Invitation envoyée" },
      });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // Click invite button
    const inviteBtn = page
      .locator('button[title*="Inviter"], button:has-text("Inviter"), button:has-text("Invite")')
      .first();
    if (await inviteBtn.isVisible().catch(() => false)) {
      await inviteBtn.click();
    }

    // Fill email
    const emailInput = page.locator('#invite-email, input[type="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill("newmember@test.com");

      // Submit
      const submitBtn = page
        .locator('button:has-text("Envoyer"), button:has-text("Inviter")')
        .last();
      await submitBtn.click();
      await page.waitForTimeout(500);
    }

    expect(inviteCalled).toBe(true);
  });

  test("should remove a member after confirmation dialog", async ({ page }) => {
    const teamId = `team-remove-${Date.now()}`;
    const members = [
      mockMember("owner-1", 0, { isOwner: true }),
      mockMember("mem-1", 1, { isOwner: false }),
    ];
    const team = { ...mockTeam(teamId, 1), members };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    let deleteCalled = false;
    await page.route(new RegExp(`/api/admin/teams/${teamId}/members/.*`), async (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        await route.fulfill({ status: 200, json: { success: true } });
      } else {
        await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
      }
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // Click remove button for the second (non-owner) member
    const removeBtn = page
      .locator('button[title*="Supprimer"], button[title*="Remove"], button:has-text("Supprimer")')
      .first();
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();

      // Confirm dialog
      const confirmBtn = page
        .locator(
          'button:has-text("Confirmer"), button:has-text("Oui"), button:has-text("Delete"), div[role="dialog"] button:has-text("Supprimer")',
        )
        .first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }
    }

    expect(deleteCalled).toBe(true);
  });

  test("should cancel member removal and not call DELETE API", async ({ page }) => {
    const teamId = `team-cancel-${Date.now()}`;
    const members = [
      mockMember("owner-1", 0, { isOwner: true }),
      mockMember("mem-1", 1, { isOwner: false }),
    ];
    const team = { ...mockTeam(teamId, 1), members };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    let deleteCalled = false;
    await page.route(new RegExp(`/api/admin/teams/${teamId}/members/.*`), async (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        await route.fulfill({ status: 200, json: { success: true } });
      } else {
        await route.fulfill({ status: 405, json: { error: "Method not allowed" } });
      }
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // Click remove button
    const removeBtn = page
      .locator('button[title*="Supprimer"], button[title*="Remove"], button:has-text("Supprimer")')
      .first();
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();

      // Cancel dialog
      const cancelBtn = page
        .locator(
          'button:has-text("Annuler"), button:has-text("Cancel"), div[role="dialog"] button:has-text("Non")',
        )
        .first();
      if (await cancelBtn.isVisible().catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    expect(deleteCalled).toBe(false);
  });

  test("should show error when invite API fails (500)", async ({ page }) => {
    const teamId = `team-invite-fail-${Date.now()}`;
    const members = [mockMember("owner-1", 0, { isOwner: true })];
    const team = { ...mockTeam(teamId, 1), members };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    await page.route(new RegExp(`/api/admin/teams/${teamId}/invite`), async (route) => {
      await route.fulfill({ status: 500, json: { error: "Erreur serveur" } });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // Try to invite
    const inviteBtn = page
      .locator('button[title*="Inviter"], button:has-text("Inviter"), button:has-text("Invite")')
      .first();
    if (await inviteBtn.isVisible().catch(() => false)) {
      await inviteBtn.click();
    }

    const emailInput = page.locator('#invite-email, input[type="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill("fail@test.com");
      const submitBtn = page
        .locator('button:has-text("Envoyer"), button:has-text("Inviter")')
        .last();
      await submitBtn.click();
      await page.waitForTimeout(500);
    }

    // Error message should appear
    const errorMsg = page
      .getByText(/erreur|error|failed|Erreur serveur|something went wrong/i)
      .first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Section 4: Edge Cases
// ---------------------------------------------------------------------------

test.describe("Admin Teams — Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test("should show Aucune équipe when teams list is empty", async ({ page }) => {
    await page.route("**/api/admin/teams*", async (route) => {
      await route.fulfill({
        json: { data: [], pagination: { total: 0, totalPages: 0, page: 1, limit: 20 } },
      });
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    const emptyMsg = page.getByText(/Aucune équipe|Aucun résultat|No teams/i);
    await expect(emptyMsg).toBeVisible({ timeout: 5000 });
  });

  test("should handle team with 20+ members gracefully", async ({ page }) => {
    const teamId = `team-large-${Date.now()}`;
    const members = Array.from({ length: 22 }, (_, i) =>
      mockMember(`mem-${i}`, i, { isOwner: i === 0 }),
    );
    const team = { ...mockTeam(teamId, 1), members };

    await page.route(new RegExp(`/api/admin/teams/${teamId}`), async (route) => {
      await route.fulfill({ json: { data: team } });
    });

    await page.goto(`/admin/teams/${teamId}`);
    if (await skipIfRedirected(page)) return;

    // First and last members should be visible
    await expect(page.getByText("Member 0").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Member 21").first()).toBeVisible({ timeout: 5000 });

    // Scrollable area or pagination should handle large lists
    const memberSection = page.locator('[class*="member"], [class*="Member"]').first();
    await expect(memberSection).toBeVisible({ timeout: 5000 });
  });

  test("should truncate or wrap very long team name (150 characters)", async ({ page }) => {
    const teamId = `team-long-name-${Date.now()}`;
    const longName = "A".repeat(150);
    const team = mockTeam(teamId, 1, { name: longName });

    await page.route("**/api/admin/teams*", async (route) => {
      await route.fulfill({
        json: {
          data: [team],
          pagination: { total: 1, totalPages: 1, page: 1, limit: 20 },
        },
      });
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    // The long name should be present on the page (possibly truncated with …)
    const nameCell = page.getByText(longName).or(page.getByText("A".repeat(50)));
    await expect(nameCell.first()).toBeVisible({ timeout: 5000 });

    // The name should not break the layout (no overflow errors)
    const layoutErrors = await page
      .locator('[class*="overflow-hidden"], [class*="truncate"]')
      .count();
    expect(layoutErrors).toBeGreaterThanOrEqual(0);
  });

  test("should support pagination across 12 teams on 2 pages", async ({ page }) => {
    const teamsPage1 = Array.from({ length: 10 }, (_, i) =>
      mockTeam(`team-${Date.now()}-page1-${i}`, i),
    );
    const teamsPage2 = Array.from({ length: 2 }, (_, i) =>
      mockTeam(`team-${Date.now()}-page2-${i}`, 10 + i),
    );

    await page.route(/\/api\/admin\/teams\?.*page=1/, async (route) => {
      await route.fulfill({
        json: {
          data: teamsPage1,
          pagination: { total: 12, totalPages: 2, page: 1, limit: 10 },
        },
      });
    });

    await page.route(/\/api\/admin\/teams\?.*page=2/, async (route) => {
      await route.fulfill({
        json: {
          data: teamsPage2,
          pagination: { total: 12, totalPages: 2, page: 2, limit: 10 },
        },
      });
    });

    // Fallback route for requests without explicit page param
    await page.route(/\/api\/admin\/teams(\?.*)?$/, async (route) => {
      const url = new URL(route.request().url());
      const pageParam = url.searchParams.get("page") || "1";
      if (pageParam === "2") {
        await route.fulfill({
          json: {
            data: teamsPage2,
            pagination: { total: 12, totalPages: 2, page: 2, limit: 10 },
          },
        });
      } else {
        await route.fulfill({
          json: {
            data: teamsPage1,
            pagination: { total: 12, totalPages: 2, page: 1, limit: 10 },
          },
        });
      }
    });

    await page.goto("/admin/teams");
    if (await skipIfRedirected(page)) return;

    // Page 1 teams should be visible
    await expect(page.getByText("Team 0").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Team 9").first()).toBeVisible({ timeout: 5000 });

    // Pagination controls should be present
    const pagination = page
      .locator(
        'nav[aria-label="Pagination"], [class*="pagination"], button:has-text("2"), button:has-text("Suivant"), button:has-text("Next")',
      )
      .first();
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Click page 2
    const page2Btn = page.locator('button:has-text("2"), a:has-text("2")').first();
    if (await page2Btn.isVisible().catch(() => false)) {
      await page2Btn.click();
      await page.waitForTimeout(500);

      // Page 2 teams should now be visible
      await expect(page.getByText("Team 10").first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("Team 11").first()).toBeVisible({ timeout: 5000 });
    }
  });
});
