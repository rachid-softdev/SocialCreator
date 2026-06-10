/**
 * Scheduler Service
 *
 * Polls the database for due SCHEDULED content and enqueues publish jobs.
 * Designed to run alongside the job worker via instrumentation.ts.
 */

import type { Platform } from "@prisma/client";
import { computeContentHash } from "@socialcreator/utils";
import { createQueueBackend } from "@/lib/job-queue/backend";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";

export interface SchedulerOptions {
  pollIntervalMs?: number;
}

export function createScheduler(options?: SchedulerOptions) {
  let timer: ReturnType<typeof setInterval> | null = null;
  const pollInterval = options?.pollIntervalMs ?? 30_000;

  async function tick(): Promise<void> {
    const start = Date.now();
    try {
      const { content: contentRepo } = getRepositories();
      const dueContent = await contentRepo.claimScheduled(new Date());

      let enqueued = 0;
      for (const content of dueContent) {
        if (!content.profileId) {
          logger.warn({ contentId: content.id }, "Scheduled content has no profileId, skipping");
          continue;
        }

        const contentHash = computeContentHash({
          profileId: content.profileId,
          platform: content.platform,
          textContent: content.textContent,
          mediaUrls: content.mediaUrls,
          hashtags: content.hashtags,
        });

        const backend = createQueueBackend();
        await backend.enqueue({
          type: "publish" as const,
          payload: {
            contentId: content.id,
            profileId: content.profileId,
            platform: content.platform as Platform,
            userId: "", // resolved by publish handler
            contentHash,
          },
          priority: "normal",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          retryDelayMs: 1000,
          createdAt: Date.now(),
        });

        enqueued++;
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
