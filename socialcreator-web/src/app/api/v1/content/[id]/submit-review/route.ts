/**
 * API v1 /content/[id]/submit-review route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { badRequest, forbidden, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// POST /api/v1/content/:id/submit-review — Submit content for review
export const POST = withApiMiddleware(async ({ userId }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  const { content: contentRepo, profile: profileRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Verify access via profile (direct owner or team member with EDITOR+ role)
  const profile = await profileRepo.findById(content.profileId);
  if (!profile) return notFound("Content");

  const isOwner = profile.userId === userId;

  // If not the direct owner, check team membership with EDITOR+ role
  if (!isOwner && profile.teamId) {
    const { withTeamAccess, canSubmitForReview } = await import("@/lib/middleware/team-access");
    const access = await withTeamAccess(userId, profile.teamId);
    if (access instanceof NextResponse) return access;
    if (!canSubmitForReview(access.role)) {
      return forbidden("You don't have permission to submit content for review");
    }
  } else if (!isOwner) {
    return notFound("Content");
  }

  // Auto-approve if OWNER or ADMIN submits (bypass review)
  let reviewStatus: "IN_REVIEW" | "APPROVED" = "IN_REVIEW";
  if (isOwner) {
    reviewStatus = "APPROVED";
  } else {
    // Check if user has a role that auto-approves
    const { canReview } = await import("@/lib/middleware/team-access");
    const { teamMember: memberRepo } = getRepositories();
    const members = await memberRepo.findByTeamId(profile.teamId!);
    const userMembership = members.find((m) => m.userId === userId);
    if (userMembership && canReview(userMembership.role as any)) {
      reviewStatus = "APPROVED";
    }
  }

  const updatedContent = await contentRepo.update(id, {
    reviewStatus: reviewStatus as any,
    reviewedById: reviewStatus === "APPROVED" ? userId : undefined,
    reviewedAt: reviewStatus === "APPROVED" ? new Date() : undefined,
  } as any);

  // Create notification for team admins/owners if content needs review
  if (reviewStatus === "IN_REVIEW" && profile.teamId) {
    const { broadcastNotification } = await import("@/lib/services/notification-service");
    const { teamMember: memberRepo } = getRepositories();
    const members = await memberRepo.findByTeamId(profile.teamId);
    const adminIds = members
      .filter((m) => m.role === "OWNER" || m.role === "ADMIN")
      .map((m) => m.userId);

    if (adminIds.length > 0) {
      broadcastNotification(adminIds, {
        type: "review_request",
        title: "Content review requested",
        message: `Content "${content.textContent?.substring(0, 100)}..." has been submitted for review`,
        data: { contentId: content.id, profileId: content.profileId },
      }).catch(() => {
        // Non-critical
      });
    }
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
