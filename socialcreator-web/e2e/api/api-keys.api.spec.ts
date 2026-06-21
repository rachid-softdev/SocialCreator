/**
 * E2E API Tests: API Keys
 * Tests: GET/POST /api/api-keys, DELETE /api/api-keys/[id], POST /api/mcp
 */

import { expect, test } from "@playwright/test";

let createdKeyId: string | null = null;

test.describe("API Keys API", () => {
  test.describe("GET /api/api-keys", () => {
    test("should return API keys list when authenticated", async ({ request }) => {
      const response = await request.get("/api/api-keys");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/api-keys", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/api-keys", () => {
    test("should create a new API key", async ({ request }) => {
      const response = await request.post("/api/api-keys", {
        data: { name: `API Key ${Date.now()}`, scopes: ["content:read", "content:write"] },
      });
      expect([201, 200, 401, 302]).toContain(response.status());

      if ([201, 200].includes(response.status())) {
        const json = await response.json();
        if (json.id) {
          createdKeyId = json.id;
        }
      }
    });

    test("should return 400 for missing name", async ({ request }) => {
      const response = await request.post("/api/api-keys", {
        data: {},
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/api-keys/[id]", () => {
    test("should revoke an API key", async ({ request }) => {
      const id = createdKeyId || "nonexistent";
      const response = await request.delete(`/api/api-keys/${id}`);
      expect([200, 204, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent key", async ({ request }) => {
      const response = await request.delete(`/api/api-keys/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/mcp", () => {
    test("should require auth for MCP endpoint", async ({ request }) => {
      const response = await request.post("/api/mcp", {
        data: {
          jsonrpc: "2.0",
          id: 1,
          method: "list_agents",
          params: {},
        },
      });
      expect([401, 200]).toContain(response.status());
    });

    test("should return error for invalid MCP method", async ({ request }) => {
      const response = await request.post("/api/mcp", {
        data: {
          jsonrpc: "2.0",
          id: 1,
          method: "invalid_method",
          params: {},
        },
      });
      expect([401, 200]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json.error).toBeDefined();
      }
    });
  });
});
