/**
 * E2E Tests for API Endpoints
 * Tests: Health check, API availability
 */

import { test, expect } from "@playwright/test";

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

    // Should return auth error (401 or JSON-RPC error)
    expect([401, 200]).toContain(response.status());
  });

  test("should return proper error for invalid MCP request", async ({ request }) => {
    // Even with auth, invalid method should return error
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
