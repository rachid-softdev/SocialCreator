/**
 * Tests for POST /api/v1/content/batch/reschedule
 *
 * Verifies:
 * - Happy path: reschedules multiple items and returns updated count
 * - 400 when body is invalid (missing items, empty array, too many items)
 * - 400 when scheduledPublishAt is invalid
 * - 404 when any content not found or not owned by user
 * - Ownership check for each item
 * - Max 100 items per request
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockJson, mockContentRepo, mockProfileRepo } = vi.hoisted(() => ({
  mockJson: vi.fn(),
  mockContentRepo: { findById: vi.fn(), batchReschedule: vi.fn() },
  mockProfileRepo: { findById: vi.fn() },
}));

const { requestJsonMock } = vi.hoisted(() => ({
  requestJsonMock: { current: vi.fn() },
}));

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
      ) => unknown,
    ) =>
      async (_request: unknown) => {
        return handler({
          userId: "test-user-id",
          request: { json: requestJsonMock.current },
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
    content: mockContentRepo,
    profile: mockProfileRepo,
  })),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { badRequest, notFound } from "@/lib/api-errors";
import { POST } from "../batch/reschedule/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Test post",
    mediaUrls: [],
    hashtags: [],
    status: "SCHEDULED",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    publishedAt: null,
    scheduledPublishAt: new Date("2099-01-01"),
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

describe("POST /api/v1/content/batch/reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJson.mockReturnValue({ status: 200 });
  });

  describe("happy path", () => {
    it("should reschedule multiple items", async () => {
      const futureDate = "2099-12-31T12:00:00.000Z";
      requestJsonMock.current = vi.fn().mockResolvedValue({
        items: [
          { id: "content-1", scheduledPublishAt: futureDate },
          { id: "content-2", scheduledPublishAt: futureDate },
        ],
      });

      const content1 = makeMockContent({ id: "content-1" });
      const content2 = makeMockContent({ id: "content-2" });
      const profile = makeMockProfile();

      mockContentRepo.findById
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2);
      mockProfileRepo.findById
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(profile);
      mockContentRepo.batchReschedule.mockResolvedValue(2);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(mockContentRepo.findById).toHaveBeenCalledTimes(2);
      expect(mockContentRepo.findById).toHaveBeenCalledWith("content-1");
      expect(mockContentRepo.findById).toHaveBeenCalledWith("content-2");
      expect(mockContentRepo.batchReschedule).toHaveBeenCalledWith([
        { id: "content-1", scheduledPublishAt: new Date(futureDate) },
        { id: "content-2", scheduledPublishAt: new Date(futureDate) },
      ]);
      expect(mockJson).toHaveBeenCalledWith(
        {
          updated: 2,
          items: [
            { id: "content-1", scheduledPublishAt: futureDate },
            { id: "content-2", scheduledPublishAt: futureDate },
          ],
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

    it("should handle single item", async () => {
      const futureDate = "2099-12-31T12:00:00.000Z";
      requestJsonMock.current = vi.fn().mockResolvedValue({
        items: [{ id: "content-1", scheduledPublishAt: futureDate }],
      });

      const content = makeMockContent({ id: "content-1" });
      const profile = makeMockProfile();

      mockContentRepo.findById.mockResolvedValue(content);
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockContentRepo.batchReschedule.mockResolvedValue(1);

      await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(mockContentRepo.batchReschedule).toHaveBeenCalledWith([
        { id: "content-1", scheduledPublishAt: new Date(futureDate) },
      ]);
    });
  });

  describe("validation errors", () => {
    it("should return 400 when items is missing", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({});

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });

    it("should return 400 when items is empty array", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({ items: [] });

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(badRequest).toHaveBeenCalledWith("At least one item is required");
      expect(response).toEqual({ status: 400, error: "At least one item is required" });
    });

    it("should return 400 when items exceed 100", async () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        id: `content-${i}`,
        scheduledPublishAt: "2099-12-31T12:00:00.000Z",
      }));
      requestJsonMock.current = vi.fn().mockResolvedValue({ items });

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(badRequest).toHaveBeenCalledWith("Maximum 100 items per request");
      expect(response).toEqual({ status: 400, error: "Maximum 100 items per request" });
    });

    it("should return 400 when scheduledPublishAt is invalid", async () => {
      requestJsonMock.current = vi.fn().mockResolvedValue({
        items: [{ id: "content-1", scheduledPublishAt: "not-a-date" }],
      });

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(badRequest).toHaveBeenCalled();
      expect(response).toEqual({ status: 400, error: expect.any(String) });
    });
  });

  describe("ownership checks", () => {
    it("should return 404 when any content is not found", async () => {
      const futureDate = "2099-12-31T12:00:00.000Z";
      requestJsonMock.current = vi.fn().mockResolvedValue({
        items: [
          { id: "content-1", scheduledPublishAt: futureDate },
          { id: "content-not-found", scheduledPublishAt: futureDate },
        ],
      });

      const content = makeMockContent({ id: "content-1" });
      mockContentRepo.findById
        .mockResolvedValueOnce(content)
        .mockResolvedValueOnce(null);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(notFound).toHaveBeenCalledWith("Content with id content-not-found");
      expect(response).toEqual({
        status: 404,
        error: "Content with id content-not-found not found",
      });
    });

    it("should return 404 when any content is not owned by user", async () => {
      const futureDate = "2099-12-31T12:00:00.000Z";
      requestJsonMock.current = vi.fn().mockResolvedValue({
        items: [
          { id: "content-1", scheduledPublishAt: futureDate },
          { id: "content-other", scheduledPublishAt: futureDate },
        ],
      });

      const content1 = makeMockContent({ id: "content-1" });
      const contentOther = makeMockContent({ id: "content-other", profileId: "profile-other" });
      const profile1 = makeMockProfile();
      const profileOther = makeMockProfile({ userId: "different-user" });

      mockContentRepo.findById
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(contentOther);
      mockProfileRepo.findById
        .mockResolvedValueOnce(profile1)
        .mockResolvedValueOnce(profileOther);

      const response = await (POST as unknown as (...args: never[]) => unknown)({}, {});

      expect(notFound).toHaveBeenCalledWith("Content with id content-other");
      expect(response).toEqual({
        status: 404,
        error: "Content with id content-other not found",
      });
    });
  });
});
