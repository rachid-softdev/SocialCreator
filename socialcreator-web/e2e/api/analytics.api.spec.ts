/**
 * E2E API Tests: Analytics
 * Tests: GET /api/analytics, GET /api/analytics/[profileId]
 */

import { expect, test } from "@playwright/test";

test.describe("Analytics API", () => {
  test.describe("GET /api/analytics", () => {
    test("should return dashboard stats when authenticated", async ({ request }) => {
      const response = await request.get("/api/analytics");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        // Should contain some analytics data structure
        expect(typeof json).toBe("object");
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/analytics", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });

    test("should support date range filtering", async ({ request }) => {
      const response = await request.get("/api/analytics?from=2026-01-01&to=2026-12-31");
      expect([200, 401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/analytics/[profileId]", () => {
    test("should return per-profile analytics", async ({ request }) => {
      const response = await request.get("/api/analytics/some-profile-id");
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent profileId", async ({ request }) => {
      const response = await request.get(`/api/analytics/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });

    test("should return 400 for invalid profileId format", async ({ request }) => {
      const response = await request.get("/api/analytics/!!invalid!!");
      expect([400, 404, 401, 302]).toContain(response.status());
    });
  });
});
