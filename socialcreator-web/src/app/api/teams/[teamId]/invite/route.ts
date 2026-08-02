/**
 * API route for team member invitation
 *
 * POST /api/teams/[teamId]/invite
 * Body: { email: string, role: "ADMIN" | "EDITOR" | "VIEWER" }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { canModifyMemberRole } from "@/lib/team-permissions";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// POST /api/teams/[teamId]/invite
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const userId = session.user.id;

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = inviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0]!.message }, { status: 400 });
    }

    const { email, role } = validation.data;

    // Find user by email (they must already have an account)
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      return NextResponse.json(
        { error: "User not found. They must create an account first." },
        { status: 404 },
      );
    }

    // Check if user is already a member
    const existingMember = team.members.find((m) => m.userId === invitedUser.id);

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this team" }, { status: 409 });
    }

    // Check permissions (only owner can invite)
    const permission = await canModifyMemberRole(userId, teamId, invitedUser.id);
    if (!permission.can) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    // Add member to team
    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId: invitedUser.id,
        role,
        joinedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(
      {
        message: `Successfully invited ${email} to the team`,
        member,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Error inviting team member");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
