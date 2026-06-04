/**
 * API v1 /invitations route
 * Uses repository pattern instead of direct Prisma calls
 */

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, conflict, notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const createInviteSchema = z.object({
  teamId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("VIEWER"),
});

// POST /api/v1/invitations — Create invitation
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = createInviteSchema.safeParse(body);

  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0].message);
  }

  const { team: teamRepo, invitation: invitationRepo } = getRepositories();
  const { teamId, email, role } = validationResult.data;

  // Verify team exists and user has permission
  const team = await teamRepo.findById(teamId);
  if (!team) return notFound("Team");

  const isOwner = team.ownerId === userId;
  const isAdmin = team.members.some((m) => m.userId === userId && m.role === "ADMIN");
  if (!isOwner && !isAdmin) return unauthorized();

  // Check for existing pending invitation
  const existingPending = await invitationRepo.findPendingByTeamIdAndEmail(teamId, email);
  if (existingPending) {
    return conflict("An active invitation already exists for this email and team");
  }

  // Generate secure token and set expiration (7 days)
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await invitationRepo.create({
    teamId,
    invitedByUserId: userId,
    email,
    role,
    token,
    expiresAt,
  });

  // TODO: send email with invitation link
  const { default: logger } = await import("@/lib/logger");
  logger.info({ invitationId: invitation.id, email, teamId }, "Invitation created");

  // Don't expose the token in the response
  const { token: _token, ...safeInvitation } = invitation;

  return NextResponse.json(
    { invitation: safeInvitation },
    {
      status: 201,
      headers: { "X-API-Version": "v1" },
    },
  );
});

// GET /api/v1/invitations — List user's pending invitations
export const GET = withApiMiddleware(async ({ userId }) => {
  const { user: userRepo, invitation: invitationRepo } = getRepositories();
  const user = await userRepo.findById(userId);
  if (!user) return notFound("User");

  const invitations = await invitationRepo.findPendingByEmail(user.email);

  return NextResponse.json(
    { invitations },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
