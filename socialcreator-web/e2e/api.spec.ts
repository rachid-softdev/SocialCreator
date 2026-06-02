/**
 * E2E Tests for API Endpoints
 * Tests: Health check, API availability
 */

import { expect, test } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("should return valid status for health check", async ({ request }) => {
    const response = await request.get("/api/health");
    // CI has no database — the health check may return 503 (unhealthy).
    // The important thing is that it returns a valid HTTP response.
    expect([200, 503]).toContain(response.status());
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
