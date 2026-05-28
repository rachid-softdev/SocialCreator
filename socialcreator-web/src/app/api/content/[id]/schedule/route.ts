/**
 * PUT /api/content/[id]/schedule
 * Schedule content for future publication
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPublish } from "@/lib/publish-guard";

const scheduleSchema = z.object({
  scheduledPublishAt: z.string().datetime(),
  scheduledTimezone: z.string().optional().default("UTC"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getContentOr404(id: string, userId: string) {
  const content = await prisma.generatedContent.findFirst({
    where: { id, profile: { userId } },
    include: {
      profile: {
        select: { id: true, name: true, platforms: true },
      },
    },
  });
  return content;
}

// PUT /api/content/[id]/schedule
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existingContent = await getContentOr404(id, session.user.id);

    if (!existingContent) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Only DRAFT or APPROVED content can be scheduled
    if (!["DRAFT", "APPROVED"].includes(existingContent.status)) {
      return NextResponse.json(
        { error: "Only DRAFT or APPROVED content can be scheduled" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = scheduleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    const { scheduledPublishAt, scheduledTimezone } = validation.data;
    const publishDate = new Date(scheduledPublishAt);

    // Can't schedule in the past
    if (publishDate <= new Date()) {
      return NextResponse.json({ error: "Cannot schedule in the past" }, { status: 400 });
    }

    // Check if publishing would be allowed at the scheduled time
    const { canPublish: canPublishNow, reason } = await canPublish(
      existingContent.profileId,
      existingContent.platform,
    );

    // We allow scheduling even if cap is reached now, as it might be cleared by then
    // But we warn about it
    let warning = null;
    if (!canPublishNow) {
      warning = `Note: ${reason}. The content will be published when the cap resets.`;
    }

    const updatedContent = await prisma.generatedContent.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        scheduledPublishAt: publishDate,
        scheduledTimezone,
      },
      include: {
        profile: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({
      content: updatedContent,
      warning,
    });
  } catch (error) {
    console.error("Error scheduling content:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/content/[id]/schedule
// Cancel scheduled publication
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existingContent = await getContentOr404(id, session.user.id);

    if (!existingContent) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    if (existingContent.status !== "SCHEDULED") {
      return NextResponse.json({ error: "Content is not scheduled" }, { status: 400 });
    }

    const updatedContent = await prisma.generatedContent.update({
      where: { id },
      data: {
        status: "DRAFT",
        scheduledPublishAt: null,
        scheduledTimezone: null,
      },
      include: {
        profile: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ content: updatedContent });
  } catch (error) {
    console.error("Error canceling schedule:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
