/**
 * Comprehensive tests for Publish Worker Trigger
 *
 * Covers:
 * - runPublishWorker() — validates content exists, enqueues high-priority job,
 *   error handling when content is not found
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

const mockContentFindById = vi.hoisted(() => vi.fn());
const mockGetRepositories = vi.hoisted(() =>
  vi.fn(() => ({
    content: { findById: mockContentFindById },
  })),
);
vi.mock("@/lib/repositories", () => ({
  getRepositories: mockGetRepositories,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { runPublishWorker } from "@/triggers/publish-worker.trigger";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "INSTAGRAM",
    ...overrides,
  };
}

const validPayload = {
  contentId: "content-1",
  userId: "user-1",
  profileId: "profile-1",
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("runPublishWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario: SUCCESS - content found → enqueued
  it("should enqueue a publish job when content exists", async () => {
    const content = makeMockContent();
    mockContentFindById.mockResolvedValue(content);
    mockEnqueueJob.mockReturnValue(undefined);

    const result = await runPublishWorker(validPayload);

    expect(result).toEqual({ contentId: "content-1", queued: true });
    expect(mockContentFindById).toHaveBeenCalledWith("content-1");
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
  });

  // Scenario: SUCCESS - enqueueJob called with correct parameters
  it("should call enqueueJob with publish type, correct payload, and high-priority options", async () => {
    const content = makeMockContent();
    mockContentFindById.mockResolvedValue(content);
    mockEnqueueJob.mockReturnValue(undefined);

    await runPublishWorker(validPayload);

    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "publish",
      {
        contentId: "content-1",
        profileId: "profile-1",
        platform: "INSTAGRAM",
        userId: "user-1",
      },
      { priority: "high", maxAttempts: 3, retryDelayMs: 5000 },
    );
  });

  // Scenario: ERROR - content not found → throw
  it("should throw when content is not found", async () => {
    mockContentFindById.mockResolvedValue(null);

    await expect(runPublishWorker(validPayload)).rejects.toThrow("Content not found: content-1");

    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });
});
