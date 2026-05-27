/**
 * API route for team member management
 *
 * PATCH /api/teams/[teamId]/members/[memberId] - Update member role
 * DELETE /api/teams/[teamId]/members/[memberId] - Remove member
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canModifyMemberRole, canRemoveMember } from "@/lib/team-permissions";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

interface RouteParams {
  params: Promise<{ teamId: string; memberId: string }>;
}

// PATCH /api/teams/[teamId]/members/[memberId]
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, memberId } = await params;
    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    const { role } = validation.data;

    // Check permissions
    const permission = await canModifyMemberRole(userId, teamId, memberId);
    if (!permission.can) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    // Update member role
    const member = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({
      message: `Role updated to ${role}`,
      member,
    });
  } catch (error) {
    console.error("Error updating member role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/teams/[teamId]/members/[memberId]
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, memberId } = await params;
    const userId = session.user.id;

    // Check permissions
    const permission = await canRemoveMember(userId, teamId, memberId);
    if (!permission.can) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    // Check if member exists
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Remove member
    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({
      message: "Member removed from team",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
