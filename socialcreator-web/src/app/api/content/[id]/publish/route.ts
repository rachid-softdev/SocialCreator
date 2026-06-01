/**
 * POST /api/content/[id]/publish
 * Publish an approved content to the target platform
 *
 * Steps:
 * 1. Verify content ownership
 * 2. Verify status is APPROVED
 * 3. Check daily cap
 * 4. Get valid access token (decrypted + refreshed if expired)
 * 5. Publish via platform publisher
 * 6. Create immutable PublishLog
 * 7. Update GeneratedContent: status → PUBLISHED, postId, publishedAt
 */

import { hashContent } from "@socialcreator/utils";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPublish, recordPublish } from "@/lib/publish-guard";
import { getPublisher } from "@/lib/publishers";
import { getValidAccessToken } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/content/[id]/publish
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 1. Fetch content and verify ownership
    const content = await prisma.generatedContent.findFirst({
      where: {
        id,
        profile: { userId: session.user.id },
      },
      include: {
        profile: {
          select: { id: true, name: true },
        },
      },
    });

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // 2. Verify status is APPROVED
    if (content.status !== "APPROVED") {
      return NextResponse.json(
        { error: `Cannot publish: content status is ${content.status}, must be APPROVED` },
        { status: 400 },
      );
    }

    // 3. Check daily cap
    const capCheck = await canPublish(content.profileId, content.platform);
    if (!capCheck.canPublish) {
      return NextResponse.json({ error: capCheck.reason }, { status: 429 });
    }

    // 4. Get connected account
    const account = await prisma.connectedAccount.findUnique({
      where: {
        profileId_platform: {
          profileId: content.profileId,
          platform: content.platform,
        },
      },
    });

    if (!account?.isActive) {
      return NextResponse.json(
        { error: `No active connected account for ${content.platform}` },
        { status: 400 },
      );
    }

    // Get valid access token (auto-refresh if expired)
    const accessToken = await getValidAccessToken(account.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Failed to get valid access token" }, { status: 400 });
    }

    // 5. Publish via platform publisher
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

    // 6. Create immutable PublishLog
    await prisma.publishLog.create({
      data: {
        userId: session.user.id,
        profileId: content.profileId,
        platform: content.platform,
        contentId: content.id,
        contentHash: hashContent(content.textContent),
        success: result.success,
        error: result.error || null,
      },
    });

    // 7. Update GeneratedContent status
    if (result.success) {
      await prisma.generatedContent.update({
        where: { id: content.id },
        data: {
          status: "PUBLISHED",
          postId: result.postId || null,
          publishedAt: new Date(),
        },
      });

      // Record publish in Redis cap counter
      await recordPublish(content.profileId, content.platform);

      return NextResponse.json({
        success: true,
        postId: result.postId,
        postUrl: result.postUrl,
      });
    } else {
      // Mark as FAILED
      await prisma.generatedContent.update({
        where: { id: content.id },
        data: {
          status: "FAILED",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: result.error || "Publication failed",
        },
        { status: 422 },
      );
    }
  } catch (error) {
    console.error("Error publishing content:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
