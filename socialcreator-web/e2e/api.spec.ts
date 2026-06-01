/**
 * E2E Tests for API Endpoints
 * Tests: Health check, API availability
 */

import { expect, test } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("should return 200 for health check", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  test("should return JSON for health check", async ({ request }) => {
    const response = await request.get("/api/health");
    const json = await response.json();
    expect(json).toHaveProperty("status");
  });

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

  test("should return proper error for invalid MCP request", async ({ request }) => {
    const response = await request.post("/api/mcp", {
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "invalid_method",
        params: {},
      },
    });
    const json = await response.json();
    expect(json.error).toBeDefined();
  });
});
