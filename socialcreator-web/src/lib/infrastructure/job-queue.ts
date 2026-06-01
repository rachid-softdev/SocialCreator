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
    for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
      try {
        await job.fn();
        queue.delete(id);
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
  });

  return id;
}

export function getQueueSize(): number {
  return queue.size;
}
