/**
 * API v1 /content/[id]/retry route
 * POST — Retry a failed content item by resetting to APPROVED and re-enqueuing
 */

import { NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";
import { enqueueJob } from "@/lib/job-queue";

// POST /api/v1/content/:id/retry
export const POST = withApiMiddleware(async ({ userId }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  const { content: contentRepo, profile: profileRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Ownership check via profile
  const profile = await profileRepo.findById(content.profileId);
  if (!profile || profile.userId !== userId) return notFound("Content");

  // Validate content status is FAILED
  if (content.status !== "FAILED") {
    return badRequest("Only FAILED content can be retried");
  }

  // Reset to APPROVED
  const updatedContent = await contentRepo.resetToApproved(id);

  // Re-enqueue publish job with high priority
  enqueueJob(
    "publish",
    {
      contentId: id,
      profileId: content.profileId,
      platform: content.platform,
      userId,
    },
    { priority: "high" },
  );

  return NextResponse.json(
    { content: updatedContent, reEnqueued: true },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
