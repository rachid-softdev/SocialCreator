/**
 * API v1 /content/[id]/schedule route
 * PUT — Schedule content for publishing
 * DELETE — Cancel a scheduled publication
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";
import { checkScheduleConflicts } from "@/lib/scheduling/conflict-detector";

const scheduleSchema = z.object({
  scheduledPublishAt: z.string().datetime(),
  scheduledTimezone: z.string().optional().default("UTC"),
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

  const { scheduledPublishAt, scheduledTimezone } = validation.data;
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
  const updatedContent = await contentRepo.update(id, {
    status: "SCHEDULED",
    scheduledPublishAt: publishDate,
    scheduledTimezone,
  });

  // Check scheduling conflicts
  const { warnings } = await checkScheduleConflicts(
    content.profileId,
    content.platform,
    publishDate,
  );

  return NextResponse.json(
    { content: updatedContent, warnings: warnings.length > 0 ? warnings : undefined },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// DELETE /api/v1/content/:id/schedule
export const DELETE = withApiMiddleware(async ({ userId }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  const { content: contentRepo, profile: profileRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Ownership check via profile
  const profile = await profileRepo.findById(content.profileId);
  if (!profile || profile.userId !== userId) return notFound("Content");

  // Validate content status is SCHEDULED
  if (content.status !== "SCHEDULED") {
    return badRequest("Only SCHEDULED content can be unscheduled");
  }

  const updatedContent = await contentRepo.cancelSchedule(id);

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
