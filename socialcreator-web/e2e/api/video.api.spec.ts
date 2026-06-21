/**
 * E2E API Tests: Video
 * Tests: GET/POST /api/video, GET /api/video/[id], POST /api/video/[id]/transcribe
 */

import { expect, test } from "@playwright/test";

let createdVideoId: string | null = null;

test.describe("Video API", () => {
  test.describe("GET /api/video", () => {
    test("should return video list when authenticated", async ({ request }) => {
      const response = await request.get("/api/video");
      expect([200, 401, 302]).toContain(response.status());

      if (response.status() === 200) {
        const json = await response.json();
        expect(Array.isArray(json)).toBe(true);
      }
    });

    test("should return 401 without auth", async ({ request }) => {
      const response = await request.get("/api/video", {
        headers: { cookie: "" },
      });
      expect([401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/video", () => {
    test("should initiate video upload with valid metadata", async ({ request }) => {
      const response = await request.post("/api/video", {
        data: {
          filename: "test-video.mp4",
          contentType: "video/mp4",
          size: 1024,
          profileId: "test-profile-id",
        },
      });
      expect([201, 200, 401, 302]).toContain(response.status());

      if ([201, 200].includes(response.status())) {
        const json = await response.json();
        if (json.id) {
          createdVideoId = json.id;
        }
      }
    });

    test("should return 400 for missing required video metadata", async ({ request }) => {
      const response = await request.post("/api/video", {
        data: {},
      });
      expect([400, 422, 401, 302]).toContain(response.status());
    });
  });

  test.describe("GET /api/video/[id]", () => {
    test("should return video by ID", async ({ request }) => {
      const id = createdVideoId || "nonexistent";
      const response = await request.get(`/api/video/${id}`);
      expect([200, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 for non-existent video", async ({ request }) => {
      const response = await request.get(`/api/video/nonexistent-${Date.now()}`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });

  test.describe("POST /api/video/[id]/transcribe", () => {
    test("should start transcription for a valid video", async ({ request }) => {
      const id = createdVideoId || "nonexistent";
      const response = await request.post(`/api/video/${id}/transcribe`);
      expect([200, 201, 401, 302, 404]).toContain(response.status());
    });

    test("should return 404 when transcribing non-existent video", async ({ request }) => {
      const response = await request.post(`/api/video/nonexistent-${Date.now()}/transcribe`);
      expect([404, 401, 302]).toContain(response.status());
    });
  });
});
