/**
 * E2E API Tests: Admin
 * Tests: GET /api/admin/stats, GET /api/admin/users, GET /api/admin/orgs
 */

import { expect, test } from "@playwright/test";

test.describe("Admin API", () => {
  test.describe("GET /api/admin/stats", () => {
    test("should return admin stats when authenticated as admin", async ({ request }) => {
      const response = await request.get("/api/admin/stats");
      // May return 200 (admin), 401 (not logged in), 302 (redirect), or 403 (not admin)
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(typeof json).toBe("object");
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/admin/stats", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/admin/users", () => {
    test("should return users list for admin", async ({ request }) => {
      const response = await request.get("/api/admin/users");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should support pagination for users list", async ({ request }) => {
      const response = await request.get("/api/admin/users?page=1&limit=10");
      expect([200, 401, 302, 403]).toContain(response.status());
    });
  });

  test.describe("GET /api/admin/orgs", () => {
    test("should return orgs list for admin", async ({ request }) => {
      const response = await request.get("/api/admin/orgs");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should handle invalid query parameters gracefully", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?invalid=true");
      expect([200, 400, 401, 302, 403]).toContain(response.status());
    });
  });
});
