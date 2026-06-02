/**
 * Tests for enhanced job queue
 * Based on design spec: docs/architecture/02-async-agent-queue.md
 *
 * Self-contained: implements the queue logic inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline implementation matching the design spec ==========

type JobPriority = "low" | "normal" | "high" | "critical";
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type JobType = "agent-run" | "content-generate" | "publish" | "video-process";

interface JobPayload {
  [key: string]: unknown;
}

interface Job {
  id: string;
  type: JobType;
  payload: JobPayload;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  retryDelayMs: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

interface JobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  retryDelayMs?: number;
}

const DEFAULT_OPTIONS = { priority: "normal" as JobPriority, maxAttempts: 3, retryDelayMs: 1000 };
const PRIORITY_ORDER: Record<JobPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

let jobQueue: Job[] = [];
const activeJobs = new Set<string>();
let idCounter = 0;

function resetQueueForTest() {
  jobQueue = [];
  activeJobs.clear();
  idCounter = 0;
}

function enqueueJob(type: JobType, payload: JobPayload, options: JobOptions = {}): string {
  const id = `job-${++idCounter}`;
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const job: Job = {
    id,
    type,
    payload,
    priority: opts.priority!,
    status: "queued",
    attempts: 0,
    maxAttempts: opts.maxAttempts!,
    retryDelayMs: opts.retryDelayMs!,
    createdAt: Date.now(),
  };
  const insertIndex = jobQueue.findIndex(
    (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[job.priority],
  );
  if (insertIndex === -1) jobQueue.push(job);
  else jobQueue.splice(insertIndex, 0, job);
  return id;
}

function dequeueJob(): Job | null {
  const idx = jobQueue.findIndex((j) => j.status === "queued");
  if (idx === -1) return null;
  const job = jobQueue[idx];
  job.status = "running";
  job.startedAt = Date.now();
  job.attempts++;
  activeJobs.add(job.id);
  return job;
}

function completeJob(id: string, result?: unknown): void {
  const job = jobQueue.find((j) => j.id === id);
  if (job) {
    job.status = "completed";
    job.completedAt = Date.now();
    job.result = result;
    activeJobs.delete(id);
  }
}

function failJob(id: string, error: string): void {
  const jobIndex = jobQueue.findIndex((j) => j.id === id);
  if (jobIndex === -1) return;
  const job = jobQueue[jobIndex];
  if (job.attempts < job.maxAttempts) {
    // Reinsert at correct priority position instead of relying on stale array order
    jobQueue.splice(jobIndex, 1);
    job.status = "queued";
    job.error = error;
    activeJobs.delete(id);

    const insertIndex = jobQueue.findIndex(
      (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[job.priority],
    );
    if (insertIndex === -1) jobQueue.push(job);
    else jobQueue.splice(insertIndex, 0, job);
  } else {
    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
    activeJobs.delete(id);
  }
}

function getJob(id: string): Job | undefined {
  return jobQueue.find((j) => j.id === id);
}

function getQueueStatus() {
  return {
    queued: jobQueue.filter((j) => j.status === "queued").length,
    running: activeJobs.size,
    completed: jobQueue.filter((j) => j.status === "completed").length,
    failed: jobQueue.filter((j) => j.status === "failed").length,
    total: jobQueue.length,
  };
}

function getActiveCount(): number {
  return activeJobs.size;
}

// ========== Tests ==========

describe("Job Queue", () => {
  beforeEach(() => {
    resetQueueForTest();
  });

  describe("enqueueJob", () => {
    it("should enqueue a job and return its id", () => {
      const id = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });

      expect(typeof id).toBe("string");
      expect(id).toBe("job-1");
    });

    it("should enqueue with default options when not specified", () => {
      const id = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });

      const job = getJob(id);
      expect(job).toBeDefined();
      expect(job!.priority).toBe("normal");
      expect(job!.maxAttempts).toBe(3);
      expect(job!.retryDelayMs).toBe(1000);
      expect(job!.status).toBe("queued");
      expect(job!.attempts).toBe(0);
    });

    it("should apply custom options", () => {
      const id = enqueueJob(
        "publish",
        { contentId: "c-1", profileId: "p-1", platform: "X", userId: "u-1" },
        { priority: "high", maxAttempts: 5, retryDelayMs: 2000 },
      );

      const job = getJob(id);
      expect(job!.priority).toBe("high");
      expect(job!.maxAttempts).toBe(5);
      expect(job!.retryDelayMs).toBe(2000);
    });

    it("should generate unique ids for multiple jobs", () => {
      const id1 = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      const id2 = enqueueJob("content-generate", {
        profileId: "p-1",
        platform: "X",
        brief: "test",
        agentId: "a-1",
      });

      expect(id1).toBe("job-1");
      expect(id2).toBe("job-2");
      expect(id1).not.toBe(id2);
    });

    it("should store the job type and payload correctly", () => {
      const id = enqueueJob("video-process", { videoAssetId: "v-1", profileId: "p-1" });

      const job = getJob(id);
      expect(job!.type).toBe("video-process");
      expect(job!.payload.videoAssetId).toBe("v-1");
    });
  });

  describe("Priority ordering", () => {
    it("should order jobs by priority: critical first, low last", () => {
      enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" }, { priority: "low" });
      enqueueJob(
        "agent-run",
        { agentId: "a-2", runId: "r-2", userId: "u-1" },
        { priority: "critical" },
      );
      enqueueJob(
        "agent-run",
        { agentId: "a-3", runId: "r-3", userId: "u-1" },
        { priority: "high" },
      );
      enqueueJob(
        "agent-run",
        { agentId: "a-4", runId: "r-4", userId: "u-1" },
        { priority: "normal" },
      );

      const job1 = dequeueJob();
      expect(job1!.priority).toBe("critical");

      const job2 = dequeueJob();
      expect(job2!.priority).toBe("high");

      const job3 = dequeueJob();
      expect(job3!.priority).toBe("normal");

      const job4 = dequeueJob();
      expect(job4!.priority).toBe("low");
    });

    it("should maintain FIFO order within the same priority", () => {
      enqueueJob(
        "agent-run",
        { agentId: "a-1", runId: "r-1", userId: "u-1" },
        { priority: "normal" },
      );
      enqueueJob(
        "agent-run",
        { agentId: "a-2", runId: "r-2", userId: "u-1" },
        { priority: "normal" },
      );
      enqueueJob(
        "agent-run",
        { agentId: "a-3", runId: "r-3", userId: "u-1" },
        { priority: "normal" },
      );

      expect(dequeueJob()!.id).toBe("job-1");
      expect(dequeueJob()!.id).toBe("job-2");
      expect(dequeueJob()!.id).toBe("job-3");
    });
  });

  describe("dequeueJob", () => {
    it("should return null when queue is empty", () => {
      const job = dequeueJob();
      expect(job).toBeNull();
    });

    it("should mark dequeued job as running and increment attempts", () => {
      enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });

      const job = dequeueJob();

      expect(job!.status).toBe("running");
      expect(job!.attempts).toBe(1);
      expect(job!.startedAt).toBeDefined();
    });

    it("should only dequeue jobs with status 'queued'", () => {
      enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      dequeueJob();

      const job2 = dequeueJob();
      expect(job2).toBeNull();
    });
  });

  describe("Status transitions", () => {
    it("should complete a running job", () => {
      const id = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      dequeueJob();

      completeJob(id, { data: "result" });

      const completed = getJob(id);
      expect(completed!.status).toBe("completed");
      expect(completed!.completedAt).toBeDefined();
      expect(completed!.result).toStrictEqual({ data: "result" });
    });

    it("should fail a job and requeue if attempts remain", () => {
      const id = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      dequeueJob();

      failJob(id, "Temporary error");

      const job = getJob(id);
      expect(job!.status).toBe("queued");
      expect(job!.error).toBe("Temporary error");
    });

    it("should mark job as failed after exhausting maxAttempts", () => {
      const id = enqueueJob(
        "agent-run",
        { agentId: "a-1", runId: "r-1", userId: "u-1" },
        { maxAttempts: 2 },
      );

      dequeueJob();
      failJob(id, "Error 1");
      expect(getJob(id)!.status).toBe("queued");

      dequeueJob();
      failJob(id, "Error 2");

      const job = getJob(id);
      expect(job!.status).toBe("failed");
      expect(job!.error).toBe("Error 2");
      expect(job!.completedAt).toBeDefined();
    });

    it("should handle completeJob for nonexistent id gracefully", () => {
      expect(() => completeJob("nonexistent")).not.toThrow();
    });

    it("should handle failJob for nonexistent id gracefully", () => {
      expect(() => failJob("nonexistent", "Error")).not.toThrow();
    });

    it("should reinsert failed job at correct priority position when retrying", () => {
      // Enqueue a low priority job first, then a high priority job
      const lowId = enqueueJob(
        "agent-run",
        { agentId: "a-1", runId: "r-1", userId: "u-1" },
        { priority: "low" },
      );
      const highId = enqueueJob(
        "agent-run",
        { agentId: "a-2", runId: "r-2", userId: "u-1" },
        { priority: "high" },
      );

      // Dequeue the high priority job (first in priority order)
      const dequeued = dequeueJob();
      expect(dequeued!.id).toBe(highId);

      // Fail the high priority job — it should be reinserted at correct priority position
      failJob(highId, "Retry");

      // Next dequeue should return the high priority job again (it's still highest priority)
      const next = dequeueJob();
      expect(next!.id).toBe(highId);
    });

    it("should reinsert retried job at correct priority position when re-queued", () => {
      // Enqueue a low priority job
      const lowId = enqueueJob(
        "agent-run",
        { agentId: "a-1", runId: "r-1", userId: "u-1" },
        { priority: "low" },
      );

      // Dequeue it (it's the only one)
      dequeueJob();
      expect(getJob(lowId)!.status).toBe("running");

      // Enqueue more jobs while the first is running — mix of priorities
      const criticalId = enqueueJob(
        "agent-run",
        { agentId: "a-2", runId: "r-2", userId: "u-1" },
        { priority: "critical" },
      );
      enqueueJob(
        "agent-run",
        { agentId: "a-3", runId: "r-3", userId: "u-1" },
        { priority: "normal" },
      );

      // Fail the low priority job — it should be reinserted after higher priority jobs
      failJob(lowId, "Retry");

      // dequeue order should be: critical, then normal, then low (priority order)
      const job1 = dequeueJob();
      expect(job1!.id).toBe(criticalId);
      expect(job1!.priority).toBe("critical");

      const job2 = dequeueJob();
      expect(job2!.priority).toBe("normal");

      const job3 = dequeueJob();
      expect(job3!.id).toBe(lowId);
      expect(job3!.priority).toBe("low");
    });
  });

  describe("getJob", () => {
    it("should return undefined for nonexistent job", () => {
      const job = getJob("nonexistent");
      expect(job).toBeUndefined();
    });
  });

  describe("getQueueStatus", () => {
    it("should initialize with all zeros", () => {
      const status = getQueueStatus();
      expect(status).toStrictEqual({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        total: 0,
      });
    });

    it("should return correct counts for mixed queue states", () => {
      enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      enqueueJob("agent-run", { agentId: "a-2", runId: "r-2", userId: "u-1" }, { maxAttempts: 1 });
      enqueueJob("agent-run", { agentId: "a-3", runId: "r-3", userId: "u-1" });
      enqueueJob("agent-run", { agentId: "a-4", runId: "r-4", userId: "u-1" });

      // Complete one
      dequeueJob();
      completeJob("job-1");

      // Run and fail one (exhausted)
      dequeueJob();
      failJob("job-2", "Fatal");

      // Start one but don't complete (job-3)
      dequeueJob();

      // job-4 is still queued
      const status = getQueueStatus();

      expect(status.queued).toBe(1);
      expect(status.running).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.total).toBe(4);
    });
  });

  describe("getActiveCount", () => {
    it("should return 0 when no jobs are running", () => {
      expect(getActiveCount()).toBe(0);
    });

    it("should return the number of running jobs", () => {
      enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      enqueueJob("agent-run", { agentId: "a-2", runId: "r-2", userId: "u-1" });

      dequeueJob();
      dequeueJob();

      expect(getActiveCount()).toBe(2);
    });

    it("should decrement when a running job completes", () => {
      const id = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      completeJob(id);
      expect(getActiveCount()).toBe(0);
    });

    it("should decrement when a running job fails with retries remaining", () => {
      const id = enqueueJob("agent-run", { agentId: "a-1", runId: "r-1", userId: "u-1" });
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      failJob(id, "Retryable error");
      expect(getActiveCount()).toBe(0);
    });

    it("should decrement when a running job fails with no retries remaining", () => {
      const id = enqueueJob(
        "agent-run",
        { agentId: "a-1", runId: "r-1", userId: "u-1" },
        { maxAttempts: 1 },
      );
      dequeueJob();
      expect(getActiveCount()).toBe(1);

      failJob(id, "Final error");
      expect(getActiveCount()).toBe(0);
    });
  });
});
