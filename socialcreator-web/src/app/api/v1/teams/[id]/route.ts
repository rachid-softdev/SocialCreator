/**
 * API v1 /teams/[id] route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/teams/:id
export const GET = withApiMiddleware(async ({ userId, params }) => {
  const { team: teamRepo } = getRepositories();
  const team = await teamRepo.findById(params.id as string);

  if (!team) return notFound("Team");

  // Check if user is owner or member
  const isOwner = team.ownerId === userId;
  const isMember = team.members.some((m) => m.userId === userId);
  if (!isOwner && !isMember) return unauthorized();

  return NextResponse.json(
    { team },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// PUT /api/v1/teams/:id
export const PUT = withApiMiddleware(async ({ userId, request, params }) => {
  const { team: teamRepo } = getRepositories();
  const team = await teamRepo.findById(params.id as string);

  if (!team) return notFound("Team");
  if (team.ownerId !== userId) return unauthorized();

  const body = await request.json();
  const updated = await teamRepo.update(params.id as string, { name: body.name });

  return NextResponse.json(
    { team: updated },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});

// DELETE /api/v1/teams/:id
export const DELETE = withApiMiddleware(async ({ userId, params }) => {
  const { team: teamRepo } = getRepositories();
  const team = await teamRepo.findById(params.id as string);

  if (!team) return notFound("Team");
  if (team.ownerId !== userId) return unauthorized();

  await teamRepo.delete(params.id as string);

  return NextResponse.json(
    { success: true },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
