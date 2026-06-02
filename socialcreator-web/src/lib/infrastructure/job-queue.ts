/**
 * Lightweight in-process job queue with retry support
 * Replaces Trigger.dev mock for async execution
 */

import logger from "@/lib/logger";

type JobFn = () => Promise<void>;

interface Job {
  id: string;
  name: string;
  fn: JobFn;
  maxAttempts: number;
  retryDelay: number;
}

const queue = new Map<string, Job>();
const runningJobs = new Set<string>();
let completedCount = 0;
let failedCount = 0;

export function enqueueJob(
  name: string,
  fn: JobFn,
  options?: { maxAttempts?: number; retryDelay?: number },
): string {
  const id = crypto.randomUUID();
  const job: Job = {
    id,
    name,
    fn,
    maxAttempts: options?.maxAttempts ?? 3,
    retryDelay: options?.retryDelay ?? 1000,
  };
  queue.set(id, job);

  queueMicrotask(async () => {
    let lastError: Error | null = null;
    runningJobs.add(id);
    for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
      try {
        await job.fn();
        queue.delete(id);
        runningJobs.delete(id);
        completedCount++;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < job.maxAttempts) {
          await new Promise((r) => setTimeout(r, job.retryDelay * 2 ** (attempt - 1)));
        }
      }
    }
    logger.error(
      { job: name, id, attempts: job.maxAttempts, err: lastError },
      "Job failed after all retries",
    );
    queue.delete(id);
    runningJobs.delete(id);
    failedCount++;
  });

  return id;
}

export function getQueueSize(): number {
  return queue.size;
}

export function getQueueStatus(): {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
} {
  return {
    pending: queue.size,
    running: runningJobs.size,
    completed: completedCount,
    failed: failedCount,
    total: queue.size + completedCount + failedCount,
  };
}
