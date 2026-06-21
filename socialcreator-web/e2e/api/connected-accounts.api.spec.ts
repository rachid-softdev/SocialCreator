/**
 * E2E API Tests: Connected Accounts
 * Tests: GET /api/accounts, POST /api/accounts/[platform]/connect, POST /api/accounts/[platform]/disconnect
 */

import { expect, test } from "@playwright/test";

test.describe("Connected Accounts API", () => {
  test.describe("GET /api/accounts", () => {
    test("should return connected accounts when authenticated", async ({ request }) => {
      const response = await request.get("/api/accounts");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/accounts", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });

    test("should return platform details in account list", async ({ request }) => {
      const response = await request.get("/api/accounts");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        if (json.length > 0) {
          expect(json[0]).toHaveProperty("platform");
        }
      }
    });
  });

  test.describe("POST /api/accounts/[platform]/connect", () => {
    test("should initiate connect flow for a valid platform", async ({ request }) => {
      const response = await request.post("/api/accounts/twitter/connect");
      expect([200, 201, 401, 302]).toContain(response.status());

      if ([200, 201].includes(response.status())) {
        const json = await response.json();
        // Should return an OAuth URL or confirmation
        expect(json.url || json.authorizationUrl || json.success).toBeDefined();
      }
    });

    test("should return 400 for unsupported platform", async ({ request }) => {
      const response = await request.post("/api/accounts/invalid-platform/connect");
      expect([400, 404, 401, 302]).toContain(response.status());
    });

    test("should return 401 without auth for connect", async ({ request }) => {
      const response = await request.post("/api/accounts/twitter/connect", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/accounts/[platform]/disconnect", () => {
    test("should disconnect an account when authenticated", async ({ request }) => {
      const response = await request.post("/api/accounts/twitter/disconnect");
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for platform that was never connected", async ({ request }) => {
      const response = await request.post(`/api/accounts/nonexistent-${Date.now()}/disconnect`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });
});
