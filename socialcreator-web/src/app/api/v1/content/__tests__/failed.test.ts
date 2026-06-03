/**
 * Tests for GET /api/v1/content/failed
 *
 * Verifies:
 * - Happy path: returns filtered failed content for user
 * - Uses findByUserId with FAILED status for ownership enforcement
 * - Supports pagination (page, pageSize query params)
 * - Defaults to page=1, pageSize=20
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson, mockContentRepo, mockProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockContentRepo: { findByUserId: vi.fn() },
  mockProfileRepo: {},
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

vi.mock("@/lib/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (handler: (ctx: { userId: string; request: any }) => unknown) =>
      async (request: unknown) => {
        return handler({ userId: "test-user-id", request });
      },
  ),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    content: mockContentRepo,
    profile: mockProfileRepo,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { GET } from "../failed/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockFailedContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Failed post",
    mediaUrls: [],
    hashtags: [],
    status: "FAILED",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    scheduledPublishAt: null,
    runId: null,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/v1/content/failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should return failed content for the user with defaults", async () => {
      const contents = [makeMockFailedContent(), makeMockFailedContent({ id: "content-2" })];
      mockContentRepo.findByUserId.mockResolvedValue({
        contents,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const request = { url: "http://localhost/api/v1/content/failed" };
      const response = await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockContentRepo.findByUserId).toHaveBeenCalledWith("test-user-id", {
        status: "FAILED",
        page: 1,
        pageSize: 20,
      });
      expect(mockJson).toHaveBeenCalledWith(
        {
          contents,
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control": "private, no-store",
            "X-API-Version": "v1",
          }),
        }),
      );
      expect(response).toEqual({ status: 200 });
    });

    it("should pass pagination params from query string", async () => {
      mockContentRepo.findByUserId.mockResolvedValue({
        contents: [],
        total: 0,
        page: 2,
        pageSize: 10,
        totalPages: 0,
      });

      const request = { url: "http://localhost/api/v1/content/failed?page=2&pageSize=10" };
      await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockContentRepo.findByUserId).toHaveBeenCalledWith("test-user-id", {
        status: "FAILED",
        page: 2,
        pageSize: 10,
      });
    });
  });

  describe("empty results", () => {
    it("should return empty array when no failed content", async () => {
      mockContentRepo.findByUserId.mockResolvedValue({
        contents: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const request = { url: "http://localhost/api/v1/content/failed" };
      const response = await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockJson).toHaveBeenCalledWith(
        {
          contents: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        },
        expect.anything(),
      );
      expect(response).toEqual({ status: 200 });
    });
  });
});
