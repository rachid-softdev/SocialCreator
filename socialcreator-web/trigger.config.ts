/**
 * Trigger.dev configuration (deprecated)
 *
 * Trigger.dev mock has been replaced with a lightweight in-process job queue.
 * See: src/lib/job-queue.ts
 *
 * Cron schedules are handled via:
 * - Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
 * - Or external cron service pointing to API routes
 *
 * For production with distributed queue, configure UPSTASH_REDIS
 * and use a proper job queue solution (BullMQ, etc.)
 *
 * Previously registered jobs:
 * - agent-scheduler: Runs every hour, checks active agents with scheduleCron
 * - publish-worker: Async content publishing
 * - video-pipeline: Video processing pipeline (transcription, clips, content)
 */
