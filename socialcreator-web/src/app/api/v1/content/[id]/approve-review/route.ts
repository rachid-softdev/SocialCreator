/**
 * API v1 /content/[id]/approve-review route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { badRequest, notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// POST /api/v1/content/:id/approve-review — Approve reviewed content (ADMIN/OWNER only)
export const POST = withApiMiddleware(async ({ userId }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  const { content: contentRepo, profile: profileRepo, teamMember: memberRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Verify access via profile
  const profile = await profileRepo.findById(content.profileId);
  if (!profile) return notFound("Content");

  const isOwner = profile.userId === userId;

  // Check team role if not direct owner
  if (!isOwner) {
    if (!profile.teamId) return unauthorized();

    const members = await memberRepo.findByTeamId(profile.teamId);
    const userMembership = members.find((m) => m.userId === userId);
    if (!userMembership || (userMembership.role !== "OWNER" && userMembership.role !== "ADMIN")) {
      return unauthorized();
    }
  }

  // Validate content is IN_REVIEW
  if ((content as any).reviewStatus !== "IN_REVIEW") {
    return badRequest("Content is not in review status");
  }

  const updatedContent = await contentRepo.update(id, {
    reviewStatus: "APPROVED",
    reviewedById: userId,
    reviewedAt: new Date(),
  } as any);

  // Notify the content creator
  if (profile.userId !== userId) {
    const { createNotification } = await import("@/lib/services/notification-service");
    createNotification({
      userId: profile.userId,
      type: "review_approved",
      title: "Content approved",
      message: `Your content has been approved for publishing`,
      data: { contentId: content.id },
    }).catch(() => {});
  }

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
