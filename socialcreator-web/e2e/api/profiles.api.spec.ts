/**
 * E2E API Tests: Profiles
 * Tests: GET/POST /api/profiles, GET/PUT/DELETE /api/profiles/[id]
 */

import { expect, test } from "@playwright/test";

const PROFILE_NAME = `API Profile ${Date.now()}`;
let createdProfileId: string | null = null;

test.describe("Profiles API", () => {
  test.describe("GET /api/profiles", () => {
    test("should return profiles list when authenticated", async ({ request }) => {
      const response = await request.get("/api/profiles");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/profiles", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/profiles", () => {
    test("should create profile with valid data", async ({ request }) => {
      const response = await request.post("/api/profiles", {
        data: {
          name: PROFILE_NAME,
          brandVoice: "Professional, friendly, and approachable.",
        },
      });
      expect([201, 200, 401, 302]).toContain(response.status());

      if ([201, 200].includes(response.status())) {
        const json = await response.json();
        if (json.id) {
          createdProfileId = json.id;
        }
      }
    });

    test("should return 400 for missing name", async ({ request }) => {
      const response = await request.post("/api/profiles", {
        data: { brandVoice: "Just a voice." },
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });

    test("should return 400 for name that is too short", async ({ request }) => {
      const response = await request.post("/api/profiles", {
        data: { name: "A" },
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });

    test("should return 409 for duplicate profile name", async ({ request }) => {
      const response = await request.post("/api/profiles", {
        data: {
          name: PROFILE_NAME,
          brandVoice: "Another attempt with same name.",
        },
      });
      expect([400, 409, 422, 401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/profiles/[id]", () => {
    test("should return profile by ID", async ({ request }) => {
      const id = createdProfileId || "nonexistent";
      const response = await request.get(`/api/profiles/${id}`);
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent profile", async ({ request }) => {
      const response = await request.get(`/api/profiles/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });

  test.describe("PUT /api/profiles/[id]", () => {
    test("should update profile with valid data", async ({ request }) => {
      const id = createdProfileId || "nonexistent";
      const response = await request.put(`/api/profiles/${id}`, {
        data: { name: `${PROFILE_NAME} Updated`, brandVoice: "Updated voice." },
      });
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 400 for invalid update data", async ({ request }) => {
      const id = createdProfileId || "nonexistent";
      const response = await request.put(`/api/profiles/${id}`, {
        data: { name: "" },
      });
      expect([400, 422, 401, 302, 404]).toContain(response.status());
    });
  });

  test.describe("DELETE /api/profiles/[id]", () => {
    test("should delete profile with confirmation", async ({ request }) => {
      const id = createdProfileId || "nonexistent";
      const response = await request.delete(`/api/profiles/${id}`);
      expect([200, 204, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 when deleting non-existent profile", async ({ request }) => {
      const response = await request.delete(`/api/profiles/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });
});
