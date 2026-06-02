/**
 * Async content publishing worker — Trigger.dev entry point
 * Thin orchestrator: validates content exists, then enqueues to job queue.
 * Actual publish work happens in the job queue handler.
 */

import { z } from "zod";
import { enqueueJob } from "@/lib/job-queue";
import type { PublishPayload } from "@/lib/job-queue/types";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";

// Payload schema for publish job
const PublishPayloadSchema = z.object({
  contentId: z.string(),
  userId: z.string(),
  profileId: z.string(),
});

/**
 * Run the publish worker for a given content payload
 * Validates content exists, then enqueues a publish job
 */
export async function runPublishWorker(payload: z.infer<typeof PublishPayloadSchema>): Promise<{
  contentId: string;
  queued: boolean;
}> {
  const { contentId, userId } = payload;

  logger.info({ contentId }, "Starting publish worker — validating and enqueuing");

  // Validate content exists
  const { content: contentRepo } = getRepositories();
  const content = await contentRepo.findById(contentId);

  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  // Enqueue to job queue — actual publish happens in the handler
  enqueueJob(
    "publish",
    {
      contentId,
      profileId: content.profileId,
      platform: content.platform,
      userId,
    } satisfies PublishPayload,
    { priority: "high", maxAttempts: 3, retryDelayMs: 5000 },
  );

  logger.info({ contentId }, "Publish job enqueued");

  return { contentId, queued: true };
}
