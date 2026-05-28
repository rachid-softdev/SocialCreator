/**
 * Async content publishing worker
 * Handles publishing approved content without blocking the request
 *
 * Retry logic: exponential backoff, max 3 attempts
 */

import { hashContent } from "@socialcreator/utils";
import { z } from "zod";
import { enqueueJob } from "@/lib/job-queue";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { incrementDailyCap, peekDailyCap } from "@/lib/publish-guard";
import { getPublisher } from "@/lib/publishers";
import { getValidAccessToken } from "@/lib/tokens";

// Payload schema for publish job
const PublishPayloadSchema = z.object({
  contentId: z.string(),
  userId: z.string(),
  profileId: z.string(),
});

/**
 * Run the publish worker for a given content payload
 */
export async function runPublishWorker(payload: z.infer<typeof PublishPayloadSchema>): Promise<{
  contentId: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}> {
  const { contentId, userId, profileId } = payload;

  logger.info({ contentId }, "Starting publish worker");

  // Fetch content
  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    include: { profile: true },
  });

  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  // Check cap (read-only peek)
  const cap = await peekDailyCap(profileId, content.platform);

  if (!cap.allowed) {
    logger.warn(
      { platform: content.platform, count: cap.count, max: cap.max },
      "Daily cap reached, skipping publish",
    );
    return {
      contentId,
      success: false,
      error: `Cap atteint: ${cap.count}/${cap.max}`,
    };
  }

  // Get connected account
  const account = await prisma.connectedAccount.findUnique({
    where: {
      profileId_platform: {
        profileId,
        platform: content.platform,
      },
    },
  });

  if (!account?.isActive) {
    throw new Error(`No active account for ${content.platform}`);
  }

  // Get valid access token
  const accessToken = await getValidAccessToken(account.id);

  if (!accessToken) {
    throw new Error("Failed to get access token");
  }

  // Publish
  const publisher = getPublisher(content.platform);
  const result = await publisher.publish(
    {
      textContent: content.textContent,
      mediaUrls: content.mediaUrls,
      hashtags: content.hashtags,
    },
    {
      accountId: account.accountId,
      accessToken,
      refreshToken: account.refreshToken || undefined,
    },
  );

  // Create PublishLog (immutable)
  await prisma.publishLog.create({
    data: {
      userId,
      profileId,
      platform: content.platform,
      contentId: content.id,
      contentHash: hashContent(content.textContent),
      success: result.success,
      error: result.error || null,
    },
  });

  // Update content status
  await prisma.generatedContent.update({
    where: { id: contentId },
    data: {
      status: result.success ? "PUBLISHED" : "FAILED",
      postId: result.postId || null,
      publishedAt: result.success ? new Date() : null,
    },
  });

  logger.info({ contentId, success: result.success }, "Publish worker completed");

  return {
    contentId,
    success: result.success,
    postId: result.postId,
    postUrl: result.postUrl,
    error: result.error,
  };
}

/**
 * Enqueue a content for publishing
 * Uses the in-process job queue for async execution with retry support
 */
export async function enqueuePublish(payload: z.infer<typeof PublishPayloadSchema>): Promise<void> {
  enqueueJob(
    "publish-content",
    async () => {
      await runPublishWorker(payload);
      await incrementDailyCap(
        payload.profileId,
        (await prisma.generatedContent.findUnique({ where: { id: payload.contentId } }))?.platform,
      );
    },
    { maxAttempts: 3, retryDelay: 2000 },
  );
}
