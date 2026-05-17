/**
 * API route for team management
 *
 * DELETE /api/teams/[teamId] - Delete entire team
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDeleteTeam } from "@/lib/team-permissions";

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// DELETE /api/teams/[teamId]
export async function DELETE(request: Request, { params }: RouteParams) {
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
        profiles: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Check permissions
    const permission = await canDeleteTeam(userId, teamId);
    if (!permission.can) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    // Delete the team (cascades to members)
    await prisma.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}