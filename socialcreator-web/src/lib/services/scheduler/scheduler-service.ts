/**
 * Scheduler Service
 *
 * Polls the database for due SCHEDULED content and enqueues publish jobs.
 * Designed to run alongside the job worker via instrumentation.ts.
 */

import type { Platform } from "@prisma/client";
import { createQueueBackend } from "@/lib/job-queue/backend";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";

export interface SchedulerOptions {
  pollIntervalMs?: number;
}

export function createScheduler(options?: SchedulerOptions) {
  let timer: ReturnType<typeof setInterval> | null = null;
  const enqueuedIds = new Set<string>();
  const pollInterval = options?.pollIntervalMs ?? 30_000;

  async function tick(): Promise<void> {
    const start = Date.now();
    try {
      const { content: contentRepo } = getRepositories();
      const dueContent = await contentRepo.findPendingScheduled(new Date());

      let enqueued = 0;
      for (const content of dueContent) {
        if (enqueuedIds.has(content.id)) continue; // dedup

        if (!content.profileId) {
          logger.warn({ contentId: content.id }, "Scheduled content has no profileId, skipping");
          continue;
        }

        const backend = createQueueBackend();
        await backend.enqueue({
          type: "publish" as const,
          payload: {
            contentId: content.id,
            profileId: content.profileId,
            platform: content.platform as Platform,
            userId: "", // resolved by publish handler
          },
          priority: "normal",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          retryDelayMs: 1000,
          createdAt: Date.now(),
        });

        enqueuedIds.add(content.id);
        enqueued++;
      }

      // Garbage collect old IDs (older than 5 minutes)
      if (enqueuedIds.size > 100) {
        enqueuedIds.clear(); // simple approach: clear and rebuild
      }

      logger.debug(
        { found: dueContent.length, enqueued, durationMs: Date.now() - start },
        "Scheduler tick completed",
      );
    } catch (err) {
      logger.error({ err, durationMs: Date.now() - start }, "Scheduler tick failed");
    }
  }

  return {
    start() {
      if (timer) return;
      logger.info({ pollIntervalMs: pollInterval }, "Scheduler starting");
      tick(); // run first tick immediately
      timer = setInterval(tick, pollInterval);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      enqueuedIds.clear();
      logger.info("Scheduler stopped");
    },
    isRunning() {
      return timer !== null;
    },
    /** For testing: manually trigger a tick */
    async tickForTesting(): Promise<void> {
      await tick();
    },
  };
}
