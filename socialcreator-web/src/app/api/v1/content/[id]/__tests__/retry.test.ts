/**
 * Tests for POST /api/v1/content/:id/retry
 *
 * Verifies:
 * - Happy path: FAILED → APPROVED status transition and re-enqueue
 * - 400 when content ID is missing
 * - 400 when content is not FAILED
 * - 404 when content not found or not owned by user
 * - enqueueJob is called with high priority
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson, mockContentRepo, mockProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockContentRepo: { findById: vi.fn(), resetToApproved: vi.fn() },
  mockProfileRepo: { findById: vi.fn() },
}));

const { mockEnqueueJob } = vi.hoisted(() => ({
  mockEnqueueJob: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

vi.mock("@/lib/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (handler: (ctx: { userId: string }, params?: Record<string, string>) => unknown) =>
      async (_request: unknown, context?: { params?: Record<string, string> }) => {
        const params = context?.params ?? {};
        return handler({ userId: "test-user-id" }, params);
      },
  ),
}));

vi.mock("@/lib/api-errors", () => ({
  badRequest: vi.fn((msg: string) => ({ status: 400, error: msg })),
  notFound: vi.fn((resource?: string) => ({
    status: 404,
    error: `${resource ?? "Resource"} not found`,
  })),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    content: mockContentRepo,
    profile: mockProfileRepo,
  })),
}));

vi.mock("@/lib/job-queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { badRequest, notFound } from "@/lib/api-errors";
import { POST } from "../retry/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Test post",
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

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    userId: "test-user-id",
    name: "Test Profile",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/v1/content/:id/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should reset FAILED content to APPROVED and re-enqueue", async () => {
      const content = makeMockContent({ status: "FAILED" });
      const profile = makeMockProfile();
      const updatedContent = { ...content, status: "APPROVED" };

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockContentRepo.resetToApproved.mockResolvedValue(updatedContent);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(mockContentRepo.findById).toHaveBeenCalledWith("content-1");
      expect(mockProfileRepo.findById).toHaveBeenCalledWith(content.profileId);
      expect(mockContentRepo.resetToApproved).toHaveBeenCalledWith("content-1");
      expect(mockEnqueueJob).toHaveBeenCalledWith(
        "publish",
        {
          contentId: "content-1",
          profileId: content.profileId,
          platform: content.platform,
          userId: "test-user-id",
        },
        { priority: "high" },
      );
      expect(mockJson).toHaveBeenCalledWith(
        { content: updatedContent, reEnqueued: true },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control": "private, no-store",
            "X-API-Version": "v1",
          }),
        }),
      );
      expect(response).toEqual({ status: 200 });
    });
  });

  describe("validation errors", () => {
    it("should return 400 when content ID is missing", async () => {
      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: {} });

      expect(badRequest).toHaveBeenCalledWith("Content ID is required");
      expect(response).toEqual({ status: 400, error: "Content ID is required" });
    });

    it("should return 400 when content is not FAILED", async () => {
      const content = makeMockContent({ status: "DRAFT" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Only FAILED content can be retried");
      expect(response).toEqual({
        status: 400,
        error: "Only FAILED content can be retried",
      });
    });

    it("should return 400 when content is APPROVED (not FAILED)", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Only FAILED content can be retried");
    });

    it("should return 400 when content is PUBLISHED", async () => {
      const content = makeMockContent({ status: "PUBLISHED" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Only FAILED content can be retried");
    });
  });

  describe("ownership checks", () => {
    it("should return 404 when content is not found", async () => {
      mockContentRepo.findById.mockResolvedValue(null);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "nonexistent" } });

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not owned by user", async () => {
      const content = makeMockContent({ profileId: "profile-other" });
      const profile = makeMockProfile({ userId: "different-user" });

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not found", async () => {
      const content = makeMockContent();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(null);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });
  });
});
