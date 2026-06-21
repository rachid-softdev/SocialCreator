/**
 * Comprehensive tests for Scheduled Content Publisher Trigger
 *
 * Covers:
 * - runScheduledContentPublisher() — finds due content and enqueues publish jobs,
 *   handles missing profileId, enqueue failures, and mixed results
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (vi.hoisted ensures vars exist before vi.mock factory runs) ──────

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockEnqueueJob = vi.hoisted(() => vi.fn());
vi.mock("@/lib/job-queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

const mockFindPendingScheduled = vi.hoisted(() => vi.fn());
const mockGetRepositories = vi.hoisted(() =>
  vi.fn(() => ({
    content: { findPendingScheduled: mockFindPendingScheduled },
  })),
);
vi.mock("@/lib/repositories", () => ({
  getRepositories: mockGetRepositories,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { runScheduledContentPublisher } from "@/triggers/scheduled-content.trigger";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "INSTAGRAM",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("runScheduledContentPublisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario: SUCCESS - no due content → enqueued = 0
  it("should return enqueued=0 when there is no due content", async () => {
    mockFindPendingScheduled.mockResolvedValue([]);

    const result = await runScheduledContentPublisher();

    expect(result).toEqual({ enqueued: 0 });
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  // Scenario: SUCCESS - single content due → enqueued = 1
  it("should enqueue a publish job for a single due content item", async () => {
    const content = makeMockContent();
    mockFindPendingScheduled.mockResolvedValue([content]);
    mockEnqueueJob.mockReturnValue(undefined);

    const result = await runScheduledContentPublisher();

    expect(result).toEqual({ enqueued: 1 });
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "publish",
      {
        contentId: "content-1",
        profileId: "profile-1",
        platform: "INSTAGRAM",
        userId: "",
      },
      { priority: "normal", maxAttempts: 3 },
    );
  });

  // Scenario: SUCCESS - multiple content due → all enqueued
  it("should enqueue all items when multiple content are due", async () => {
    const contents = [
      makeMockContent({ id: "content-1", platform: "INSTAGRAM" }),
      makeMockContent({ id: "content-2", platform: "TIKTOK", profileId: "profile-2" }),
      makeMockContent({ id: "content-3", platform: "LINKEDIN", profileId: "profile-3" }),
    ];
    mockFindPendingScheduled.mockResolvedValue(contents);
    mockEnqueueJob.mockReturnValue(undefined);

    const result = await runScheduledContentPublisher();

    expect(result).toEqual({ enqueued: 3 });
    expect(mockEnqueueJob).toHaveBeenCalledTimes(3);
  });

  // Scenario: EDGE - content without profileId → skipped with warning
  it("should skip content without profileId and log a warning", async () => {
    const contents = [
      makeMockContent({ id: "content-1", profileId: "profile-1" }),
      makeMockContent({ id: "content-2", profileId: null }),
      makeMockContent({ id: "content-3", profileId: "profile-3" }),
    ];
    mockFindPendingScheduled.mockResolvedValue(contents);
    mockEnqueueJob.mockReturnValue(undefined);

    const logger = (await import("@/lib/logger")).default;

    const result = await runScheduledContentPublisher();

    expect(result).toEqual({ enqueued: 2 });
    expect(mockEnqueueJob).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      { contentId: "content-2" },
      "Scheduled content has no profileId, skipping",
    );
  });

  // Scenario: ERROR - enqueueJob fails → logged, continues to next
  it("should log error and continue when enqueueJob fails", async () => {
    const contents = [
      makeMockContent({ id: "content-1" }),
      makeMockContent({ id: "content-2" }),
      makeMockContent({ id: "content-3" }),
    ];
    mockFindPendingScheduled.mockResolvedValue(contents);

    // Second enqueue fails
    mockEnqueueJob
      .mockReturnValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error("Queue unavailable");
      })
      .mockReturnValueOnce(undefined);

    const logger = (await import("@/lib/logger")).default;

    const result = await runScheduledContentPublisher();

    expect(result).toEqual({ enqueued: 2 });
    expect(logger.error).toHaveBeenCalledWith(
      { contentId: "content-2", err: expect.any(Error) },
      "Error enqueuing scheduled content",
    );
    expect(mockEnqueueJob).toHaveBeenCalledTimes(3);
  });

  // Scenario: SUCCESS - mixed results (some succeed, some fail)
  it("should report partial success when some enqueues fail", async () => {
    const contents = [
      makeMockContent({ id: "content-1" }),
      makeMockContent({ id: "content-2" }),
      makeMockContent({ id: "content-3" }),
      makeMockContent({ id: "content-4" }),
    ];
    mockFindPendingScheduled.mockResolvedValue(contents);

    // First and third fail, second and fourth succeed
    mockEnqueueJob
      .mockImplementationOnce(() => {
        throw new Error("Timeout");
      })
      .mockReturnValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error("Overload");
      })
      .mockReturnValueOnce(undefined);

    const logger = (await import("@/lib/logger")).default;

    const result = await runScheduledContentPublisher();

    expect(result).toEqual({ enqueued: 2 });
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(mockEnqueueJob).toHaveBeenCalledTimes(4);
  });
});
