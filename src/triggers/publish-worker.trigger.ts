/**
 * Trigger.dev job for async content publishing
 * Handles publishing approved content without blocking the request
 *
 * Usage:
 * - Triggered when content is auto-approved (autoPublish=true)
 * - Or when user triggers publish via API
 * - Handles retry logic and error states
 */

import { client, triggerHttpPayload } from "@trigger.dev/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/tokens";
import { checkDailyCap } from "@/lib/publish-guard";
import { getPublisher } from "@/lib/publishers";
import { hashContent } from "@/lib/utils";

// Payload schema for publish job
const PublishPayloadSchema = z.object({
  contentId: z.string(),
  userId: z.string(),
  profileId: z.string(),
});

// Export job definition for registration
export const publishJob = client.defineJob({
  id: "publish-content",
  name: "Publish Content",
  version: "0.0.1",
  trigger: triggerHttpPayload({
    schema: z.object({
      contentId: z.string(),
      userId: z.string(),
      profileId: z.string(),
    }),
  }),
  output: z.object({
    contentId: z.string(),
    success: z.boolean(),
    postId: z.string().optional(),
    postUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  retries: {
    maxAttempts: 3,
    backoff: {
      type: "exponential",
      seconds: [10, 30, 60],
    },
  },
  run: async (payload, io) => {
    const { contentId, userId, profileId } = payload;

    await io.logger.info("Starting content publish job", { contentId });

    // Fetch content
    const content = await io.runTask(
      "fetch-content",
      { timeout: "30s" },
      async () => {
        return await prisma.generatedContent.findUnique({
          where: { id: contentId },
          include: { profile: true },
        });
      }
    );

    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }

    // Check cap
    const cap = await io.runTask("check-cap", { timeout: "10s" }, async () => {
      return await checkDailyCap(profileId, content.platform);
    });

    if (!cap.allowed) {
      await io.logger.warn("Daily cap reached, skipping publish", {
        platform: content.platform,
        count: cap.count,
        max: cap.max,
      });
      return {
        contentId,
        success: false,
        error: `Cap atteint: ${cap.count}/${cap.max}`,
      };
    }

    // Get connected account
    const account = await io.runTask(
      "fetch-account",
      { timeout: "10s" },
      async () => {
        return await prisma.connectedAccount.findUnique({
          where: {
            profileId_platform: {
              profileId,
              platform: content.platform,
            },
          },
        });
      }
    );

    if (!account || !account.isActive) {
      throw new Error(`No active account for ${content.platform}`);
    }

    // Get valid access token
    const accessToken = await io.runTask(
      "get-token",
      { timeout: "30s" },
      async () => {
        return await getValidAccessToken(account.id);
      }
    );

    if (!accessToken) {
      throw new Error("Failed to get access token");
    }

    // Publish
    const publisher = getPublisher(content.platform);
    const result = await io.runTask(
      "publish",
      { timeout: "2m" },
      async () => {
        return await publisher.publish(
          {
            textContent: content.textContent,
            mediaUrls: content.mediaUrls,
            hashtags: content.hashtags,
          },
          {
            accountId: account.accountId,
            accessToken,
            refreshToken: account.refreshToken || undefined,
          }
        );
      }
    );

    // Create PublishLog (immutable)
    await io.runTask("create-log", { timeout: "10s" }, async () => {
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
    });

    // Update content status
    await io.runTask("update-status", { timeout: "10s" }, async () => {
      await prisma.generatedContent.update({
        where: { id: contentId },
        data: {
          status: result.success ? "PUBLISHED" : "FAILED",
          postId: result.postId || null,
          publishedAt: result.success ? new Date() : null,
        },
      });
    });

    await io.logger.info("Publish job completed", {
      contentId,
      success: result.success,
    });

    return {
      contentId,
      success: result.success,
      postId: result.postId,
      postUrl: result.postUrl,
      error: result.error,
    };
  },
});

/**
 * Enqueue a content for publishing
 * Falls back to direct execution if Trigger.dev not configured
 */
export async function enqueuePublish(payload: z.infer<typeof PublishPayloadSchema>): Promise<void> {
  const apiUrl = process.env.TRIGGER_API_URL;
  const apiKey = process.env.TRIGGER_API_KEY;

  if (!apiUrl || !apiKey) {
    console.warn("Trigger.dev not configured, publish will run synchronously");
    return;
  }

  const response = await fetch(`${apiUrl}/v1/jobs/publish-content/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to enqueue publish job: ${response.statusText}`);
  }
}
