/**
 * Tests for PUT /api/v1/content/:id/schedule and DELETE /api/v1/content/:id/schedule
 *
 * PUT verifies:
 * - Happy path: APPROVED → SCHEDULED with future date
 * - 400 when scheduled time is in the past
 * - 400 when body is invalid (missing/invalid scheduledPublishAt)
 * - 400 when content is already PUBLISHED (not DRAFT or APPROVED)
 * - 404 when content not found or not owned by user
 * - 400 when content ID is missing
 * - Warnings from conflict detector are included in response
 * - scheduledTimezone is accepted and defaulted
 *
 * DELETE verifies:
 * - Happy path: SCHEDULED → APPROVED with scheduledPublishAt=null
 * - 400 when content ID is missing
 * - 400 when content is not SCHEDULED
 * - 404 when content not found or not owned by user
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson, mockScheduleContentRepo, mockScheduleProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockScheduleContentRepo: {
    findById: vi.fn(),
    update: vi.fn(),
    cancelSchedule: vi.fn(),
  },
  mockScheduleProfileRepo: { findById: vi.fn() },
}));

// Request JSON mock — mutated per test via v1 route test pattern
const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: { current: vi.fn() },
}));

// Mock for conflict detector
const { mockCheckScheduleConflicts } = vi.hoisted(() => ({
  mockCheckScheduleConflicts: vi.fn(),
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
      handler: (
        ctx: {
          userId: string;
          request: { json: ReturnType<typeof vi.fn> };
        },
        params?: Record<string, string>,
      ) => unknown,
    ) =>
      async (_request: unknown, context?: { params?: Record<string, string> }) => {
        const params = context?.params ?? {};
        return handler(
          { userId: "test-user-id", request: { json: requestJsonMock.current } },
          params,
        );
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

vi.mock("@/lib/scheduling/conflict-detector", () => ({
  checkScheduleConflicts: mockCheckScheduleConflicts,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { badRequest, notFound } from "@/lib/api-errors";
import { PUT, DELETE } from "../route";

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
    scheduledTimezone: "UTC",
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

// ── PUT Tests ──────────────────────────────────────────────────────────────

describe("PUT /api/v1/content/:id/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
    mockCheckScheduleConflicts.mockResolvedValue({ hasWarning: false, warnings: [] });
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
        scheduledTimezone: "UTC",
      };

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.update.mockResolvedValue(updatedContent);

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(mockScheduleContentRepo.findById).toHaveBeenCalledWith("content-1");
      expect(mockScheduleProfileRepo.findById).toHaveBeenCalledWith(content.profileId);
      expect(mockScheduleContentRepo.update).toHaveBeenCalledWith("content-1", {
        status: "SCHEDULED",
        scheduledPublishAt: futureDate,
        scheduledTimezone: "UTC",
      });
      expect(mockJson).toHaveBeenCalledWith(
        { content: updatedContent, warnings: undefined },
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
      mockScheduleContentRepo.update.mockResolvedValue({ ...content, status: "SCHEDULED" });

      await (PUT as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(mockScheduleContentRepo.update).toHaveBeenCalled();
    });

    it("should accept explicit scheduledTimezone", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();
      const futureDate = new Date("2099-12-31T12:00:00.000Z");

      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: "2099-12-31T12:00:00.000Z",
        scheduledTimezone: "America/New_York",
      });

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.update.mockResolvedValue({
        ...content,
        status: "SCHEDULED",
        scheduledTimezone: "America/New_York",
      });

      await (PUT as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(mockScheduleContentRepo.update).toHaveBeenCalledWith("content-1", {
        status: "SCHEDULED",
        scheduledPublishAt: futureDate,
        scheduledTimezone: "America/New_York",
      });
    });

    it("should include warnings from conflict detector", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();
      const updatedContent = { ...content, status: "SCHEDULED" };

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.update.mockResolvedValue(updatedContent);
      mockCheckScheduleConflicts.mockResolvedValue({
        hasWarning: true,
        warnings: [
          {
            type: "time_conflict",
            message: "There is 1 other item scheduled within 5 minutes of this time",
            conflictingIds: ["other-content-1"],
          },
        ],
      });

      await (PUT as unknown as (...args: never[]) => unknown)({}, { params: { id: "content-1" } });

      expect(mockCheckScheduleConflicts).toHaveBeenCalledWith(
        content.profileId,
        content.platform,
        expect.any(Date),
      );
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          warnings: expect.arrayContaining([expect.objectContaining({ type: "time_conflict" })]),
        }),
        expect.anything(),
      );
    });
  });

  describe("validation errors", () => {
    it("should return 400 when content ID is missing", async () => {
      const response = await (PUT as unknown as (...args: never[]) => unknown)({}, { params: {} });

      expect(badRequest).toHaveBeenCalledWith("Content ID is required");
      expect(response).toEqual({ status: 400, error: "Content ID is required" });
    });

    it("should return 400 when scheduledPublishAt is missing from body", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({});

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when scheduledPublishAt is not a valid datetime", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: "not-a-date",
      });

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when scheduledPublishAt is a number", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: 123456,
      });

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

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

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

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
      mockScheduleContentRepo.update.mockResolvedValue({ ...content, status: "SCHEDULED" });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

      const futureDate = new Date("2025-01-01T01:00:00.000Z");
      requestJsonMock.current = vi.fn().mockResolvedValue({
        scheduledPublishAt: futureDate.toISOString(),
      });

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(response).toEqual({ status: 200 });
      expect(mockScheduleContentRepo.update).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("content status validation", () => {
    it("should return 400 when content is already PUBLISHED", async () => {
      const content = makeMockContent({ status: "PUBLISHED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

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

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

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

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

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

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "nonexistent" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not owned by user", async () => {
      const content = makeMockContent({ profileId: "profile-other" });
      const profile = makeMockProfile({ userId: "different-user" });

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not found", async () => {
      const content = makeMockContent();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(null);

      const response = await (PUT as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });
  });

  describe("zod schema validation contract", () => {
    it("should validate scheduledPublishAt is a valid ISO datetime", async () => {
      const { z } = await import("zod");

      const schema = z.object({
        scheduledPublishAt: z.string().datetime(),
        scheduledTimezone: z.string().optional().default("UTC"),
      });

      expect(schema.safeParse({ scheduledPublishAt: "2099-12-31T12:00:00.000Z" }).success).toBe(
        true,
      );

      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ scheduledPublishAt: "2099-12-31" }).success).toBe(false);
      expect(schema.safeParse({ scheduledPublishAt: 123 }).success).toBe(false);
    });

    it("should default scheduledTimezone to UTC", async () => {
      const { z } = await import("zod");

      const schema = z.object({
        scheduledPublishAt: z.string().datetime(),
        scheduledTimezone: z.string().optional().default("UTC"),
      });

      const result = schema.safeParse({ scheduledPublishAt: "2099-12-31T12:00:00.000Z" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scheduledTimezone).toBe("UTC");
      }
    });

    it("should accept a custom scheduledTimezone", async () => {
      const { z } = await import("zod");

      const schema = z.object({
        scheduledPublishAt: z.string().datetime(),
        scheduledTimezone: z.string().optional().default("UTC"),
      });

      const result = schema.safeParse({
        scheduledPublishAt: "2099-12-31T12:00:00.000Z",
        scheduledTimezone: "America/New_York",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scheduledTimezone).toBe("America/New_York");
      }
    });
  });
});

// ── DELETE Tests ────────────────────────────────────────────────────────────

describe("DELETE /api/v1/content/:id/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should cancel schedule for SCHEDULED content", async () => {
      const content = makeMockContent({
        status: "SCHEDULED",
        scheduledPublishAt: new Date("2099-12-31"),
      });
      const profile = makeMockProfile();
      const cancelledContent = {
        ...content,
        status: "APPROVED",
        scheduledPublishAt: null,
      };

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);
      mockScheduleContentRepo.cancelSchedule.mockResolvedValue(cancelledContent);

      const response = await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(mockScheduleContentRepo.findById).toHaveBeenCalledWith("content-1");
      expect(mockScheduleProfileRepo.findById).toHaveBeenCalledWith(content.profileId);
      expect(mockScheduleContentRepo.cancelSchedule).toHaveBeenCalledWith("content-1");
      expect(mockJson).toHaveBeenCalledWith(
        { content: cancelledContent },
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
      const response = await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: {} },
      );

      expect(badRequest).toHaveBeenCalledWith("Content ID is required");
      expect(response).toEqual({ status: 400, error: "Content ID is required" });
    });

    it("should return 400 when content is not SCHEDULED", async () => {
      const content = makeMockContent({ status: "DRAFT" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalledWith("Only SCHEDULED content can be unscheduled");
      expect(response).toEqual({
        status: 400,
        error: "Only SCHEDULED content can be unscheduled",
      });
    });

    it("should return 400 when content is APPROVED (not SCHEDULED)", async () => {
      const content = makeMockContent({ status: "APPROVED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalledWith("Only SCHEDULED content can be unscheduled");
    });

    it("should return 400 when content is PUBLISHED", async () => {
      const content = makeMockContent({ status: "PUBLISHED" });
      const profile = makeMockProfile();

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(badRequest).toHaveBeenCalledWith("Only SCHEDULED content can be unscheduled");
    });
  });

  describe("ownership checks", () => {
    it("should return 404 when content is not found", async () => {
      mockScheduleContentRepo.findById.mockResolvedValue(null);

      const response = await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "nonexistent" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not owned by user", async () => {
      const content = makeMockContent({ status: "SCHEDULED", profileId: "profile-other" });
      const profile = makeMockProfile({ userId: "different-user" });

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(profile);

      const response = await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });

    it("should return 404 when content profile is not found", async () => {
      const content = makeMockContent({ status: "SCHEDULED" });

      mockScheduleContentRepo.findById.mockResolvedValue(content);
      mockScheduleProfileRepo.findById.mockResolvedValue(null);

      const response = await (DELETE as unknown as (...args: never[]) => unknown)(
        {},
        { params: { id: "content-1" } },
      );

      expect(notFound).toHaveBeenCalledWith("Content");
      expect(response).toEqual({ status: 404, error: "Content not found" });
    });
  });
});
