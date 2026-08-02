/**
 * API v1 /teams/[id]/invitations route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const inviteSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
});

// POST /api/v1/teams/:id/invitations — add a member
export const POST = withApiMiddleware(async ({ userId, request }, params) => {
  const { team: teamRepo, teamMember: memberRepo } = getRepositories();
  const team = await teamRepo.findById(params?.id as string);

  if (!team) return notFound("Team");
  if (team.ownerId !== userId) return unauthorized();

  const body = await request.json();
  const validationResult = inviteSchema.safeParse(body);

  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0]!.message);
  }

  const member = await memberRepo.addMember({
    teamId: params?.id as string,
    userId: validationResult.data.userId,
    role: validationResult.data.role,
  });

  return NextResponse.json(
    { member },
    {
      status: 201,
      headers: { "X-API-Version": "v1" },
    },
  );
});

// GET /api/v1/teams/:id/invitations — list members
export const GET = withApiMiddleware(async ({ userId }, params) => {
  const { team: teamRepo, teamMember: memberRepo } = getRepositories();
  const team = await teamRepo.findById(params?.id as string);

  if (!team) return notFound("Team");

  const isOwner = team.ownerId === userId;
  const isMember = team.members.some((m) => m.userId === userId);
  if (!isOwner && !isMember) return unauthorized();

  const members = await memberRepo.findByTeamId(params?.id as string);

  return NextResponse.json(
    { members },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
