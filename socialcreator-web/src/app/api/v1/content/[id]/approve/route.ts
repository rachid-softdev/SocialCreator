/**
 * API v1 /content/[id]/approve route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// POST /api/v1/content/:id/approve
export const POST = withApiMiddleware(async ({ userId }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  const { content: contentRepo, profile: profileRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Ownership check via profile
  const profile = await profileRepo.findById(content.profileId);
  if (!profile || profile.userId !== userId) return notFound("Content");

  // Validate status is DRAFT
  if (content.status !== "DRAFT") {
    return badRequest("Only draft content can be approved");
  }

  const updatedContent = await contentRepo.updateStatus(id, "APPROVED");

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
