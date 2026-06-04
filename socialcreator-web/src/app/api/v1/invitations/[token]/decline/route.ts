/**
 * API v1 /invitations/[token]/decline route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// POST /api/v1/invitations/:token/decline — Decline invitation
export const POST = withApiMiddleware(async ({ userId }, params) => {
  const { invitation: invitationRepo, user: userRepo } = getRepositories();
  const invitation = await invitationRepo.findByToken(params?.token as string);

  if (!invitation) return notFound("Invitation");

  // Check if invitation is already expired
  if (invitation.expiresAt < new Date()) {
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

  // Verify the declining user's email matches
  const user = await userRepo.findById(userId);
  if (!user || user.email !== invitation.email) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 },
    );
  }

  await invitationRepo.updateStatus(invitation.id, "REJECTED");

  return NextResponse.json(
    { message: "Invitation declined" },
    {
      status: 200,
      headers: { "X-API-Version": "v1" },
    },
  );
});
