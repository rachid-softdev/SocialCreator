/**
 * API v1 /content/[id]/schedule route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const scheduleSchema = z.object({
  scheduledPublishAt: z.string().datetime(),
});

// PUT /api/v1/content/:id/schedule
export const PUT = withApiMiddleware(async ({ userId, request }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  // Parse and validate body
  const body = await request.json();
  const validation = scheduleSchema.safeParse(body);

  if (!validation.success) {
    return badRequest(validation.error.errors[0].message);
  }

  const { scheduledPublishAt } = validation.data;
  const publishDate = new Date(scheduledPublishAt);

  // Validate future date
  if (publishDate <= new Date()) {
    return badRequest("Scheduled time must be in the future");
  }

  const { content: contentRepo, profile: profileRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Ownership check via profile
  const profile = await profileRepo.findById(content.profileId);
  if (!profile || profile.userId !== userId) return notFound("Content");

  // Validate content status is DRAFT or APPROVED
  if (!["DRAFT", "APPROVED"].includes(content.status)) {
    return badRequest("Only DRAFT or APPROVED content can be scheduled");
  }

  // Update via repository
  const updatedContent = await contentRepo.schedule(id, publishDate);

  return NextResponse.json(
    { content: updatedContent },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
