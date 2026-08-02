/**
 * POST /api/content/bulk
 * Bulk operations on content (approve, reject, publish, delete)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { publishContent } from "@/lib/publishers";
import { getValidAccessToken } from "@/lib/tokens";

const bulkActionSchema = z.object({
  contentIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["approve", "reject", "publish", "delete"]),
});

// POST /api/content/bulk
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = bulkActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]!.message }, { status: 400 });
    }

    const { contentIds, action } = validation.data;

    // Verify all content belongs to user
    const contents = await prisma.generatedContent.findMany({
      where: {
        id: { in: contentIds },
        profile: { userId: session.user.id },
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
    });

    if (contents.length !== contentIds.length) {
      return NextResponse.json(
        { error: "Some content IDs not found or not authorized" },
        { status: 400 },
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    switch (action) {
      case "approve": {
        // Can only approve DRAFT content
        const drafts = contents.filter((c) => c.status === "DRAFT");

        for (const content of drafts) {
          try {
            await prisma.generatedContent.update({
              where: { id: content.id },
              data: { status: "APPROVED" },
            });
            results.success.push(content.id);
          } catch (error) {
            results.failed.push({
              id: content.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
        break;
      }

      case "reject": {
        // Can reject DRAFT or APPROVED content
        const actionable = contents.filter((c) => ["DRAFT", "APPROVED"].includes(c.status));

        for (const content of actionable) {
          try {
            await prisma.generatedContent.update({
              where: { id: content.id },
              data: {
                status: "REJECTED",
                rejectedAt: new Date(),
              },
            });
            results.success.push(content.id);
          } catch (error) {
            results.failed.push({
              id: content.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
        break;
      }

      case "publish": {
        // Can only publish APPROVED content (not SCHEDULED)
        const approved = contents.filter((c) => c.status === "APPROVED" && !c.scheduledPublishAt);

        for (const content of approved) {
          try {
            const account = content.profile.connectedAccounts.find(
              (a) => a.platform === content.platform,
            );

            if (!account) {
              results.failed.push({
                id: content.id,
                error: `No connected account for ${content.platform}`,
              });
              continue;
            }

            // CRITICAL: Decrypt the access token before sending to external APIs
            // account.accessToken is AES-256-GCM ciphertext, not a usable token
            const accessToken = await getValidAccessToken(account.id);
            if (!accessToken) {
              results.failed.push({
                id: content.id,
                error: `Failed to get valid access token for ${content.platform}`,
              });
              continue;
            }

            const publishResult = await publishContent(
              content.platform,
              {
                textContent: content.textContent,
                mediaUrls: content.mediaUrls,
                hashtags: content.hashtags,
              },
              {
                accountId: account.accountId,
                accessToken,
              },
            );

            if (publishResult.success) {
              await prisma.generatedContent.update({
                where: { id: content.id },
                data: {
                  status: "PUBLISHED",
                  postId: publishResult.postId,
                  publishedAt: new Date(),
                },
              });
              results.success.push(content.id);
            } else {
              results.failed.push({
                id: content.id,
                error: publishResult.error || "Publish failed",
              });
            }
          } catch (error) {
            results.failed.push({
              id: content.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
        break;
      }

      case "delete": {
        // Can delete any content not yet published
        const deletable = contents.filter((c) => c.status !== "PUBLISHED");

        for (const content of deletable) {
          try {
            await prisma.generatedContent.delete({
              where: { id: content.id },
            });
            results.success.push(content.id);
          } catch (error) {
            results.failed.push({
              id: content.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({
      summary: {
        total: contentIds.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
      results,
    });
  } catch (error) {
    logger.error({ err: error }, "Error in bulk operation");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
