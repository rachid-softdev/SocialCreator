/**
 * API v1 /profiles/[id]/share route
 * PATCH — Set or remove teamId on a profile
 */

import { NextResponse } from "next/server";
import { forbidden, notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// PATCH /api/v1/profiles/:id/share — Share or unshare a profile with a team
export const PATCH = withApiMiddleware(async ({ userId, request }, params) => {
  const { profile: profileRepo, team: teamRepo } = getRepositories();
  const profile = await profileRepo.findById(params?.id as string);

  if (!profile) return notFound("Profile");

  // Only the profile owner can share/unshare
  if (profile.userId !== userId) return unauthorized();

  const body = await request.json();
  const { teamId } = body;

  // If sharing to a team, validate team membership and role
  if (teamId) {
    const team = await teamRepo.findById(teamId);
    if (!team) return notFound("Team");

    // User must be OWNER or ADMIN of the team
    const isOwner = team.ownerId === userId;
    const isAdmin = team.members.some((m) => m.userId === userId && m.role === "ADMIN");
    if (!isOwner && !isAdmin) {
      return forbidden("You must be a team owner or admin to share profiles to this team");
    }
  }

  // Update profile with teamId (null to unshare)
  const updated = await profileRepo.update(profile.id, {
    teamId: teamId ?? null,
  });

  return NextResponse.json(
    { profile: updated },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
