/**
 * Enhanced in-process priority queue with status tracking
 * Backward compatible with existing enqueueJob from infrastructure/job-queue.ts
 */

import { randomUUID } from "node:crypto";
import logger from "@/lib/logger";
import type { Job, JobOptions, JobPayload, JobPriority, JobType } from "./types";

const DEFAULT_OPTIONS = {
  priority: "normal" as JobPriority,
  maxAttempts: 3,
  retryDelayMs: 1000,
};

const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const jobQueue: Job[] = [];
const activeJobs = new Set<string>();

/**
 * Enqueue a new job with priority-based insertion
 */
export function enqueueJob<T extends JobPayload>(
  type: JobType,
  payload: T,
  options: JobOptions = {},
): string {
  const id = randomUUID();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const job: Job = {
    id,
    type,
    payload,
    priority: opts.priority,
    status: "queued",
    attempts: 0,
    maxAttempts: opts.maxAttempts,
    retryDelayMs: opts.retryDelayMs,
    createdAt: Date.now(),
  };

  // Insert in priority order (critical first)
  const insertIndex = jobQueue.findIndex(
    (j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[job.priority],
  );

  if (insertIndex === -1) {
    jobQueue.push(job);
  } else {
    jobQueue.splice(insertIndex, 0, job);
  }

  logger.debug({ jobId: id, type, priority: opts.priority }, "Job enqueued");
  return id;
}

/**
 * Dequeue the next available job (highest priority, oldest first)
 */
export function dequeueJob(): Job | null {
  const idx = jobQueue.findIndex((j) => j.status === "queued");
  if (idx === -1) return null;

  const job = jobQueue[idx];
  job.status = "running";
  job.startedAt = Date.now();
  job.attempts++;
  activeJobs.add(job.id);

  return job;
}

/**
 * Mark a job as completed
 */
export function completeJob(id: string, result?: unknown): void {
  const job = jobQueue.find((j) => j.id === id);
  if (!job) return;

  job.status = "completed";
  job.completedAt = Date.now();
  job.result = result;
  activeJobs.delete(id);

  logger.debug({ jobId: id, type: job.type }, "Job completed");
}

/**
 * Mark a job as failed, with automatic retry if attempts remain
 */
export function failJob(id: string, error: string): void {
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
    if (insertIndex === -1) {
      jobQueue.push(job);
    } else {
      jobQueue.splice(insertIndex, 0, job);
    }

    logger.warn(
      { jobId: id, type: job.type, attempt: job.attempts, maxAttempts: job.maxAttempts },
      "Job failed, will retry",
    );
  } else {
    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
    activeJobs.delete(id);

    logger.error(
      { jobId: id, type: job.type, attempts: job.maxAttempts, error },
      "Job failed after all retries",
    );
  }
}

/**
 * Get a job by ID
 */
export function getJob(id: string): Job | undefined {
  return jobQueue.find((j) => j.id === id);
}

/**
 * Get queue status summary
 */
export function getQueueStatus() {
  return {
    queued: jobQueue.filter((j) => j.status === "queued").length,
    running: activeJobs.size,
    completed: jobQueue.filter((j) => j.status === "completed").length,
    failed: jobQueue.filter((j) => j.status === "failed").length,
    total: jobQueue.length,
  };
}

/**
 * Get number of currently active (running) jobs
 */
export function getActiveCount(): number {
  return activeJobs.size;
}
