/**
 * Admin User Detail API
 * GET /api/admin/users/[id] — Get user details
 * PATCH /api/admin/users/[id] — Update user (name, role)
 * DELETE /api/admin/users/[id] — Delete user
 */

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

const VALID_ROLES = ["USER", "ADMIN"] as const;

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(VALID_ROLES).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        cguAccepted: true,
        createdAt: true,
        updatedAt: true,
        profiles: {
          select: {
            id: true,
            name: true,
            platforms: true,
            _count: {
              select: {
                agents: true,
                generatedContents: true,
              },
            },
          },
        },
        ownedTeams: {
          select: {
            id: true,
            name: true,
          },
        },
        teamMemberships: {
          select: {
            id: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get usage stats separately
    const [totalContent, publishedContent] = await Promise.all([
      prisma.generatedContent.count({
        where: {
          profile: { userId: id },
        },
      }),
      prisma.publishLog.count({
        where: { userId: id, success: true },
      }),
    ]);

    return NextResponse.json({
      ...user,
      stats: {
        totalContent,
        publishedContent,
      },
    });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, role } = parsed.data;

    if (!name && !role) {
      return NextResponse.json(
        { error: "At least one field (name or role) must be provided" },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Prevent deleting yourself
    const admin = await requireAdmin();
    if (admin.id === id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
