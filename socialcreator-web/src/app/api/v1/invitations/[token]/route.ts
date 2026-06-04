/**
 * API v1 /invitations/[token] route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/invitations/:token — Get invitation by token
export const GET = withApiMiddleware(async (_ctx, params) => {
  const { invitation: invitationRepo } = getRepositories();
  const invitation = await invitationRepo.findByToken(params?.token as string);

  if (!invitation) return notFound("Invitation");

  // Check if invitation is expired
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

  // Strip sensitive fields from response (defense in depth — token is in URL, email shouldn't leak)
  const { token: _token, email: _email, ...safeInvitation } = invitation;

  return NextResponse.json(
    { invitation: safeInvitation },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
