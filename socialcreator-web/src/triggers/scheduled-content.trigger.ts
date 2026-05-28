/**
 * Scheduled content publisher worker
 * Checks and publishes content that's due for publishing
 */

import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { recordPublish } from "@/lib/publish-guard";
import { publishContent } from "@/lib/publishers";
import { getValidAccessToken } from "@/lib/tokens";

/**
 * Run the scheduled content publisher
 * Processes content with status SCHEDULED and past scheduledPublishAt
 */
export async function runScheduledContentPublisher(): Promise<{
  published: number;
  failed: number;
}> {
  logger.info("Starting scheduled content publisher");

  // Find content that's due for publishing
  const now = new Date();
  const scheduledContent = await prisma.generatedContent.findMany({
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

  let published = 0;
  let failed = 0;

  for (const content of scheduledContent) {
    try {
      const account = content.profile.connectedAccounts.find(
        (a: any) => a.platform === content.platform,
      );

      if (!account) {
        logger.error(
          { contentId: content.id, platform: content.platform },
          "No connected account for content",
        );
        failed++;
        continue;
      }

      const decryptedAccessToken = await getValidAccessToken(account.id);

      if (!decryptedAccessToken) {
        logger.error(
          { accountId: account.id, platform: content.platform },
          "Failed to get valid access token for scheduled content",
        );
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
          accessToken: decryptedAccessToken,
        },
      );

      if (result.success) {
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

        published++;
        logger.info(
          { contentId: content.id, postId: result.postId },
          "Published scheduled content",
        );
      } else {
        await prisma.generatedContent.update({
          where: { id: content.id },
          data: { status: "FAILED" },
        });
        failed++;
        logger.error(
          { contentId: content.id, error: result.error },
          "Failed to publish scheduled content",
        );
      }
    } catch (error) {
      failed++;
      logger.error({ contentId: content.id, err: error }, "Error publishing scheduled content");
    }
  }

  logger.info(
    { scheduledFound: scheduledContent.length, published, failed },
    "Scheduled content publisher completed",
  );

  return { published, failed };
}
