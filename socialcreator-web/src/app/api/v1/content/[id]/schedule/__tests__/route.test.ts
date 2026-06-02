/**
 * Tests for PUT /api/v1/content/:id/schedule
 *
 * Verifies:
 * - Happy path: APPROVED → SCHEDULED with future date
 * - 400 when scheduled time is in the past
 * - 400 when body is invalid (missing/invalid scheduledPublishAt)
 * - 400 when content is already PUBLISHED (not DRAFT or APPROVED)
 * - 404 when content not found or not owned by user
 * - 400 when content ID is missing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson, mockScheduleContentRepo, mockScheduleProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockScheduleContentRepo: { findById: vi.fn(), schedule: vi.fn() },
  mockScheduleProfileRepo: { findById: vi.fn() },
}));

// Request JSON mock — mutated per test via v1 route test pattern
const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: { current: vi.fn() },
}));

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

vi.mock("@/lib/api-middleware", () => ({
  withApiMiddleware: vi.fn(
    (
      handler: (ctx: {
        userId: string;
        request: { json: ReturnType<typeof vi.fn> };
        params?: Record<string, string>;
      }) => unknown,
    ) =>
      async (_request: unknown, context?: { params?: Record<string, string> }) => {
        const params = context?.params ?? {};
        return handler({
          userId: "test-user-id",
          request: { json: requestJsonMock.current },
          params,
        });
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
    content: mockScheduleContentRepo,
    profile: mockScheduleProfileRepo,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { badRequest, notFound } from "@/lib/api-errors";
import { PUT } from "../route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Test post",
    mediaUrls: [],
    hashtags: [],
    status: "APPROVED",
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

describe("PUT /api/v1/content/:id/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
    // Default: valid future date
    requestJsonMock.current = vi.fn().mockResolvedValue({
      scheduledPublishAt: "2099-12-31T12:00:00.000Z",
    });
  });

  describe("happy path", () => {
    it("should schedule approved content with a future date", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();
      const futureDate = new Date("2099-12-31T12:00:00.000Z");
      const updatedContent = {
        ...content,
        status: "SCHEDULED",
        scheduledPublishAt: futureDate,
      };

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.schedule.mockResolvedValue(updatedContent);

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(mockScheduleContentRepo.findById).toHaveBeenCalledWith("content-1");
      expect(mockScheduleProfileRepo.findById).toHaveBeenCalledWith(content.profileId);
      expect(mockScheduleContentRepo.schedule).toHaveBeenCalledWith("content-1", futureDate);
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

    it("should schedule draft content with a future date", async () => {
      const content = makeMockContent({ status: "DRAFT" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.schedule.mockResolvedValue({ ...content, status: "SCHEDULED" });

      await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(mockScheduleContentRepo.schedule).toHaveBeenCalled();
    });
  });

  describe("validation errors", () => {
    it("should return 400 when content ID is missing", async () => {
      const response = await (PUT as unknown as Function)({}, { params: {} });

      expect(badRequest).toHaveBeenCalledWith("Content ID is required");
      expect(response).toEqual({ status: 400, error: "Content ID is required" });
    });

    it("should return 400 when scheduledPublishAt is missing from body", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({});

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when scheduledPublishAt is not a valid datetime", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: "not-a-date",
      });

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when scheduledPublishAt is a number", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: 123456,
      });

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });
  });

  describe("future date validation", () => {
    it("should return 400 when scheduled time is in the past", async () => {
      const pastDate = new Date("2020-01-01T00:00:00.000Z");
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: pastDate.toISOString(),
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Scheduled time must be in the future");
      expect(response).toEqual({
        status: 400,
        error: "Scheduled time must be in the future",
      });

      vi.useRealTimers();
    });

    it("should allow scheduling when date is in the future", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.schedule.mockResolvedValue({ ...content, status: "SCHEDULED" });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

      const futureDate = new Date("2025-01-01T01:00:00.000Z");
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: futureDate.toISOString(),
      });

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(response).toEqual({ status: 200 });
      expect(mockScheduleContentRepo.schedule).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("content status validation", () => {
    it("should return 400 when content is already PUBLISHED", async () => {
      const content = makeMockContent({ status: "PUBLISHED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Only DRAFT or APPROVED content can be scheduled");
      expect(response).toEqual({
        status: 400,
        error: "Only DRAFT or APPROVED content can be scheduled",
      });
    });

    it("should return 400 when content is FAILED", async () => {
      const content = makeMockContent({ status: "FAILED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Only DRAFT or APPROVED content can be scheduled");
      expect(response).toEqual({
        status: 400,
        error: "Only DRAFT or APPROVED content can be scheduled",
      });
    });

    it("should return 400 when content is REJECTED", async () => {
      const content = makeMockContent({ status: "REJECTED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(badRequest).toHaveBeenCalledWith("Only DRAFT or APPROVED content can be scheduled");
      expect(response).toEqual({
        status: 400,
        error: "Only DRAFT or APPROVED content can be scheduled",
      });
    });
  });

  describe("ownership checks", () => {
    it("should return 404 when content is not found", async () => {
      mockScheduleContentRepo.findById.mockResolvedValue(null);

      const response = await (PUT as unknown as Function)({}, { params: { id: "nonexistent" } });

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not owned by user", async () => {
      const content = makeMockContent({ profileId: "profile-other" });
      const profile = makeMockProfile({ userId: "different-user" });

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not found", async () => {
      const content = makeMockContent();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(null);

      const response = await (PUT as unknown as Function)({}, { params: { id: "content-1" } });

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });
  });

  describe("zod schema validation contract", () => {
    it("should validate scheduledPublishAt is a valid ISO datetime", async () => {
      const { z } = await import("zod");

      const schema = z.object({
        scheduledPublishAt: z.string().datetime(),
      });

      expect(schema.safeParse({ scheduledPublishAt: "2099-12-31T12:00:00.000Z" }).success).toBe(
        true,
      );

      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ scheduledPublishAt: "2099-12-31" }).success).toBe(false);
      expect(schema.safeParse({ scheduledPublishAt: 123 }).success).toBe(false);
    });
  });
});
