/**
 * Trigger.dev job for scheduled content publishing
 * Runs every minute to check and publish scheduled content
 */

import { client } from "@/lib/trigger";

// Mock triggerHttpPayload - will be replaced with actual implementation
const triggerHttpPayload = (config: any) => config;

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordPublish } from "@/lib/publish-guard";
import { publishContent } from "@/lib/publishers";

// Cron trigger: runs every minute
export const scheduledPublisherJob = client.defineJob({
  id: "scheduled-content-publisher",
  name: "Scheduled Content Publisher",
  version: "0.1.0",
  trigger: triggerHttpPayload({
    schema: z.object({}),
  }),
  output: z.object({
    published: z.number(),
    failed: z.number(),
  }),
  run: async (payload: any, io: any) => {
    await io.logger.info("Starting scheduled content publisher");

    // Find content that's due for publishing
    const now = new Date();
    const scheduledContent = await io.runTask(
      "fetch-scheduled-content",
      { timeout: "30s" },
      async () => {
        return await prisma.generatedContent.findMany({
          where: {
            status: "SCHEDULED",
            scheduledPublishAt: { lte: now },
          },
          include: {
            profile: {
              include: {
                connectedAccounts: {
                  where: { isActive: true },
                },
              },
            },
          },
          take: 50, // Process up to 50 at a time
        });
      },
    );

    let published = 0;
    let failed = 0;

    for (const content of scheduledContent) {
      try {
        const account = content.profile.connectedAccounts.find(
          (a: any) => a.platform === content.platform,
        );

        if (!account) {
          await io.logger.error("No connected account for content", {
            contentId: content.id,
            platform: content.platform,
          });
          failed++;
          continue;
        }

        const result = await publishContent(
          content.platform,
          {
            textContent: content.textContent,
            mediaUrls: content.mediaUrls,
            hashtags: content.hashtags,
          },
          {
            accountId: account.accountId,
            accessToken: account.accessToken,
          },
        );

        if (result.success) {
          await io.runTask("mark-content-published", { timeout: "10s" }, async () => {
            await prisma.generatedContent.update({
              where: { id: content.id },
              data: {
                status: "PUBLISHED",
                postId: result.postId,
                publishedAt: new Date(),
                scheduledPublishAt: null,
              },
            });

            // Record the publish for cap counting
            await recordPublish(content.profileId, content.platform);
          });
          published++;
          await io.logger.info("Published scheduled content", {
            contentId: content.id,
            postId: result.postId,
          });
        } else {
          await io.runTask("mark-content-failed", { timeout: "10s" }, async () => {
            await prisma.generatedContent.update({
              where: { id: content.id },
              data: {
                status: "FAILED",
              },
            });
          });
          failed++;
          await io.logger.error("Failed to publish scheduled content", {
            contentId: content.id,
            error: result.error,
          });
        }
      } catch (error) {
        failed++;
        await io.logger.error("Error publishing scheduled content", {
          contentId: content.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await io.logger.info("Scheduled content publisher completed", {
      scheduledFound: scheduledContent.length,
      published,
      failed,
    });

    return { published, failed };
  },
});
