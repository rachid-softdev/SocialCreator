/**
 * API v1 /teams route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const createTeamSchema = z.object({
  name: z.string().min(2).max(100),
});

// GET /api/v1/teams
export const GET = withApiMiddleware(async ({ userId }) => {
  const { team: teamRepo, teamMember: memberRepo } = getRepositories();

  // Teams owned by user
  const ownedTeams = await teamRepo.findByOwnerId(userId);

  // Teams where user is a member
  const memberships = await memberRepo.findByUserId(userId);
  const memberTeamIds = memberships.map((m) => m.teamId);

  // Fetch member teams
  const memberTeams = await Promise.all(memberTeamIds.map((id) => teamRepo.findById(id)));

  const teams = [
    ...ownedTeams.map((t) => ({ ...t, role: "OWNER" })),
    ...memberTeams
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map((t) => ({
        ...t,
        role: memberships.find((m) => m.teamId === t.id)?.role || "VIEWER",
      })),
  ];

  return NextResponse.json(
    { teams },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// POST /api/v1/teams
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = createTeamSchema.safeParse(body);

  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0].message);
  }

  const { team: teamRepo } = getRepositories();
  const team = await teamRepo.create({
    name: validationResult.data.name,
    ownerId: userId,
  });

  return NextResponse.json(
    { team },
    {
      status: 201,
      headers: { "X-API-Version": "v1" },
    },
  );
});
