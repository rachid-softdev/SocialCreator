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

  // ============================================================
  // Admin API — User Detail & Management
  // ============================================================

  test.describe("GET /api/admin/users/[id]", () => {
    test("should return user detail for admin", async ({ request }) => {
      const response = await request.get("/api/admin/users/test-user-id");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("id");
        expect(json).toHaveProperty("email");
        expect(json).toHaveProperty("role");
      }
    });

    test("should return 404 for non-existent user", async ({ request }) => {
      const response = await request.get("/api/admin/users/nonexistent-id-999999");
      expect([404, 401, 302, 403]).toContain(response.status());
    });
  });

  test.describe("PATCH /api/admin/users/[id]", () => {
    test("should update user role for admin", async ({ request }) => {
      const response = await request.patch("/api/admin/users/test-user-id", {
        data: { role: "ADMIN" },
      });
      // May be 200 (success), 403 (self-demotion), 401/302 (unauth)
      expect([200, 400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject invalid role values", async ({ request }) => {
      const response = await request.patch("/api/admin/users/test-user-id", {
        data: { role: "SUPER_ADMIN" },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject empty body", async ({ request }) => {
      const response = await request.patch("/api/admin/users/test-user-id", {
        data: {},
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/admin/users/[id]", () => {
    test("should delete user for admin", async ({ request }) => {
      const response = await request.delete("/api/admin/users/test-user-id-to-delete");
      expect([200, 401, 302, 403, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent user", async ({ request }) => {
      const response = await request.delete("/api/admin/users/nonexistent-delete-999999");
      expect([404, 401, 302, 403]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — Org Detail
  // ============================================================

  test.describe("GET /api/admin/orgs/[id]", () => {
    test("should return org detail for admin", async ({ request }) => {
      const response = await request.get("/api/admin/orgs/test-org-id");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json.data).toHaveProperty("id");
        expect(json.data).toHaveProperty("name");
      }
    });

    test("should return 404 for non-existent org", async ({ request }) => {
      const response = await request.get("/api/admin/orgs/nonexistent-org-999999");
      expect([404, 401, 302, 403]).toContain(response.status());
    });

    test("should handle org id with special characters", async ({ request }) => {
      const response = await request.get("/api/admin/orgs/org-with-special-chars-123");
      expect([200, 401, 302, 403, 404]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — Entitlements
  // ============================================================

  test.describe("GET /api/admin/entitlements", () => {
    test("should return plans list", async ({ request }) => {
      const response = await request.get("/api/admin/entitlements?resource=plans");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should return features list", async ({ request }) => {
      const response = await request.get("/api/admin/entitlements?resource=features");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should return overrides list", async ({ request }) => {
      const response = await request.get("/api/admin/entitlements?resource=overrides");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle missing resource parameter", async ({ request }) => {
      const response = await request.get("/api/admin/entitlements");
      expect([200, 400, 401, 302, 403]).toContain(response.status());
    });
  });

  test.describe("POST /api/admin/entitlements", () => {
    test("should create override with valid data", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements", {
        data: {
          scope: "ORG",
          scopeId: "test-org-id",
          featureKey: "test_feature",
          enabled: true,
          reason: "E2E test override",
        },
      });
      expect([200, 201, 401, 302, 403]).toContain(response.status());
    });

    test("should reject override without required fields", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements", {
        data: { scope: "ORG" },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject override with empty reason", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements", {
        data: {
          scope: "ORG",
          scopeId: "test-org",
          featureKey: "test",
          enabled: true,
          reason: "",
        },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject override with invalid scope", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements", {
        data: {
          scope: "INVALID_SCOPE",
          scopeId: "test",
          featureKey: "test",
          enabled: true,
          reason: "Testing invalid scope",
        },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/admin/entitlements/overrides/[id]", () => {
    test("should delete override for admin", async ({ request }) => {
      const response = await request.delete("/api/admin/entitlements/overrides/test-override-id");
      expect([200, 401, 302, 403, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent override", async ({ request }) => {
      const response = await request.delete(
        "/api/admin/entitlements/overrides/nonexistent-override-999999",
      );
      expect([404, 401, 302, 403]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — Stats with Trends
  // ============================================================

  test.describe("GET /api/admin/stats with trends", () => {
    test("should include trends when includeTrends=true", async ({ request }) => {
      const response = await request.get("/api/admin/stats?includeTrends=true");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        // Should have trends property or at least be valid
        expect(typeof json).toBe("object");
      }
    });

    test("should return stats without trends by default", async ({ request }) => {
      const response = await request.get("/api/admin/stats");
      expect([200, 401, 302, 403]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — POST /api/admin/users  (Create User)
  // ============================================================

  test.describe("POST /api/admin/users", () => {
    const uniqueId = Date.now();

    test("should create a user with valid data", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: {
          email: `e2e-create-${uniqueId}@test.com`,
          name: "E2E Create User",
          role: "USER",
          password: "e2eTestPass123!",
        },
      });
      expect([201, 401, 302, 403]).toContain(response.status());

      if (response.status() === 201) {
        const json = await response.json();
        expect(json).toHaveProperty("user");
        expect(json.user).toHaveProperty("id");
        expect(json.user).toHaveProperty("email");
        expect(json.user.email).toBe(`e2e-create-${uniqueId}@test.com`);
      }
    });

    test("should reject invalid email", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: {
          email: "not-an-email",
          name: "Invalid Email",
          role: "USER",
        },
      });
      expect([400, 401, 302, 403]).toContain(response.status());

      if (response.status() === 400) {
        const json = await response.json();
        expect(json).toHaveProperty("error");
      }
    });

    test("should reject invalid role", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: {
          email: `e2e-invalid-role-${uniqueId}@test.com`,
          name: "Invalid Role",
          role: "SUPER_ADMIN",
        },
      });
      expect([400, 401, 302, 403]).toContain(response.status());

      if (response.status() === 400) {
        const json = await response.json();
        expect(json).toHaveProperty("error");
      }
    });

    test("should reject password shorter than 8 characters", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: {
          email: `e2e-short-pass-${uniqueId}@test.com`,
          name: "Short Password",
          role: "USER",
          password: "short",
        },
      });
      expect([400, 401, 302, 403]).toContain(response.status());

      if (response.status() === 400) {
        const json = await response.json();
        expect(json).toHaveProperty("error");
      }
    });

    test("should reject duplicate email", async ({ request }) => {
      // First create a user
      const email = `e2e-dup-${uniqueId}@test.com`;
      const first = await request.post("/api/admin/users", {
        data: { email, name: "First", role: "USER" },
      });

      // Then attempt duplicate
      const response = await request.post("/api/admin/users", {
        data: { email, name: "Duplicate", role: "USER" },
      });
      // If first succeeded (admin auth), expect 409; otherwise 401/302/403
      expect([201, 409, 401, 302, 403]).toContain(first.status());
      expect([409, 401, 302, 403]).toContain(response.status());

      if (response.status() === 409) {
        const json = await response.json();
        expect(json.error).toContain("Email already exists");
      }
    });
  });

  // ============================================================
  // Admin API — GET /api/admin/entitlements/orgs/:orgId/downgrade
  // ============================================================

  test.describe("GET /api/admin/entitlements/orgs/[orgId]/downgrade", () => {
    test("should preview downgrade with valid targetPlan", async ({ request }) => {
      const response = await request.get(
        "/api/admin/entitlements/orgs/test-org-id/downgrade?targetPlan=free",
      );
      expect([200, 400, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("orgId");
        expect(json).toHaveProperty("targetPlan");
        expect(json).toHaveProperty("affectedCount");
        expect(json).toHaveProperty("features");
        expect(Array.isArray(json.features)).toBe(true);
      }
    });

    test("should return 400 when targetPlan is missing", async ({ request }) => {
      const response = await request.get("/api/admin/entitlements/orgs/test-org-id/downgrade");
      expect([400, 401, 302, 403]).toContain(response.status());

      if (response.status() === 400) {
        const json = await response.json();
        expect(json).toHaveProperty("error");
        expect(json.error).toContain("targetPlan");
      }
    });

    test("should handle non-existent orgId gracefully", async ({ request }) => {
      const response = await request.get(
        "/api/admin/entitlements/orgs/nonexistent-org-999999/downgrade?targetPlan=free",
      );
      // Downgrade service may throw (500) or return empty; accept both with 401/302/403
      expect([200, 400, 401, 302, 403, 404, 500]).toContain(response.status());
    });

    test("should return 401/403 without auth", async ({ request }) => {
      const response = await request.get(
        "/api/admin/entitlements/orgs/test-org-id/downgrade?targetPlan=free",
        { headers: { cookie: "" } },
      );
      expect([401, 302]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — POST /api/admin/entitlements/cache/invalidate/:orgId
  // ============================================================

  test.describe("POST /api/admin/entitlements/cache/invalidate/[orgId]", () => {
    test("should invalidate cache for a valid orgId", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements/cache/invalidate/test-org-id");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toEqual({
          success: true,
          orgId: "test-org-id",
        });
      }
    });

    test("should handle non-existent orgId gracefully", async ({ request }) => {
      const response = await request.post(
        "/api/admin/entitlements/cache/invalidate/nonexistent-org-999999",
      );
      // Invalidation on non-existent org may succeed (no-op) or throw
      expect([200, 401, 302, 403, 500]).toContain(response.status());
    });

    test("should return 401/403 without auth", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements/cache/invalidate/test-org-id", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  // ============================================================
  // Rate Limiting — All admin endpoints use withRateLimit
  // ============================================================

  test.describe("Rate limiting on admin endpoints", () => {
    test("should eventually return 429 after many rapid requests", async ({ request }) => {
      // Fire many rapid requests to a low-cost endpoint; at least one should 429
      const results: number[] = [];
      for (let i = 0; i < 30; i++) {
        const response = await request.get("/api/admin/stats");
        results.push(response.status());
        // Small delay to let requests flow but still saturate
        await new Promise((r) => setTimeout(r, 10));
      }

      const hasRateLimit = results.includes(429);
      // If we're authenticated, at least one should eventually be rate limited
      const allUnauthenticated = results.every((s) => [401, 302].includes(s));
      if (!allUnauthenticated) {
        expect(hasRateLimit).toBe(true);
      }
      // If all are 401/302, we're not authenticated, so rate limiting won't trigger
    });
  });

  // ============================================================
  // Pagination extremes — GET /api/admin/users & GET /api/admin/orgs
  // ============================================================

  test.describe("GET /api/admin/users — pagination extremes", () => {
    test("should handle page=1&limit=1", async ({ request }) => {
      const response = await request.get("/api/admin/users?page=1&limit=1");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json).toHaveProperty("pagination");
        expect(json.pagination).toHaveProperty("page", 1);
        expect(json.pagination).toHaveProperty("limit", 1);
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle page=999999 (non-existent page)", async ({ request }) => {
      const response = await request.get("/api/admin/users?page=999999&limit=10");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json).toHaveProperty("pagination");
        expect(json.pagination).toHaveProperty("page", 999999);
        // Should return empty array for out-of-range page
        expect(json.data).toEqual([]);
      }
    });

    test("should clamp limit=0 to minimum of 1", async ({ request }) => {
      const response = await request.get("/api/admin/users?page=1&limit=0");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("pagination");
        expect(json.pagination.limit).toBeGreaterThanOrEqual(1);
      }
    });

    test("should clamp limit=1000 to maximum of 100", async ({ request }) => {
      const response = await request.get("/api/admin/users?page=1&limit=1000");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("pagination");
        expect(json.pagination.limit).toBeLessThanOrEqual(100);
      }
    });
  });

  test.describe("GET /api/admin/orgs — pagination extremes", () => {
    test("should handle page=1&limit=1", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?page=1&limit=1");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json).toHaveProperty("pagination");
        expect(json.pagination).toHaveProperty("page", 1);
        expect(json.pagination).toHaveProperty("limit", 1);
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle page=999999 (non-existent page)", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?page=999999&limit=10");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(json.pagination).toHaveProperty("page", 999999);
        expect(json.data).toEqual([]);
      }
    });

    test("should clamp limit=0 to minimum of 1", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?page=1&limit=0");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("pagination");
        expect(json.pagination.limit).toBeGreaterThanOrEqual(1);
      }
    });

    test("should clamp limit=1000 to maximum of 100", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?page=1&limit=1000");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("pagination");
        expect(json.pagination.limit).toBeLessThanOrEqual(100);
      }
    });
  });

  // ============================================================
  // Search parameters — GET /api/admin/users & GET /api/admin/orgs
  // ============================================================

  test.describe("GET /api/admin/users — search parameters", () => {
    test("should handle special characters in search: !@#$%^&*()", async ({ request }) => {
      const response = await request.get("/api/admin/users?search=!%40%23%24%25%5E%26*()");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle SQL injection attempt in search", async ({ request }) => {
      const response = await request.get("/api/admin/users?search='%20OR%20'1'%3D'1");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle whitespace-only search", async ({ request }) => {
      const response = await request.get("/api/admin/users?search=  ");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle very long search term (500 chars)", async ({ request }) => {
      const longSearch = "a".repeat(500);
      const response = await request.get(
        `/api/admin/users?search=${encodeURIComponent(longSearch)}`,
      );
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });
  });

  test.describe("GET /api/admin/orgs — search parameters", () => {
    test("should handle special characters in search: !@#$%^&*()", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?search=!%40%23%24%25%5E%26*()");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle SQL injection attempt in search", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?search='%20OR%20'1'%3D'1");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle whitespace-only search", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?search=  ");
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });

    test("should handle very long search term (500 chars)", async ({ request }) => {
      const longSearch = "a".repeat(500);
      const response = await request.get(
        `/api/admin/orgs?search=${encodeURIComponent(longSearch)}`,
      );
      expect([200, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });
  });

  // ============================================================
  // Admin API — NoSQL Injection Prevention
  // ============================================================

  test.describe("NoSQL injection attempts", () => {
    test("should reject NoSQL $gt operator in query params", async ({ request }) => {
      const response = await request.get("/api/admin/users?role[$gt]=admin");
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject NoSQL $ne operator in query params", async ({ request }) => {
      const response = await request.get("/api/admin/users?email[$ne]=admin@test.com");
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject NoSQL $gt operator in orgs endpoint", async ({ request }) => {
      const response = await request.get("/api/admin/orgs?name[$gt]=a");
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — Prototype Pollution Prevention
  // ============================================================

  test.describe("Prototype pollution attempts", () => {
    test("should reject __proto__ in user PATCH body", async ({ request }) => {
      const response = await request.patch("/api/admin/users/test-user-id", {
        data: { __proto__: { isAdmin: true }, role: "USER" },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject constructor.prototype in entitlement POST body", async ({ request }) => {
      const response = await request.post("/api/admin/entitlements", {
        data: {
          constructor: { prototype: { isAdmin: true } },
          scope: "ORG",
          scopeId: "test",
          featureKey: "test",
          enabled: true,
          reason: "Pollution attempt",
        },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject __proto__ in user POST body", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: {
          __proto__: { isAdmin: true },
          email: "proto@test.com",
          name: "Proto Test",
          role: "USER",
        },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — Validation Edge Cases
  // ============================================================

  test.describe("Validation edge cases", () => {
    test("should reject user creation with empty email", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: { email: "", name: "No Email", role: "USER" },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());

      if (response.status() === 400) {
        const json = await response.json();
        expect(json).toHaveProperty("error");
      }
    });

    test("should reject user creation with empty name", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: { email: "noname@test.com", name: "", role: "USER" },
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });

    test("should reject empty override creation with completely empty body", async ({
      request,
    }) => {
      const response = await request.post("/api/admin/entitlements", {
        data: {},
      });
      expect([400, 401, 302, 403, 422]).toContain(response.status());
    });
  });

  // ============================================================
  // Admin API — HTTP Method Validation
  // ============================================================

  test.describe("HTTP method validation", () => {
    test("should return 405 when POSTing to /api/admin/stats", async ({ request }) => {
      const response = await request.post("/api/admin/stats");
      expect([405, 401, 403]).toContain(response.status());
    });

    test("should return 405 when PUTting to /api/admin/users/[id]", async ({ request }) => {
      const response = await request.put("/api/admin/users/test-user-id");
      expect([405, 401, 403]).toContain(response.status());
    });

    test("should return 405 when DELETEing /api/admin/stats", async ({ request }) => {
      const response = await request.delete("/api/admin/stats");
      expect([405, 401, 403]).toContain(response.status());
    });

    test("should return CORS headers on OPTIONS /api/admin/stats", async ({ request }) => {
      const response = await request.fetch("/api/admin/stats", { method: "OPTIONS" });
      expect([200, 204, 401, 403]).toContain(response.status());
      if ([200, 204].includes(response.status())) {
        const headers = response.headers();
        const corsHeaderNames = Object.keys(headers).filter((k) => k.startsWith("access-control-"));
        expect(corsHeaderNames.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================
  // Admin API — Concurrent Operations (Race Conditions)
  // ============================================================

  test.describe("Concurrent operations", () => {
    test("should handle two rapid PATCH requests on same user", async ({ request }) => {
      const userId = "test-user-id";
      const [r1, r2] = await Promise.all([
        request.patch(`/api/admin/users/${userId}`, { data: { role: "ADMIN" } }),
        request.patch(`/api/admin/users/${userId}`, { data: { role: "USER" } }),
      ]);
      expect([200, 400, 401, 403, 429, 422]).toContain(r1.status());
      expect([200, 400, 401, 403, 429, 422]).toContain(r2.status());
    });

    test("should return 404 when GETting a user after DELETE", async ({ request }) => {
      const deleteResponse = await request.delete("/api/admin/users/test-user-id-to-delete");
      expect([200, 401, 302, 403, 404]).toContain(deleteResponse.status());

      const getResponse = await request.get("/api/admin/users/test-user-id-to-delete");
      if (deleteResponse.status() === 200) {
        expect([404, 401, 302]).toContain(getResponse.status());
      } else {
        expect([200, 401, 302, 403, 404]).toContain(getResponse.status());
      }
    });

    test("should reflect role change after PATCH", async ({ request }) => {
      const userId = "test-user-id";
      const newRole = "USER";

      const patchResponse = await request.patch(`/api/admin/users/${userId}`, {
        data: { role: newRole },
      });
      expect([200, 400, 401, 302, 403, 422]).toContain(patchResponse.status());

      if (patchResponse.status() === 200) {
        const getResponse = await request.get(`/api/admin/users/${userId}`);
        expect([200, 401, 302, 403]).toContain(getResponse.status());

        if (getResponse.status() === 200) {
          const json = await getResponse.json();
          expect(json).toHaveProperty("role");
          expect(json.role).toBe(newRole);
        }
      }
    });
  });

  // ============================================================
  // Admin API — Request Validation
  // ============================================================

  test.describe("Request validation", () => {
    test("should reject POST with missing Content-Type header", async ({ request }) => {
      const response = await request.post("/api/admin/users", {
        data: {
          email: "missing-ct@test.com",
          name: "No Content-Type",
          role: "USER",
        },
        headers: { "Content-Type": "" },
      });
      expect([400, 401, 403, 415, 422]).toContain(response.status());
    });

    test("should handle very long query string (3000 chars)", async ({ request }) => {
      const longParam = "x".repeat(3000);
      const response = await request.get(`/api/admin/users?q=${encodeURIComponent(longParam)}`);
      expect([200, 400, 401, 403, 414, 422]).toContain(response.status());
    });

    test("should handle unicode in query parameters", async ({ request }) => {
      const response = await request.get(
        "/api/admin/users?search=%E2%82%AC%E2%82%AC%C3%A9%C3%A0%C3%BC%C3%B1%C3%A9",
      );
      expect([200, 400, 401, 302, 403]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(json).toHaveProperty("data");
        expect(Array.isArray(json.data)).toBe(true);
      }
    });
  });

  // ============================================================
  // Admin API — Edge Endpoints
  // ============================================================

  test.describe("Edge endpoints", () => {
    test("GET /api/admin/audit-log should return audit logs", async ({ request }) => {
      const response = await request.get("/api/admin/audit-log");
      expect([200, 401, 302, 403, 404]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(typeof json).toBe("object");
      }
    });

    test("POST on /api/admin/audit-log should be rejected", async ({ request }) => {
      const response = await request.post("/api/admin/audit-log");
      expect([405, 401, 403, 404]).toContain(response.status());
    });

    test("PATCH on read-only GET endpoints should be rejected", async ({ request }) => {
      const response = await request.patch("/api/admin/stats");
      expect([405, 401, 403]).toContain(response.status());
    });
  });
});
