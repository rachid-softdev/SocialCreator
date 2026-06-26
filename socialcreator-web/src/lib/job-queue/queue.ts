/**
 * Enhanced in-process priority queue with status tracking
 * Backward compatible with existing enqueueJob from infrastructure/job-queue.ts
 *
 * This module provides BOTH synchronous (in-memory only) and asynchronous
 * (QueueBackend) job queue APIs. The sync API is used by existing callers
 * and tests. The async API delegates to the configured QueueBackend
 * (InMemoryQueueBackend by default, Redis/BullMQ when configured).
 */

import { randomUUID } from "node:crypto";
import logger from "@/lib/logger";
import { createQueueBackend } from "./backend";
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

const MAX_QUEUE_SIZE = 10_000;

let jobQueue: Job[] = [];
const activeJobs = new Set<string>();

// ── Synchronous API (in-memory only, backward compat) ──────────

/**
 * Enqueue a new job with priority-based insertion
 */
export function enqueueJob<T extends JobPayload>(
  type: JobType,
  payload: T,
  options: JobOptions = {},
): string {
  if (jobQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error(`Queue is full (max ${MAX_QUEUE_SIZE} jobs)`);
  }

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

  const job = jobQueue[idx]!;
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

  trimArchive();
}

/**
 * Mark a job as failed, with automatic retry if attempts remain
 */
export function failJob(id: string, error: string): void {
  const jobIndex = jobQueue.findIndex((j) => j.id === id);
  if (jobIndex === -1) return;
  const job = jobQueue[jobIndex]!;

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

  trimArchive();
}

/**
 * Get a job by ID
 */
export function getJob(id: string): Job | undefined {
  return jobQueue.find((j) => j.id === id);
}

/**
 * Retry a failed job — reset it to queued status with fresh attempts
 * Returns true if the job was found and reset, false otherwise
 */
export function retryJob(id: string): boolean {
  const job = jobQueue.find((j) => j.id === id);
  if (!job || job.status !== "failed") return false;
  job.status = "queued";
  job.attempts = 0;
  job.error = undefined;
  job.startedAt = undefined;
  job.completedAt = undefined;
  return true;
}

/**
 * Get all jobs sorted by createdAt descending (sync in-memory version)
 */
export function getJobs(): Job[] {
  return [...jobQueue].sort((a, b) => b.createdAt - a.createdAt);
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
 * Get number of currently queued jobs (backward compat with old getQueueSize)
 */
export function getQueueSize(): number {
  return jobQueue.filter((j) => j.status === "queued").length;
}

/**
 * Get number of currently active (running) jobs
 */
export function getActiveCount(): number {
  return activeJobs.size;
}

/**
 * Clear all jobs from the queue (for testing)
 */
export function clearQueue(): void {
  jobQueue.length = 0;
  activeJobs.clear();
}

const MAX_ARCHIVE_SIZE = 5_000;
function trimArchive(): void {
  const completedCount = jobQueue.filter(
    (j) => j.status === "completed" || j.status === "failed",
  ).length;
  if (completedCount > MAX_ARCHIVE_SIZE) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h
    jobQueue = jobQueue.filter(
      (j) =>
        j.status === "queued" ||
        j.status === "running" ||
        (j.completedAt && j.completedAt > cutoff),
    );
  }
}

// ── Async API (QueueBackend, for production use) ───────────────

let backendInitialized = false;

function getBackend() {
  if (!backendInitialized) {
    backendInitialized = true;
  }
  return createQueueBackend();
}

/**
 * Async version of enqueueJob that uses the configured QueueBackend.
 * When Redis/BullMQ is configured, jobs are persisted and survive restarts.
 */
export async function enqueueJobAsync<T extends JobPayload>(
  type: JobType,
  payload: T,
  options: JobOptions & { delayMs?: number } = {},
): Promise<string> {
  const backend = getBackend();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const job: Omit<Job, "id"> = {
    type,
    payload,
    priority: opts.priority,
    status: "queued",
    attempts: 0,
    maxAttempts: opts.maxAttempts,
    retryDelayMs: opts.retryDelayMs,
    createdAt: Date.now(),
  };

  if (options.delayMs && options.delayMs > 0) {
    return backend.schedule(job, options.delayMs);
  }

  return backend.enqueue(job);
}

/**
 * Async version of dequeueJob.
 */
export async function dequeueJobAsync(): Promise<Job | null> {
  return getBackend().dequeue();
}

/**
 * Async version of completeJob.
 */
export async function completeJobAsync(id: string, result?: unknown): Promise<void> {
  return getBackend().complete(id, result);
}

/**
 * Async version of failJob.
 */
export async function failJobAsync(id: string, error: string): Promise<void> {
  return getBackend().fail(id, error);
}

/**
 * Async version of getQueueStatus.
 */
export async function getQueueStatusAsync() {
  return getBackend().getStatus();
}

/**
 * Async version of getJobs — delegates to QueueBackend.list()
 */
export async function getJobsAsync(): Promise<Job[]> {
  return getBackend().list();
}
