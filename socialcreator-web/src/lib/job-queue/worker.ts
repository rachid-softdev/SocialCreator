/**
 * Worker pattern for processing async jobs
 * Polls the queue, respects concurrency cap, handles errors
 *
 * Supports both sync (in-memory) and async (QueueBackend) modes.
 * By default uses the in-memory sync API. Pass useAsync=true to use the
 * configured QueueBackend (e.g. Redis/BullMQ).
 */

import logger from "@/lib/logger";
import { getJobHandler } from "./handlers";
import {
  completeJob,
  completeJobAsync,
  dequeueJob,
  dequeueJobAsync,
  failJob,
  failJobAsync,
  getActiveCount,
} from "./queue";
import type { Job } from "./types";

const POLL_INTERVAL_MS = 500;
const MAX_CONCURRENT = 3;
const JOB_TIMEOUT_MS = 30_000;

let running = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let useAsyncMode = false;

/**
 * Start the worker loop
 * @param options.mode - "sync" (in-memory, default) or "async" (QueueBackend)
 */
export function startWorker(options?: { mode?: "sync" | "async" }): void {
  if (running) return;

  useAsyncMode = options?.mode === "async";
  running = true;

  logger.info(
    { maxConcurrent: MAX_CONCURRENT, pollInterval: POLL_INTERVAL_MS, mode: useAsyncMode ? "async" : "sync" },
    "Job worker started",
  );

  pollTimer = setInterval(() => {
    if (getActiveCount() >= MAX_CONCURRENT) return;

    if (useAsyncMode) {
      dequeueJobAsync()
        .then((job) => {
          if (!job) return;
          processJob(job).catch((err) =>
            logger.error({ jobId: job.id, err }, "Unhandled worker error"),
          );
        })
        .catch((err) => logger.error({ err }, "Failed to dequeue job"));
    } else {
      const job = dequeueJob();
      if (!job) return;

      processJob(job).catch((err) =>
        logger.error({ jobId: job.id, err }, "Unhandled worker error"),
      );
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the worker loop
 */
export function stopWorker(): void {
  running = false;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  logger.info("Job worker stopped");
}

/**
 * Process a single job: look up handler, execute, handle result
 */
async function processJob(job: Job): Promise<void> {
  const handler = getJobHandler(job.type);

  if (!handler) {
    if (useAsyncMode) {
      await failJobAsync(job.id, `No handler registered for job type: ${job.type}`);
    } else {
      failJob(job.id, `No handler registered for job type: ${job.type}`);
    }
    return;
  }

  try {
    await Promise.race([
      handler(job.payload),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Job timed out")), JOB_TIMEOUT_MS),
      ),
    ]);
    if (useAsyncMode) {
      await completeJobAsync(job.id);
    } else {
      completeJob(job.id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (useAsyncMode) {
      await failJobAsync(job.id, message);
    } else {
      failJob(job.id, message);
    }
  }
}
