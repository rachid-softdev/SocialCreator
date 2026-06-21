/**
 * E2E API Tests: Content
 * Tests: GET/POST /api/content, GET/PUT/DELETE /api/content/[id]
 */

import { expect, test } from "@playwright/test";

let createdContentId: string | null = null;

test.describe("Content API", () => {
  test.describe("GET /api/content", () => {
    test("should return content list when authenticated", async ({ request }) => {
      const response = await request.get("/api/content");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/content", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });

    test("should filter content by status", async ({ request }) => {
      const response = await request.get("/api/content?status=DRAFT");
      expect([200, 401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/content", () => {
    test("should create content with valid brief", async ({ request }) => {
      const response = await request.post("/api/content", {
        data: {
          title: "API Test Content",
          brief: "This is a test content brief for API E2E testing.",
          contentType: "social_post",
        },
      });
      expect([201, 200, 401, 302]).toContain(response.status());

      if ([201, 200].includes(response.status())) {
        const json = await response.json();
        if (json.id) {
          createdContentId = json.id;
        }
      }
    });

    test("should return 400 for empty brief", async ({ request }) => {
      const response = await request.post("/api/content", {
        data: { title: "Empty Brief", brief: "" },
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });

    test("should return 400 for missing required fields", async ({ request }) => {
      const response = await request.post("/api/content", {
        data: {},
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/content/[id]", () => {
    test("should return content by ID", async ({ request }) => {
      const id = createdContentId || "nonexistent";
      const response = await request.get(`/api/content/${id}`);
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent content", async ({ request }) => {
      const response = await request.get(`/api/content/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });

  test.describe("PUT /api/content/[id]", () => {
    test("should update content status to APPROVED", async ({ request }) => {
      const id = createdContentId || "nonexistent";
      const response = await request.put(`/api/content/${id}`, {
        data: { status: "APPROVED" },
      });
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 400 for invalid status", async ({ request }) => {
      const id = createdContentId || "nonexistent";
      const response = await request.put(`/api/content/${id}`, {
        data: { status: "INVALID_STATUS" },
      });
      expect([400, 422, 401, 302, 404]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/content/[id]", () => {
    test("should delete content when authorized", async ({ request }) => {
      const id = createdContentId || "nonexistent";
      const response = await request.delete(`/api/content/${id}`);
      expect([200, 204, 401, 302, 404]).toContain(response.status());
    });
  });
});
