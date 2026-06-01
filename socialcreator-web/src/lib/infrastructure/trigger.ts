/**
 * Job definitions for async execution
 * Simple in-process queue replacing Trigger.dev
 *
 * For production: configure UPSTASH_REDIS to enable distributed queue
 * See: src/lib/job-queue.ts
 */

export { enqueueJob, getQueueSize } from "./job-queue";
