/**
 * Scheduled content publisher worker — Trigger.dev entry point
 * Queries due content and enqueues publish jobs for each item.
 * Actual publish work happens in the job queue handler.
 *
 * @deprecated As of Sprint 11, use SchedulerService (src/lib/services/scheduler/scheduler-service.ts)
 * which runs in-process via instrumentation.ts and uses the async QueueBackend.
 * This Trigger.dev trigger is kept for backward compatibility but is no longer
 * the primary scheduling path.
 */

import { enqueueJob } from "@/lib/job-queue";
import type { PublishPayload } from "@/lib/job-queue/types";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";

/**
 * Run the scheduled content publisher
 * Finds content with status SCHEDULED and past scheduledPublishAt,
 * enqueues a publish job for each item
 */
export async function runScheduledContentPublisher(): Promise<{
  enqueued: number;
}> {
  logger.info("Starting scheduled content publisher");

  // Find content that's due for publishing
  const { content: contentRepo } = getRepositories();
  const dueContent = await contentRepo.findPendingScheduled(new Date());

  let enqueued = 0;

  for (const content of dueContent) {
    try {
      if (!content.profileId) {
        logger.warn({ contentId: content.id }, "Scheduled content has no profileId, skipping");
        continue;
      }

      enqueueJob(
        "publish",
        {
          contentId: content.id,
          profileId: content.profileId,
          platform: content.platform,
          userId: "", // Resolved by publish handler via profile lookup
        } satisfies PublishPayload,
        { priority: "normal", maxAttempts: 3 },
      );
      enqueued++;
    } catch (error) {
      logger.error({ contentId: content.id, err: error }, "Error enqueuing scheduled content");
    }
  }

  logger.info(
    { scheduledFound: dueContent.length, enqueued },
    "Scheduled content publisher completed",
  );

  return { enqueued };
}
