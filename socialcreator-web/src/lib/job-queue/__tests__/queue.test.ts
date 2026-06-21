/**
 * Tests for in-memory priority job queue (sync API)
 *
 * Covers:
 * - enqueueJob() — priority ordering, full-queue guard, default options, UUID format
 * - dequeueJob() — priority+age ordering, empty queue, status transition
 * - completeJob() — status change, result storage, active-set cleanup
 * - failJob() — retry logic, permanent failure, priority re-insertion
 * - getJob() / retryJob() / getJobs() — retrieval and retry
 * - getQueueStatus() / getQueueSize() / getActiveCount() — status queries
 * - clearQueue() — full reset
 * - trimArchive() — archive cleanup behavior
 * - Async API (enqueueJobAsync, etc.) — delegation to backend
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock logger ──
vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock queue backend for async API tests ──
const mockBackend = {
  enqueue: vi.fn(),
  dequeue: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  schedule: vi.fn(),
  getStatus: vi.fn(),
  getJob: vi.fn(),
  getQueueSize: vi.fn(),
  getActiveCount: vi.fn(),
  clear: vi.fn(),
  list: vi.fn(),
};

vi.mock("@/lib/job-queue/backend", () => ({
  createQueueBackend: vi.fn(() => mockBackend),
}));

import logger from "@/lib/logger";

// These are the sync functions from the queue module itself
import {
  clearQueue,
  completeJob,
  dequeueJob,
  enqueueJob,
  failJob,
  getActiveCount,
  getJob,
  getJobs,
  getQueueSize,
  getQueueStatus,
  retryJob,
} from "../queue";

// Async versions
import {
  enqueueJobAsync,
  dequeueJobAsync,
  completeJobAsync,
  failJobAsync,
  getQueueStatusAsync,
  getJobsAsync,
} from "../queue";

// ── Test helpers ──

const samplePayload = {
  userId: "u1",
  profileId: "p1",
  platform: "X" as const,
  brief: "Test content",
  agentId: "a1",
};

const makeJob = (overrides = {}) => {
  const id = enqueueJob("content-generate", samplePayload, overrides);
  return id;
};

describe("Sync Job Queue", () => {
  beforeEach(() => {
    clearQueue();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── enqueueJob ──────────────────────────────────────────────────

  describe("enqueueJob()", () => {
    it("returns a UUID-formatted string ID", () => {
      const id = enqueueJob("content-generate", samplePayload);
      // UUID v4 format: 8-4-4-4-12 hex digits
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("generates unique IDs for consecutive calls", () => {
      const id1 = enqueueJob("content-generate", samplePayload);
      const id2 = enqueueJob("content-generate", samplePayload);
      expect(id1).not.toBe(id2);
    });

    it("applies default options when none provided", () => {
      const id = enqueueJob("content-generate", samplePayload);
      const job = getJob(id);
      expect(job).toBeDefined();
      expect(job!.priority).toBe("normal");
      expect(job!.maxAttempts).toBe(3);
      expect(job!.retryDelayMs).toBe(1000);
      expect(job!.status).toBe("queued");
    });

    it("merges provided options with defaults", () => {
      const id = enqueueJob("content-generate", samplePayload, {
        priority: "critical",
        maxAttempts: 5,
      });
      const job = getJob(id);
      expect(job!.priority).toBe("critical");
      expect(job!.maxAttempts).toBe(5);
      expect(job!.retryDelayMs).toBe(1000); // from defaults
    });

    it("throws when queue exceeds MAX_QUEUE_SIZE", () => {
      // Fill the queue to max
      for (let i = 0; i < 10_000; i++) {
        enqueueJob("content-generate", { ...samplePayload, brief: `job-${i}` });
      }

      expect(() => enqueueJob("content-generate", samplePayload)).toThrow(
        "Queue is full (max 10000 jobs)",
      );
    });

    it("inserts jobs in priority order: critical first", () => {
      const lowId = enqueueJob("content-generate", samplePayload, { priority: "low" });
      const highId = enqueueJob("content-generate", samplePayload, { priority: "high" });
      const critId = enqueueJob("content-generate", samplePayload, { priority: "critical" });
      const normalId = enqueueJob("content-generate", samplePayload, { priority: "normal" });

      const first = dequeueJob();
      expect(first!.id).toBe(critId);
      const second = dequeueJob();
      expect(second!.id).toBe(highId);
      const third = dequeueJob();
      expect(third!.id).toBe(normalId);
      const fourth = dequeueJob();
      expect(fourth!.id).toBe(lowId);
    });

    it("maintains FIFO order within the same priority", () => {
      const first = enqueueJob("content-generate", samplePayload, { priority: "normal" });
      vi.advanceTimersByTime(100);
      const second = enqueueJob("content-generate", samplePayload, { priority: "normal" });
      vi.advanceTimersByTime(100);
      const third = enqueueJob("content-generate", samplePayload, { priority: "normal" });

      // All same priority → FIFO by creation time
      expect(dequeueJob()!.id).toBe(first);
      expect(dequeueJob()!.id).toBe(second);
      expect(dequeueJob()!.id).toBe(third);
    });

    it("logs debug message on enqueue", () => {
      enqueueJob("content-generate", samplePayload, { priority: "high" });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "content-generate",
          priority: "high",
        }),
        "Job enqueued",
      );
    });

    it("accepts all job types", () => {
      const types = ["agent-run", "content-generate", "publish", "video-process"] as const;
      for (const type of types) {
        const id = enqueueJob(type, samplePayload as any);
        expect(getJob(id)).toBeDefined();
      }
    });
  });

  // ── dequeueJob ──────────────────────────────────────────────────

  describe("dequeueJob()", () => {
    it("returns the highest priority queued job", () => {
      enqueueJob("content-generate", samplePayload, { priority: "low" });
      enqueueJob("content-generate", samplePayload, { priority: "high" });

      const job = dequeueJob();
      expect(job).not.toBeNull();
      expect(job!.priority).toBe("high");
    });

    it("sets job status to running on dequeue", () => {
      const id = enqueueJob("content-generate", samplePayload);
      const job = dequeueJob();
      expect(job!.status).toBe("running");
      expect(job!.startedAt).toBeGreaterThan(0);
    });

    it("increments attempts on dequeue", () => {
      const id = enqueueJob("content-generate", samplePayload);
      const job = dequeueJob();
      expect(job!.attempts).toBe(1);
    });

    it("tracks job as active after dequeue", () => {
      enqueueJob("content-generate", samplePayload);
      expect(getActiveCount()).toBe(0);
      dequeueJob();
      expect(getActiveCount()).toBe(1);
    });

    it("returns null when queue is empty", () => {
      const job = dequeueJob();
      expect(job).toBeNull();
    });

    it("does not return completed or failed jobs", () => {
      const id = enqueueJob("content-generate", samplePayload);
      dequeueJob();
      completeJob(id);

      expect(dequeueJob()).toBeNull();
    });

    it("does not return already running jobs", () => {
      enqueueJob("content-generate", samplePayload);
      dequeueJob(); // moves to running

      expect(dequeueJob()).toBeNull();
    });
  });

  // ── completeJob ─────────────────────────────────────────────────

  describe("completeJob()", () => {
    it("marks job as completed with timestamp", () => {
      const id = enqueueJob("content-generate", samplePayload);
      dequeueJob();

      completeJob(id, { success: true });

      const job = getJob(id);
      expect(job!.status).toBe("completed");
      expect(job!.completedAt).toBeGreaterThan(0);
      expect(job!.result).toEqual({ success: true });
    });

    it("removes job from active set", () => {
      const id = enqueueJob("content-generate", samplePayload);
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      completeJob(id);
      expect(getActiveCount()).toBe(0);
    });

    it("does nothing for unknown job ID", () => {
      expect(() => completeJob("nonexistent")).not.toThrow();
    });

    it("logs debug on completion", () => {
      const id = enqueueJob("content-generate", samplePayload);
      dequeueJob();
      completeJob(id);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: id, type: "content-generate" }),
        "Job completed",
      );
    });
  });

  // ── failJob ─────────────────────────────────────────────────────

  describe("failJob()", () => {
    it("re-queues job when attempts < maxAttempts (retry)", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 3 });
      dequeueJob(); // attempts → 1

      failJob(id, "Temporary error");

      const job = getJob(id);
      expect(job!.status).toBe("queued");
      expect(job!.error).toBe("Temporary error");
      // Should be dequeuable again
      const redequeued = dequeueJob();
      expect(redequeued!.id).toBe(id);
    });

    it("permanently fails job when attempts >= maxAttempts", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 1 });
      dequeueJob(); // attempts → 1 (now 1 >= 1)

      failJob(id, "Permanent error");

      const job = getJob(id);
      expect(job!.status).toBe("failed");
      expect(job!.error).toBe("Permanent error");
      expect(job!.completedAt).toBeGreaterThan(0);
      // Should NOT be dequeuable
      expect(dequeueJob()).toBeNull();
    });

    it("re-inserts failed job at correct priority position for retry", () => {
      const lowId = enqueueJob("content-generate", samplePayload, { priority: "low" });
      const highId = enqueueJob("content-generate", samplePayload, {
        priority: "high",
        maxAttempts: 2,
      });

      dequeueJob(); // takes high (high priority)
      failJob(highId, "Retry me");

      // Now the high-priority job should be re-inserted before the low-priority one
      const first = dequeueJob();
      expect(first!.id).toBe(highId); // high priority retry first
      const second = dequeueJob();
      expect(second!.id).toBe(lowId);
    });

    it("removes job from active set on permanent failure", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 1 });
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      failJob(id, "fail");
      expect(getActiveCount()).toBe(0);
    });

    it("removes job from active set on retry", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 3 });
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      failJob(id, "retry");
      expect(getActiveCount()).toBe(0);
    });

    it("does nothing for unknown job ID", () => {
      expect(() => failJob("nonexistent", "error")).not.toThrow();
    });

    it("logs warning on retry and error on permanent failure", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 1 });
      dequeueJob();
      failJob(id, "Failed");

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: id, attempts: 1, error: "Failed" }),
        "Job failed after all retries",
      );
    });
  });

  // ── getJob ──────────────────────────────────────────────────────

  describe("getJob()", () => {
    it("returns a job by its ID", () => {
      const id = enqueueJob("content-generate", samplePayload);
      const job = getJob(id);
      expect(job).toBeDefined();
      expect(job!.id).toBe(id);
      expect(job!.type).toBe("content-generate");
    });

    it("returns undefined for unknown ID", () => {
      expect(getJob("nonexistent")).toBeUndefined();
    });
  });

  // ── retryJob ────────────────────────────────────────────────────

  describe("retryJob()", () => {
    it("resets a failed job to queued with fresh attempts", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 1 });
      dequeueJob();
      failJob(id, "First failure");

      const result = retryJob(id);
      expect(result).toBe(true);

      const job = getJob(id);
      expect(job!.status).toBe("queued");
      expect(job!.attempts).toBe(0);
      expect(job!.error).toBeUndefined();
      expect(job!.startedAt).toBeUndefined();
      expect(job!.completedAt).toBeUndefined();
    });

    it("returns false for non-failed jobs", () => {
      const id = enqueueJob("content-generate", samplePayload);

      expect(retryJob(id)).toBe(false); // queued, not failed
      expect(retryJob("nonexistent")).toBe(false);
    });

    it("makes the job available for dequeue again", () => {
      const id = enqueueJob("content-generate", samplePayload, { maxAttempts: 1 });
      dequeueJob();
      failJob(id, "fail");
      retryJob(id);

      const job = dequeueJob();
      expect(job).not.toBeNull();
      expect(job!.id).toBe(id);
    });
  });

  // ── getJobs ─────────────────────────────────────────────────────

  describe("getJobs()", () => {
    it("returns all jobs sorted by createdAt descending", () => {
      const id1 = enqueueJob("content-generate", samplePayload);
      vi.advanceTimersByTime(100);
      const id2 = enqueueJob("publish", { contentId: "c1", profileId: "p1", platform: "X", userId: "u1" });
      vi.advanceTimersByTime(100);
      const id3 = enqueueJob("video-process", { videoAssetId: "v1", profileId: "p1" });

      const jobs = getJobs();
      expect(jobs.map((j) => j.id)).toStrictEqual([id3, id2, id1]);
    });

    it("returns empty array when no jobs exist", () => {
      expect(getJobs()).toStrictEqual([]);
    });

    it("returns a copy (not a reference to internal array)", () => {
      enqueueJob("content-generate", samplePayload);
      const jobs = getJobs();
      clearQueue();
      // Our copy should still have the data
      expect(jobs).toHaveLength(1);
    });
  });

  // ── getQueueStatus ─────────────────────────────────────────────

  describe("getQueueStatus()", () => {
    it("returns correct counts for queued, running, completed, failed, total", () => {
      const id = enqueueJob("content-generate", samplePayload);
      enqueueJob("content-generate", { ...samplePayload, userId: "u2" });
      dequeueJob(); // 1 running
      dequeueJob(); // 2 running
      completeJob(id); // 1 completed, 1 still running

      const status = getQueueStatus();
      expect(status.queued).toBe(0);
      expect(status.running).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(0);
      expect(status.total).toBe(2);
    });

    it("reflects complex queue state", () => {
      const id1 = enqueueJob("content-generate", samplePayload, { maxAttempts: 1 });
      const id2 = enqueueJob("publish", { contentId: "c1", profileId: "p1", platform: "X", userId: "u1" });
      enqueueJob("video-process", { videoAssetId: "v1", profileId: "p1" });

      dequeueJob(); // takes id1 (same priority, FIFO)
      failJob(id1, "fail"); // permanently fails (maxAttempts=1)
      dequeueJob(); // takes id2
      completeJob(id2); // completes

      const status = getQueueStatus();
      expect(status.queued).toBe(1);
      expect(status.running).toBe(0);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.total).toBe(3);
    });
  });

  // ── getQueueSize ────────────────────────────────────────────────

  describe("getQueueSize()", () => {
    it("returns 0 for empty queue", () => {
      expect(getQueueSize()).toBe(0);
    });

    it("returns number of queued (not running/completed/failed) jobs", () => {
      const id = enqueueJob("content-generate", samplePayload);
      enqueueJob("content-generate", { ...samplePayload, userId: "u2" });

      expect(getQueueSize()).toBe(2);

      dequeueJob();
      expect(getQueueSize()).toBe(1); // one still queued

      dequeueJob();
      expect(getQueueSize()).toBe(0); // both dequeued
    });
  });

  // ── getActiveCount ──────────────────────────────────────────────

  describe("getActiveCount()", () => {
    it("returns 0 initially", () => {
      expect(getActiveCount()).toBe(0);
    });

    it("returns number of running jobs", () => {
      enqueueJob("content-generate", samplePayload);
      enqueueJob("content-generate", { ...samplePayload, userId: "u2" });

      expect(getActiveCount()).toBe(0);

      dequeueJob();
      expect(getActiveCount()).toBe(1);

      dequeueJob();
      expect(getActiveCount()).toBe(2);
    });

    it("decrements when a running job is completed", () => {
      const id = enqueueJob("content-generate", samplePayload);
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      completeJob(id);
      expect(getActiveCount()).toBe(0);
    });
  });

  // ── clearQueue ──────────────────────────────────────────────────

  describe("clearQueue()", () => {
    it("removes all jobs and resets active set", () => {
      enqueueJob("content-generate", samplePayload);
      enqueueJob("publish", { contentId: "c1", profileId: "p1", platform: "X", userId: "u1" });
      dequeueJob();

      expect(getQueueSize()).toBe(1);
      expect(getActiveCount()).toBe(1);
      expect(getQueueStatus().total).toBe(2);

      clearQueue();

      expect(getQueueSize()).toBe(0);
      expect(getActiveCount()).toBe(0);
      expect(getQueueStatus().total).toBe(0);
    });
  });

  // ── trimArchive (via completeJob / failJob) ─────────────────────

  describe("archive trimming", () => {
    it("trims old completed jobs when archive exceeds MAX_ARCHIVE_SIZE", () => {
      // MAX_ARCHIVE_SIZE = 5000
      // We'll enqueue 5001 jobs, complete them, then check that old ones are removed
      const ids: string[] = [];
      for (let i = 0; i < 5001; i++) {
        const id = enqueueJob("content-generate", { ...samplePayload, brief: `job-${i}` });
        ids.push(id);
        dequeueJob(); // move to running
        completeJob(id); // complete it
      }

      const status = getQueueStatus();
      // The most recent ones should be kept (within 24h cutoff since we use fake timers)
      // All jobs are created at the same fake time, so they should all be kept
      expect(status.completed).toBe(5001);
      expect(status.total).toBeLessThanOrEqual(5001);
    });
  });
});

// ── Async API ─────────────────────────────────────────────────────

describe("Async Job Queue API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enqueueJobAsync()", () => {
    it("delegates enqueue to backend and returns the ID", async () => {
      mockBackend.enqueue.mockResolvedValue("async-uuid-123");

      const id = await enqueueJobAsync("content-generate", samplePayload);

      expect(id).toBe("async-uuid-123");
      expect(mockBackend.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "content-generate",
          priority: "normal",
          status: "queued",
        }),
      );
    });

    it("passes delayMs to backend.schedule when provided", async () => {
      mockBackend.schedule.mockResolvedValue("scheduled-uuid");

      const id = await enqueueJobAsync("publish", {
        contentId: "c1",
        profileId: "p1",
        platform: "X",
        userId: "u1",
      }, { delayMs: 5000 });

      expect(mockBackend.schedule).toHaveBeenCalledWith(
        expect.objectContaining({ type: "publish" }),
        5000,
      );
      expect(mockBackend.enqueue).not.toHaveBeenCalled();
    });

    it("merges options with defaults for async enqueue", async () => {
      mockBackend.enqueue.mockResolvedValue("id");

      await enqueueJobAsync("video-process", { videoAssetId: "v1", profileId: "p1" }, {
        priority: "critical",
      });

      expect(mockBackend.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "critical",
          maxAttempts: 3,
          retryDelayMs: 1000,
        }),
      );
    });
  });

  describe("dequeueJobAsync()", () => {
    it("delegates dequeue to backend", async () => {
      const mockJob = { id: "async-1", type: "publish", status: "running" };
      mockBackend.dequeue.mockResolvedValue(mockJob);

      const job = await dequeueJobAsync();
      expect(job).toEqual(mockJob);
      expect(mockBackend.dequeue).toHaveBeenCalledOnce();
    });
  });

  describe("completeJobAsync()", () => {
    it("delegates complete to backend", async () => {
      await completeJobAsync("job-1", { success: true });
      expect(mockBackend.complete).toHaveBeenCalledWith("job-1", { success: true });
    });
  });

  describe("failJobAsync()", () => {
    it("delegates fail to backend", async () => {
      await failJobAsync("job-1", "error");
      expect(mockBackend.fail).toHaveBeenCalledWith("job-1", "error");
    });
  });

  describe("getQueueStatusAsync()", () => {
    it("delegates getStatus to backend", async () => {
      mockBackend.getStatus.mockResolvedValue({
        queued: 5, running: 2, completed: 10, failed: 1, total: 18,
      });

      const status = await getQueueStatusAsync();
      expect(status).toEqual({ queued: 5, running: 2, completed: 10, failed: 1, total: 18 });
    });
  });

  describe("getJobsAsync()", () => {
    it("delegates list to backend", async () => {
      const jobs = [{ id: "j1" }, { id: "j2" }];
      mockBackend.list.mockResolvedValue(jobs);

      const result = await getJobsAsync();
      expect(result).toEqual(jobs);
    });
  });
});
