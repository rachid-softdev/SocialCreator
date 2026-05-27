/**
 * API routes for Team management
 *
 * GET    /api/teams - List user's teams
 * POST   /api/teams - Create a new team
 * GET    /api/teams/[id] - Get team details
 * PUT    /api/teams/[id] - Update team
 * DELETE /api/teams/[id] - Delete team
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// GET /api/teams
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get teams where user is owner or member
    const teams = await prisma.team.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { profiles: true, members: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/teams
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const validation = createTeamSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    const { name } = validation.data;

    // Create team with current user as owner
    const team = await prisma.team.create({
      data: {
        name,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "OWNER",
            joinedAt: new Date(),
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
