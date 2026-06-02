/**
 * Worker pattern for processing async jobs
 * Polls the queue, respects concurrency cap, handles errors
 */

import logger from "@/lib/logger";
import { getJobHandler } from "./handlers";
import { completeJob, dequeueJob, failJob, getActiveCount } from "./queue";
import type { Job } from "./types";

const POLL_INTERVAL_MS = 500;
const MAX_CONCURRENT = 3;

let running = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the worker loop
 */
export function startWorker(): void {
  if (running) return;

  running = true;
  logger.info(
    { maxConcurrent: MAX_CONCURRENT, pollInterval: POLL_INTERVAL_MS },
    "Job worker started",
  );

  pollTimer = setInterval(() => {
    if (getActiveCount() >= MAX_CONCURRENT) return;

    const job = dequeueJob();
    if (!job) return;

    processJob(job).catch((err) => logger.error({ jobId: job.id, err }, "Unhandled worker error"));
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
    failJob(job.id, `No handler registered for job type: ${job.type}`);
    return;
  }

  try {
    await handler(job.payload as any);
    completeJob(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    failJob(job.id, message);
  }
}
