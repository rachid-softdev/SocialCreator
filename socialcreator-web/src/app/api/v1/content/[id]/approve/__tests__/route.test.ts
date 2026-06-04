/**
 * Tests for POST /api/v1/content/:id/approve
 *
 * Verifies:
 * - Happy path: DRAFT → APPROVED status transition
 * - 404 when content not found
 * - 404 when profile not owned by user
 * - 400 when content is not DRAFT
 * - 400 when content ID is missing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks (vi.mock factories are hoisted, so variables must be vi.hoisted) ──

const { mockJson, mockContentRepo, mockProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockContentRepo: { findById: vi.fn(), updateStatus: vi.fn() },
  mockProfileRepo: { findById: vi.fn() },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

// Mock withApiMiddleware — wraps handler to pass userId and params directly
vi.mock("@/lib/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (handler: (ctx: { userId: string }, params?: Record<string, string>) => unknown) =>
      async (_request: unknown, context?: { params?: Record<string, string> }) => {
        const params = context?.params ?? {};
        return handler({ userId: "test-user-id" }, params);
      },
  ),
}));

// Mock api-errors as simple objects
vi.mock("@/lib/api-errors", () => ({
  badRequest: vi.fn((msg: string) => ({ status: 400, error: msg })),
  notFound: vi.fn((resource?: string) => ({
    status: 404,
    error: `${resource ?? "Resource"} not found`,
  })),
}));

// Mock repositories — use cached instances so route handler sees the same mocks
vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    content: mockContentRepo,
    profile: mockProfileRepo,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { badRequest, notFound } from "@/lib/api-errors";
import { POST } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Test post",
    mediaUrls: [],
    hashtags: [],
    status: "DRAFT",
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

describe("POST /api/v1/content/:id/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should approve draft content and return the updated content", async () => {
      const content = makeMockContent({ status: "DRAFT" });
      const profile = makeMockProfile();
      const updatedContent = { ...content, status: "APPROVED" };

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockContentRepo.updateStatus.mockResolvedValue(updatedContent);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(mockContentRepo.findById).toHaveBeenCalledWith("content-1");
      expect(mockProfileRepo.findById).toHaveBeenCalledWith(content.profileId);
      expect(mockContentRepo.updateStatus).toHaveBeenCalledWith("content-1", "APPROVED");
      expect(mockJson).toHaveBeenCalledWith(
        { content: updatedContent },
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

  describe("error cases", () => {
    it("should return 400 when content ID is missing", async () => {
      const response = await (POST as unknown as (...args: never[]) => unknown)({}, { params: {} });

      expect(badRequest).toHaveBeenCalledWith("Content ID is required");
      expect(response).toEqual({ status: 400, error: "Content ID is required" });
    });

    it("should return 404 when content is not found", async () => {
      mockContentRepo.findById.mockResolvedValue(null);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "nonexistent" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not owned by user", async () => {
      const content = makeMockContent({ profileId: "profile-other" });
      const profile = makeMockProfile({ userId: "different-user" });

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not found", async () => {
      const content = makeMockContent();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(null);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 400 when content is not DRAFT (PUBLISHED)", async () => {
      const content = makeMockContent({ status: "PUBLISHED" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalledWith("Only draft content can be approved");
      expect(response).toEqual({ status: 400, error: "Only draft content can be approved" });
    });

    it("should return 400 when content is APPROVED (already approved)", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalledWith("Only draft content can be approved");
      expect(response).toEqual({ status: 400, error: "Only draft content can be approved" });
    });

    it("should return 400 when content is SCHEDULED", async () => {
      const content = makeMockContent({ status: "SCHEDULED" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);

      const response = await (POST as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalledWith("Only draft content can be approved");
      expect(response).toEqual({ status: 400, error: "Only draft content can be approved" });
    });
  });

  describe("ownership edge cases", () => {
    it("should verify profile.userId matches session userId", async () => {
      const content = makeMockContent();
      const profile = makeMockProfile({ userId: "test-user-id" });

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockContentRepo.updateStatus.mockResolvedValue({
        ...content,
        status: "APPROVED",
      });

      await (POST as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(mockContentRepo.updateStatus).toHaveBeenCalled();
    });
  });
});
