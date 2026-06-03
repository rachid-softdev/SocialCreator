/**
 * API routes for Team members management
 *
 * GET    /api/teams/[teamId]/members - List team members
 * POST   /api/teams/[teamId]/members - Invite a new member
 * DELETE /api/teams/[teamId]/members/[memberId] - Remove a member
 * PUT    /api/teams/[teamId]/members/[memberId] - Update member role
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("VIEWER"),
});

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

async function getTeamOr404(teamId: string, userId: string) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } } },
      ],
    },
  });
  return team;
}

// GET /api/teams/[teamId]/members
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const team = await getTeamOr404(teamId, session.user.id);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error) {
    logger.error({ err: error }, "Error fetching team members");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/teams/[teamId]/members
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const team = await getTeamOr404(teamId, session.user.id);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = inviteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    const { email, role } = validation.data;

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      // In a real app, you'd send an invitation email
      // For now, return an error
      return NextResponse.json(
        { error: "User not found. They must create an account first." },
        { status: 404 },
      );
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this team" }, { status: 400 });
    }

    // Add member
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

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Error inviting team member");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/teams/[teamId]/members/[memberId]
export async function DELETE(
  _request: Request,
  { params }: RouteParams & { params: Promise<{ memberId: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, memberId } = await params;
    const team = await getTeamOr404(teamId, session.user.id);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get member to check
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Can't remove the owner
    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Cannot remove the team owner" }, { status: 400 });
    }

    // Only owner can remove admins
    if (member.role === "ADMIN" && team.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Only the team owner can remove admins" }, { status: 403 });
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error removing team member");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/teams/[teamId]/members/[memberId] - Update role
export async function PUT(
  request: Request,
  { params }: RouteParams & { params: Promise<{ memberId: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, memberId } = await params;
    const team = await getTeamOr404(teamId, session.user.id);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Only owner can change roles
    if (team.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the team owner can change member roles" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Cannot change the owner role" }, { status: 400 });
    }

    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: validation.data.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    logger.error({ err: error }, "Error updating member role");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
