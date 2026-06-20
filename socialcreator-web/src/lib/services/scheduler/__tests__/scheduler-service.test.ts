/**
 * Tests for the Scheduler Service
 *
 * Covers:
 * - Scheduler start/stop lifecycle (timer management, idempotency)
 * - Tick processing (claim scheduled content, enqueue publish jobs)
 * - Content with missing profileId (warning logged, skipped)
 * - Multiple items due at the same time
 * - Empty due content (0 items)
 * - Error handling (claimScheduled failure, enqueue failure — tick does not crash)
 * - Custom poll interval
 * - tickForTesting() manual invocation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────
// Use vi.hoisted() because vi.mock() factories are hoisted above all code,
// so variables must be defined before them.

const mockClaimScheduled = vi.hoisted(() => vi.fn());
const mockEnqueue = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    content: {
      claimScheduled: mockClaimScheduled,
    },
  }),
}));

vi.mock("@/lib/job-queue/backend", () => ({
  createQueueBackend: () => ({
    enqueue: mockEnqueue,
  }),
  resetBackend: vi.fn(),
  InMemoryQueueBackend: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

vi.mock("@socialcreator/utils", () => ({
  computeContentHash: vi.fn(
    (params: {
      profileId: string;
      platform: string;
      textContent: string;
      mediaUrls: string[];
      hashtags: string[];
    }) => `hash-${params.profileId}-${params.platform}-${params.textContent.substring(0, 10)}`,
  ),
}));

import { createScheduler } from "../scheduler-service";

// ── Helpers ───────────────────────────────────────────────────

function makeDueContent(overrides: Record<string, unknown> = {}) {
  return {
    id: "content-1",
    profileId: "profile-1",
    platform: "X",
    textContent: "Scheduled post content",
    mediaUrls: [] as string[],
    hashtags: ["test"] as string[],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe("Scheduler Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Lifecycle: start / stop / isRunning ──────────────────────

  describe("start / stop / isRunning", () => {
    it("should not be running before start()", () => {
      const scheduler = createScheduler();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should be running after start()", () => {
      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    it("should not be running after stop()", () => {
      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should be idempotent when started multiple times", () => {
      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      scheduler.start();
      scheduler.start(); // second call should be no-op
      scheduler.start(); // third call should be no-op

      expect(scheduler.isRunning()).toBe(true);

      // Stop once — should clear the timer regardless of how many start() calls
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should allow stop/start cycle", () => {
      const scheduler = createScheduler({ pollIntervalMs: 60_000 });

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);

      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);

      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should log on start and stop", () => {
      const scheduler = createScheduler({ pollIntervalMs: 60_000 });

      scheduler.start();
      expect(mockLogger.info).toHaveBeenCalledWith(
        { pollIntervalMs: 60_000 },
        "Scheduler starting",
      );

      scheduler.stop();
      expect(mockLogger.info).toHaveBeenCalledWith("Scheduler stopped");
    });
  });

  // ── Tick: processing claimed content ─────────────────────────

  describe("tick processing", () => {
    it("should claim scheduled content and enqueue publish jobs", async () => {
      const dueContent = [makeDueContent({ id: "c-1" })];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id-1");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      // claimScheduled called with a Date
      expect(mockClaimScheduled).toHaveBeenCalledTimes(1);
      expect(mockClaimScheduled.mock.calls[0][0]).toBeInstanceOf(Date);

      // Enqueue called with the publish job payload
      expect(mockEnqueue).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "publish",
          payload: expect.objectContaining({
            contentId: "c-1",
            profileId: "profile-1",
            platform: "X",
          }),
          priority: "normal",
          status: "queued",
          maxAttempts: 3,
          retryDelayMs: 1000,
        }),
      );
    });

    it("should compute contentHash and include it in the enqueue payload", async () => {
      const dueContent = [
        makeDueContent({
          id: "c-1",
          profileId: "p-1",
          platform: "instagram",
          textContent: "Hello world",
          mediaUrls: ["https://example.com/img.jpg"],
          hashtags: ["social", "marketing"],
        }),
      ];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id-1");

      const { computeContentHash } = await import("@socialcreator/utils");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(computeContentHash).toHaveBeenCalledWith({
        profileId: "p-1",
        platform: "instagram",
        textContent: "Hello world",
        mediaUrls: ["https://example.com/img.jpg"],
        hashtags: ["social", "marketing"],
      });

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            contentHash: "hash-p-1-instagram-Hello worl",
          }),
        }),
      );
    });

    it("should handle multiple items due at the same time", async () => {
      const dueContent = [
        makeDueContent({ id: "c-1", profileId: "p-1", platform: "X" }),
        makeDueContent({ id: "c-2", profileId: "p-2", platform: "instagram" }),
        makeDueContent({ id: "c-3", profileId: "p-3", platform: "linkedin" }),
      ];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockEnqueue).toHaveBeenCalledTimes(3);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-1" }),
        }),
      );
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-2" }),
        }),
      );
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-3" }),
        }),
      );
    });

    it("should skip items with null profileId and log a warning", async () => {
      const dueContent = [
        makeDueContent({ id: "c-good", profileId: "p-1" }),
        makeDueContent({ id: "c-skip", profileId: null }),
      ];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      // Only the valid item should be enqueued
      expect(mockEnqueue).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-good" }),
        }),
      );

      // Warning should have been logged for the skipped item
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { contentId: "c-skip" },
        "Scheduled content has no profileId, skipping",
      );
    });

    it("should continue processing after skipping an item with null profileId", async () => {
      const dueContent = [
        makeDueContent({ id: "c-skip", profileId: null }),
        makeDueContent({ id: "c-good", profileId: "p-1" }),
      ];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      // The valid item after the skipped one should still be processed
      expect(mockEnqueue).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-good" }),
        }),
      );
    });

    it("should handle empty due content (0 items) gracefully", async () => {
      mockClaimScheduled.mockResolvedValue([]);

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockEnqueue).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { found: 0, enqueued: 0, durationMs: expect.any(Number) },
        "Scheduler tick completed",
      );
    });

    it("should log tick completion with metrics", async () => {
      const dueContent = [makeDueContent({ id: "c-1" }), makeDueContent({ id: "c-2" })];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { found: 2, enqueued: 2, durationMs: expect.any(Number) },
        "Scheduler tick completed",
      );
    });

    it("should call enqueue once per content item", async () => {
      const dueContent = [makeDueContent({ id: "c-1" }), makeDueContent({ id: "c-2" })];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockEnqueue).toHaveBeenCalledTimes(2);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-1" }),
        }),
      );
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-2" }),
        }),
      );
    });
  });

  // ── Error Handling ──────────────────────────────────────────

  describe("error handling", () => {
    it("should catch and log when claimScheduled throws", async () => {
      const dbError = new Error("Database connection lost");
      mockClaimScheduled.mockRejectedValue(dbError);

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      // tick should NOT throw — it catches internally
      await expect(scheduler.tickForTesting()).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: dbError, durationMs: expect.any(Number) },
        "Scheduler tick failed",
      );
      // No content should be enqueued
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("should catch and log when enqueue throws — tick does not crash", async () => {
      const dueContent = [
        makeDueContent({ id: "c-1", profileId: "p-1" }),
        makeDueContent({ id: "c-2", profileId: "p-2" }),
      ];
      mockClaimScheduled.mockResolvedValue(dueContent);
      // First call succeeds, second throws
      mockEnqueue
        .mockResolvedValueOnce("job-id-1")
        .mockRejectedValueOnce(new Error("Queue backend unavailable"));

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      // tick should NOT throw — it catches internally
      await expect(scheduler.tickForTesting()).resolves.toBeUndefined();

      // The error should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({ message: "Queue backend unavailable" }),
          durationMs: expect.any(Number),
        }),
        "Scheduler tick failed",
      );

      // ⚠ Note: due to the single try/catch wrapping the entire tick,
      // only items processed before the failure are enqueued.
      // Item c-2's failure prevents c-3+ from being processed.
      // This is current behavior — see the scheduler code for the single try/catch.
    });

    it("should recover and continue ticking after a failure", async () => {
      // First tick: fails
      mockClaimScheduled.mockRejectedValueOnce(new Error("DB down"));

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.objectContaining({ message: "DB down" }) }),
        "Scheduler tick failed",
      );
      mockLogger.error.mockClear();

      // Second tick: succeeds
      const dueContent = [makeDueContent({ id: "c-1" })];
      mockClaimScheduled.mockResolvedValueOnce(dueContent);
      mockEnqueue.mockResolvedValue("job-id-1");

      await scheduler.tickForTesting();

      expect(mockEnqueue).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { found: 1, enqueued: 1, durationMs: expect.any(Number) },
        "Scheduler tick completed",
      );
    });
  });

  // ── Timer / Poll Interval ───────────────────────────────────

  describe("poll interval behavior", () => {
    it("should default to 30s poll interval", () => {
      const scheduler = createScheduler();
      scheduler.start();

      // Check the logger was called with the default interval
      expect(mockLogger.info).toHaveBeenCalledWith(
        { pollIntervalMs: 30_000 },
        "Scheduler starting",
      );

      scheduler.stop();
    });

    it("should respect custom pollIntervalMs", () => {
      const scheduler = createScheduler({ pollIntervalMs: 10_000 });
      scheduler.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { pollIntervalMs: 10_000 },
        "Scheduler starting",
      );

      scheduler.stop();
    });

    it("should run tick immediately on start() and then on each interval", async () => {
      mockClaimScheduled.mockResolvedValue([]);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 5_000 });
      scheduler.start();

      // Initial tick is fired immediately (but async, not awaited).
      // Advance by 0 to flush pending microtasks from the initial tick.
      await vi.advanceTimersByTimeAsync(0);

      // After the initial tick, claimScheduled should have been called once
      expect(mockClaimScheduled).toHaveBeenCalledTimes(1);

      // Advance by one interval
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockClaimScheduled).toHaveBeenCalledTimes(2);

      // Advance by another interval
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockClaimScheduled).toHaveBeenCalledTimes(3);

      scheduler.stop();
    });

    it("should not tick after stop()", async () => {
      mockClaimScheduled.mockResolvedValue([]);

      const scheduler = createScheduler({ pollIntervalMs: 5_000 });
      scheduler.start();

      // Initial tick
      await vi.advanceTimersByTimeAsync(0);
      expect(mockClaimScheduled).toHaveBeenCalledTimes(1);

      // Stop the scheduler
      scheduler.stop();
      mockClaimScheduled.mockClear();

      // Advance time — no ticks should fire
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockClaimScheduled).not.toHaveBeenCalled();
    });
  });

  // ── tickForTesting ──────────────────────────────────────────

  describe("tickForTesting", () => {
    it("should invoke tick logic manually for testing", async () => {
      const dueContent = [makeDueContent({ id: "c-1" })];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id-1");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockClaimScheduled).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledTimes(1);
    });

    it("should work when scheduler is not started", async () => {
      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      const dueContent = [makeDueContent({ id: "c-not-started" })];
      mockClaimScheduled.mockResolvedValue(dueContent);
      mockEnqueue.mockResolvedValue("job-id");

      await scheduler.tickForTesting();

      expect(mockClaimScheduled).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "c-not-started" }),
        }),
      );
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle content with scheduledPublishAt far in the past (via claimScheduled)", async () => {
      // The scheduler passes `new Date()` to claimScheduled,
      // which queries for scheduledPublishAt <= now.
      // Far-past content should be picked up by the query.
      const oldContent = makeDueContent({
        id: "old-content",
        profileId: "p-1",
      });
      mockClaimScheduled.mockResolvedValue([oldContent]);
      mockEnqueue.mockResolvedValue("job-id");

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ contentId: "old-content" }),
        }),
      );
    });

    it("should use the current timestamp when calling claimScheduled", async () => {
      const now = new Date("2026-06-20T12:00:00.000Z");
      vi.setSystemTime(now);
      mockClaimScheduled.mockResolvedValue([]);

      const scheduler = createScheduler({ pollIntervalMs: 60_000 });
      await scheduler.tickForTesting();

      expect(mockClaimScheduled).toHaveBeenCalledTimes(1);
      const dateArg = mockClaimScheduled.mock.calls[0][0];
      expect(dateArg.getTime()).toBe(now.getTime());
    });
  });
});
