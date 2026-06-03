/**
 * API v1 /media/[id] route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/media/:id
export const GET = withApiMiddleware(async ({ userId }, params) => {
  const { mediaAsset: mediaRepo, profile: profileRepo } = getRepositories();
  const asset = await mediaRepo.findById(params?.id as string);

  if (!asset) return notFound("Media asset");

  const profile = await profileRepo.findById(asset.profileId);
  if (!profile || profile.userId !== userId) return unauthorized();

  return NextResponse.json(
    { asset },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// DELETE /api/v1/media/:id
export const DELETE = withApiMiddleware(async ({ userId }, params) => {
  const { mediaAsset: mediaRepo, profile: profileRepo } = getRepositories();
  const asset = await mediaRepo.findById(params?.id as string);

  if (!asset) return notFound("Media asset");

  const profile = await profileRepo.findById(asset.profileId);
  if (!profile || profile.userId !== userId) return unauthorized();

  await mediaRepo.delete(params?.id as string);

  return NextResponse.json(
    { success: true },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
