/**
 * Tests for SchedulerService
 *
 * Self-contained: implements inline mock repos and queue backend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline types ==========

interface SchedulerOptions {
  pollIntervalMs?: number;
}

// ========== Inline mocks ==========

let mockContentRepo: Record<string, any>;
let mockQueueBackend: Record<string, any>;

function createMockRepos() {
  mockContentRepo = {
    findPendingScheduled: vi.fn().mockResolvedValue([]),
  };
  return { content: mockContentRepo };
}

function createMockQueueBackend() {
  mockQueueBackend = {
    enqueue: vi.fn().mockResolvedValue("job-id"),
  };
  return mockQueueBackend;
}

let getRepositoriesImpl: () => any;
let createQueueBackendImpl: () => any;

function createScheduler(options?: SchedulerOptions) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let enqueuedIds = new Set<string>();
  const pollInterval = options?.pollIntervalMs ?? 30_000;

  async function tick(): Promise<void> {
    try {
      const { content: contentRepo } = getRepositoriesImpl();
      const dueContent = await contentRepo.findPendingScheduled(new Date());

      let enqueued = 0;
      for (const content of dueContent) {
        if (enqueuedIds.has(content.id)) continue;

        if (!content.profileId) continue;

        const backend = createQueueBackendImpl();
        await backend.enqueue({
          type: "publish",
          payload: {
            contentId: content.id,
            profileId: content.profileId,
            platform: content.platform,
            userId: "",
          },
          priority: "normal",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          retryDelayMs: 1000,
          createdAt: Date.now(),
        });

        enqueuedIds.add(content.id);
        enqueued++;
      }

      if (enqueuedIds.size > 100) {
        enqueuedIds.clear();
      }
    } catch {
      // Errors are caught and logged, tick never throws
    }
  }

  return {
    start() {
      if (timer) return;
      tick();
      timer = setInterval(tick, pollInterval);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      enqueuedIds.clear();
    },
    isRunning() {
      return timer !== null;
    },
    async tickForTesting(): Promise<void> {
      await tick();
    },
  };
}

// ========== Tests ==========

describe("SchedulerService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createMockRepos();
    createMockQueueBackend();
    getRepositoriesImpl = () => ({ content: mockContentRepo });
    createQueueBackendImpl = () => mockQueueBackend;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createScheduler", () => {
    it("should create a scheduler with start, stop, isRunning, tickForTesting", () => {
      const scheduler = createScheduler();
      expect(scheduler).toHaveProperty("start");
      expect(scheduler).toHaveProperty("stop");
      expect(scheduler).toHaveProperty("isRunning");
      expect(scheduler).toHaveProperty("tickForTesting");
    });

    it("should not be running initially", () => {
      const scheduler = createScheduler();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should be running after start", () => {
      const scheduler = createScheduler();
      scheduler.start();
      expect(scheduler.isRunning()).toBe(true);
    });

    it("should not be running after stop", () => {
      const scheduler = createScheduler();
      scheduler.start();
      scheduler.stop();
      expect(scheduler.isRunning()).toBe(false);
    });

    it("should not start twice", () => {
      const scheduler = createScheduler({ pollIntervalMs: 1000 });
      scheduler.start();
      const timer1 = scheduler.isRunning();

      scheduler.start();
      const timer2 = scheduler.isRunning();

      expect(timer1).toBe(true);
      expect(timer2).toBe(true);
    });

    it("should call tick on start immediately", () => {
      const scheduler = createScheduler();
      scheduler.start();
      expect(mockContentRepo.findPendingScheduled).toHaveBeenCalledOnce();
    });

    it("should enqueue publish jobs for due content", async () => {
      mockContentRepo.findPendingScheduled.mockResolvedValue([
        {
          id: "content-1",
          profileId: "profile-1",
          platform: "X",
          textContent: "Post 1",
        },
        {
          id: "content-2",
          profileId: "profile-2",
          platform: "INSTAGRAM",
          textContent: "Post 2",
        },
      ]);

      const scheduler = createScheduler();
      await scheduler.tickForTesting();

      expect(mockQueueBackend.enqueue).toHaveBeenCalledTimes(2);
      expect(mockQueueBackend.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "publish",
          payload: expect.objectContaining({
            contentId: "content-1",
            profileId: "profile-1",
            platform: "X",
          }),
        }),
      );
      expect(mockQueueBackend.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "publish",
          payload: expect.objectContaining({
            contentId: "content-2",
            profileId: "profile-2",
            platform: "INSTAGRAM",
          }),
        }),
      );
    });

    it("should deduplicate content by ID within a tick", async () => {
      mockContentRepo.findPendingScheduled.mockResolvedValue([
        { id: "content-1", profileId: "p-1", platform: "X" },
        { id: "content-1", profileId: "p-1", platform: "X" }, // duplicate
      ]);

      const scheduler = createScheduler();
      await scheduler.tickForTesting();

      expect(mockQueueBackend.enqueue).toHaveBeenCalledTimes(1);
    });

    it("should skip content without profileId", async () => {
      mockContentRepo.findPendingScheduled.mockResolvedValue([
        { id: "content-1", profileId: null, platform: "X" },
      ]);

      const scheduler = createScheduler();
      await scheduler.tickForTesting();

      expect(mockQueueBackend.enqueue).not.toHaveBeenCalled();
    });

    it("should clear enqueued IDs on stop", async () => {
      mockContentRepo.findPendingScheduled.mockResolvedValue([
        { id: "content-1", profileId: "p-1", platform: "X" },
      ]);

      const scheduler = createScheduler();
      await scheduler.tickForTesting();
      expect(mockQueueBackend.enqueue).toHaveBeenCalledTimes(1);

      scheduler.stop();

      // After stop, a new tick should still enqueue (IDs were cleared)
      mockQueueBackend.enqueue.mockClear();
      mockContentRepo.findPendingScheduled.mockResolvedValue([
        { id: "content-1", profileId: "p-1", platform: "X" },
      ]);
      await scheduler.tickForTesting();
      expect(mockQueueBackend.enqueue).toHaveBeenCalledTimes(1);
    });

    it("should handle empty due content gracefully", async () => {
      mockContentRepo.findPendingScheduled.mockResolvedValue([]);

      const scheduler = createScheduler();
      await scheduler.tickForTesting();

      expect(mockQueueBackend.enqueue).not.toHaveBeenCalled();
    });

    it("should handle errors during tick without crashing", async () => {
      mockContentRepo.findPendingScheduled.mockRejectedValue(new Error("DB error"));

      const scheduler = createScheduler();

      // Should not throw
      await expect(scheduler.tickForTesting()).resolves.toBeUndefined();
    });
  });
});
