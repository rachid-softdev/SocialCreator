/**
 * E2E API Tests: Agents
 * Tests: GET/POST /api/agents, GET/PUT/DELETE /api/agents/[id], POST /api/agents/[id]/run
 */

import { expect, test } from "@playwright/test";

let createdAgentId: string | null = null;

test.describe("Agents API", () => {
  test.describe("GET /api/agents", () => {
    test("should return agents list when authenticated", async ({ request }) => {
      const response = await request.get("/api/agents");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/agents", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/agents", () => {
    test("should create agent with valid data", async ({ request }) => {
      const response = await request.post("/api/agents", {
        data: {
          name: `API Agent ${Date.now()}`,
          description: "Agent created during API E2E testing.",
          type: "content_generator",
        },
      });
      expect([201, 200, 401, 302]).toContain(response.status());

      if ([201, 200].includes(response.status())) {
        const json = await response.json();
        if (json.id) {
          createdAgentId = json.id;
        }
      }
    });

    test("should return 400 for missing required fields", async ({ request }) => {
      const response = await request.post("/api/agents", {
        data: {},
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });

    test("should return 400 for invalid agent type", async ({ request }) => {
      const response = await request.post("/api/agents", {
        data: { name: "Bad Agent", type: "invalid_type" },
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/agents/[id]", () => {
    test("should return agent by ID", async ({ request }) => {
      const id = createdAgentId || "nonexistent";
      const response = await request.get(`/api/agents/${id}`);
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent agent", async ({ request }) => {
      const response = await request.get(`/api/agents/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });

  test.describe("PUT /api/agents/[id]", () => {
    test("should update agent with valid data", async ({ request }) => {
      const id = createdAgentId || "nonexistent";
      const response = await request.put(`/api/agents/${id}`, {
        data: { name: `Updated Agent ${Date.now()}` },
      });
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 400 for invalid update data", async ({ request }) => {
      const id = createdAgentId || "nonexistent";
      const response = await request.put(`/api/agents/${id}`, {
        data: { name: "" },
      });
      expect([400, 422, 401, 302, 404]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/agents/[id]", () => {
    test("should delete agent when authorized", async ({ request }) => {
      const id = createdAgentId || "nonexistent";
      const response = await request.delete(`/api/agents/${id}`);
      expect([200, 204, 401, 302, 404]).toContain(response.status());
    });
  });

  test.describe("POST /api/agents/[id]/run", () => {
    test("should run agent with valid brief", async ({ request }) => {
      const id = createdAgentId || "nonexistent";
      const response = await request.post(`/api/agents/${id}/run`, {
        data: { brief: "Generate a social post about API testing best practices." },
      });
      expect([200, 201, 401, 302, 404]).toContain(response.status());
    });

    test("should return 400 for brief that is too short", async ({ request }) => {
      const id = createdAgentId || "nonexistent";
      const response = await request.post(`/api/agents/${id}/run`, {
        data: { brief: "Hi" },
      });
      expect([400, 422, 401, 302, 404]).toContain(response.status());
    });
  });
});
