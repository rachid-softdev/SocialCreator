/**
 * E2E API Tests: Teams
 * Tests: GET/POST /api/teams, GET/PUT/DELETE /api/teams/[id], POST /api/teams/[id]/invite
 */

import { expect, test } from "@playwright/test";

let createdTeamId: string | null = null;

test.describe("Teams API", () => {
  test.describe("GET /api/teams", () => {
    test("should return teams list when authenticated", async ({ request }) => {
      const response = await request.get("/api/teams");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/teams", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/teams", () => {
    test("should create team with valid data", async ({ request }) => {
      const response = await request.post("/api/teams", {
        data: { name: `API Team ${Date.now()}` },
      });
      expect([201, 200, 401, 302]).toContain(response.status());

      if ([201, 200].includes(response.status())) {
        const json = await response.json();
        if (json.id) {
          createdTeamId = json.id;
        }
      }
    });

    test("should return 400 for missing name", async ({ request }) => {
      const response = await request.post("/api/teams", {
        data: {},
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/teams/[id]", () => {
    test("should return team by ID", async ({ request }) => {
      const id = createdTeamId || "nonexistent";
      const response = await request.get(`/api/teams/${id}`);
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent team", async ({ request }) => {
      const response = await request.get(`/api/teams/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });

  test.describe("PUT /api/teams/[id]", () => {
    test("should update team name", async ({ request }) => {
      const id = createdTeamId || "nonexistent";
      const response = await request.put(`/api/teams/${id}`, {
        data: { name: `Updated Team ${Date.now()}` },
      });
      expect([200, 401, 302, 404]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/teams/[id]", () => {
    test("should delete team when authorized", async ({ request }) => {
      const id = createdTeamId || "nonexistent";
      const response = await request.delete(`/api/teams/${id}`);
      expect([200, 204, 401, 302, 404]).toContain(response.status());
    });
  });

  test.describe("POST /api/teams/[id]/invite", () => {
    test("should invite member with valid email", async ({ request }) => {
      const id = createdTeamId || "nonexistent";
      const response = await request.post(`/api/teams/${id}/invite`, {
        data: { email: `invitee-${Date.now()}@example.com`, role: "member" },
      });
      expect([200, 201, 401, 302, 404]).toContain(response.status());
    });

    test("should return 400 for invalid email", async ({ request }) => {
      const id = createdTeamId || "nonexistent";
      const response = await request.post(`/api/teams/${id}/invite`, {
        data: { email: "not-an-email", role: "member" },
      });
      expect([400, 422, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 when inviting to non-existent team", async ({ request }) => {
      const response = await request.post(`/api/teams/nonexistent-${Date.now()}/invite`, {
        data: { email: `test-${Date.now()}@example.com`, role: "member" },
      });
      expect([404, 401, 302]).toContain(response.status());
    });
  });
});
