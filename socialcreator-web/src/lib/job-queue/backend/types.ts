/**
 * Queue Backend Abstraction
 * Allows swapping between in-memory, Redis/BullMQ, or other backends
 */

import type { Job } from "../types";

export interface QueueStatus {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export interface QueueBackend {
  /** Enqueue a job and return its ID */
  enqueue(job: Omit<Job, "id">): Promise<string>;

  /** Dequeue the next available job */
  dequeue(): Promise<Job | null>;

  /** Mark a job as completed */
  complete(id: string, result?: unknown): Promise<void>;

  /** Mark a job as failed (with auto-retry if attempts remain) */
  fail(id: string, error: string): Promise<void>;

  /** Schedule a job to run after a delay */
  schedule(job: Omit<Job, "id">, delayMs: number): Promise<string>;

  /** Get queue status summary */
  getStatus(): Promise<QueueStatus>;

  /** Get a job by ID */
  getJob(id: string): Promise<Job | undefined>;

  /** Get number of queued (pending) jobs */
  getQueueSize(): Promise<number>;

  /** Get number of active (running) jobs */
  getActiveCount(): Promise<number>;

  /** Clear all jobs (for testing) */
  clear(): Promise<void>;

  /** List all jobs sorted by createdAt descending */
  list(): Promise<Job[]>;
}
