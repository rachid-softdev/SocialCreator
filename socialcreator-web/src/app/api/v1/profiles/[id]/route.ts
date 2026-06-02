/**
 * API v1 /profiles/[id] route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/profiles/:id
export const GET = withApiMiddleware(async ({ userId, params }) => {
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(params.id as string);

  if (!profile) return notFound("Profile");
  if (profile.userId !== userId) return unauthorized();

  return NextResponse.json(
    { profile },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// PUT /api/v1/profiles/:id
export const PUT = withApiMiddleware(async ({ userId, request, params }) => {
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(params.id as string);

  if (!profile) return notFound("Profile");
  if (profile.userId !== userId) return unauthorized();

  const body = await request.json();
  const updated = await profileRepo.update(params.id as string, {
    name: body.name,
    brandVoice: body.brandVoice,
    contentBank: body.contentBank,
    platforms: body.platforms,
    avatarUrl: body.avatarUrl,
  });

  return NextResponse.json(
    { profile: updated },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});

// DELETE /api/v1/profiles/:id
export const DELETE = withApiMiddleware(async ({ userId, params }) => {
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(params.id as string);

  if (!profile) return notFound("Profile");
  if (profile.userId !== userId) return unauthorized();

  await profileRepo.delete(params.id as string);

  return NextResponse.json(
    { success: true },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
