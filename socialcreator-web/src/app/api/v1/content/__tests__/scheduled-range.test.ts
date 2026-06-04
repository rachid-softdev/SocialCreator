/**
 * Tests for GET /api/v1/content/scheduled-range
 *
 * Verifies:
 * - Happy path: returns scheduled content within date range
 * - Filters by platform when provided
 * - 400 when 'from' or 'to' query params are missing/invalid
 * - Returns calendar event format (id, profileId, platform, scheduledPublishAt, etc.)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson, mockContentRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockContentRepo: { findScheduledByDateRange: vi.fn() },
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: mockJson,
  },
}));

// Simple mock: passes request object directly as the handler context
vi.mock("@/lib/api-middleware", () => ({
  withApiMiddleware: vi.fn((handler: any) => {
    const wrapped = async (request: any) => {
      return handler({ userId: "test-user-id", request });
    };
    return wrapped;
  }),
}));

vi.mock("@/lib/api-errors", () => ({
  badRequest: vi.fn((msg: string) => ({ status: 400, error: msg })),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: vi.fn(() => ({
    content: mockContentRepo,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { badRequest } from "@/lib/api-errors";
import { GET } from "../scheduled-range/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockScheduledContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Scheduled post",
    mediaUrls: [],
    hashtags: [],
    status: "SCHEDULED",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    scheduledPublishAt: new Date("2099-12-31T12:00:00.000Z"),
    scheduledTimezone: "UTC",
    runId: null,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/v1/content/scheduled-range", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should return scheduled content within date range", async () => {
      const contents = [
        makeMockScheduledContent({ id: "content-1" }),
        makeMockScheduledContent({ id: "content-2" }),
      ];

      mockContentRepo.findScheduledByDateRange.mockResolvedValue(contents);

      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?from=2099-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.000Z",
      };
      await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockContentRepo.findScheduledByDateRange).toHaveBeenCalledWith(
        "test-user-id",
        expect.any(Date),
        expect.any(Date),
        undefined,
      );
      expect(mockContentRepo.findScheduledByDateRange).toHaveBeenCalledTimes(1);
    });

    it("should filter by platform when provided", async () => {
      mockContentRepo.findScheduledByDateRange.mockResolvedValue([]);

      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?from=2099-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.000Z&platform=INSTAGRAM",
      };
      await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockContentRepo.findScheduledByDateRange).toHaveBeenCalledWith(
        "test-user-id",
        expect.any(Date),
        expect.any(Date),
        "INSTAGRAM",
      );
    });

    it("should return calendar event format and correct response", async () => {
      const content = makeMockScheduledContent({ id: "content-1" });
      mockContentRepo.findScheduledByDateRange.mockResolvedValue([content]);

      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?from=2099-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.000Z",
      };
      await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockJson).toHaveBeenCalledWith(
        {
          contents: [
            {
              id: "content-1",
              profileId: "profile-1",
              platform: "X",
              textContent: "Scheduled post",
              status: "SCHEDULED",
              scheduledPublishAt: new Date("2099-12-31T12:00:00.000Z"),
              scheduledTimezone: "UTC",
            },
          ],
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            "Cache-Control": "private, no-store",
            "X-API-Version": "v1",
          }),
        }),
      );
    });

    it("should return empty array when no content in range", async () => {
      mockContentRepo.findScheduledByDateRange.mockResolvedValue([]);

      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?from=2099-01-01T00:00:00.000Z&to=2099-12-31T23:59:59.000Z",
      };
      const response = await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(mockJson).toHaveBeenCalledWith({ contents: [] }, expect.anything());
      expect(response).toEqual({ status: 200 });
    });
  });

  describe("validation errors", () => {
    it("should return 400 when 'from' is missing", async () => {
      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?to=2099-12-31T23:59:59.000Z",
      };
      const response = await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when 'to' is missing", async () => {
      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?from=2099-01-01T00:00:00.000Z",
      };
      const response = await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when 'from' is not a valid datetime", async () => {
      const request = {
        url: "http://localhost/api/v1/content/scheduled-range?from=not-a-date&to=2099-12-31T23:59:59.000Z",
      };
      const response = await (GET as unknown as (...args: never[]) => unknown)(request);

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });
  });
});
