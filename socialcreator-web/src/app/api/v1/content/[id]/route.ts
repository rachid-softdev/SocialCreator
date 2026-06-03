/**
 * API v1 /content/[id] route
 * PUT — Update content fields
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const updateContentSchema = z.object({
  textContent: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  status: z.enum(["DRAFT", "APPROVED", "PUBLISHED", "FAILED", "REJECTED", "SCHEDULED"]).optional(),
});

// PUT /api/v1/content/:id
export const PUT = withApiMiddleware(async ({ userId, request }, params) => {
  const id = params?.id as string;
  if (!id) return badRequest("Content ID is required");

  const { content: contentRepo, profile: profileRepo } = getRepositories();
  const content = await contentRepo.findById(id);

  if (!content) return notFound("Content");

  // Ownership check via profile
  const profile = await profileRepo.findById(content.profileId);
  if (!profile || profile.userId !== userId) return notFound("Content");

  // Parse and validate body
  const body = await request.json();
  const validation = updateContentSchema.safeParse(body);

  if (!validation.success) {
    return badRequest(validation.error.errors[0]?.message ?? "Invalid request body");
  }

  const updateData = validation.data;

  // Update via repository
  const updatedContent = await contentRepo.update(id, updateData as any);

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
