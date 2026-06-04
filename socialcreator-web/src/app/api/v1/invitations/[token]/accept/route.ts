/**
 * API v1 /invitations/[token]/accept route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// POST /api/v1/invitations/:token/accept — Accept invitation
export const POST = withApiMiddleware(async ({ userId }, params) => {
  const {
    invitation: invitationRepo,
    teamMember: memberRepo,
    team: teamRepo,
    user: userRepo,
  } = getRepositories();
  const invitation = await invitationRepo.findByToken(params?.token as string);

  if (!invitation) return notFound("Invitation");

  // Check if invitation is expired
  if (invitation.expiresAt < new Date()) {
    await invitationRepo.updateStatus(invitation.id, "EXPIRED");
    return NextResponse.json({ error: "Invitation has expired", code: "EXPIRED" }, { status: 410 });
  }

  // Check if invitation is still pending
  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      {
        error: `Invitation has already been ${invitation.status.toLowerCase()}`,
        code: invitation.status,
      },
      { status: 410 },
    );
  }

  // Verify the accepting user's email matches
  const user = await userRepo.findById(userId);
  if (!user || user.email !== invitation.email) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 },
    );
  }

  // Check if user is already a member
  const existingMembers = await memberRepo.findByTeamId(invitation.teamId);
  const alreadyMember = existingMembers.some((m) => m.userId === userId);
  if (alreadyMember) {
    // Still mark as accepted in case of re-invite
    await invitationRepo.updateStatus(invitation.id, "ACCEPTED");
    return NextResponse.json(
      { message: "You are already a member of this team" },
      { status: 200, headers: { "X-API-Version": "v1" } },
    );
  }

  // Check if user is the team owner — auto-accept without creating duplicate member
  const team = await teamRepo.findById(invitation.teamId);
  if (team && team.ownerId === userId) {
    await invitationRepo.updateStatus(invitation.id, "ACCEPTED");
    return NextResponse.json(
      { message: "Invitation accepted (team owner)" },
      { status: 200, headers: { "X-API-Version": "v1" } },
    );
  }

  // Add member and update status sequentially (each individual Prisma call is atomic)
  const member = await memberRepo.addMember({
    teamId: invitation.teamId,
    userId,
    role: invitation.role,
  });
  await invitationRepo.updateStatus(invitation.id, "ACCEPTED");

  return NextResponse.json(
    { message: "Invitation accepted successfully", member },
    {
      status: 200,
      headers: { "X-API-Version": "v1" },
    },
  );
});
