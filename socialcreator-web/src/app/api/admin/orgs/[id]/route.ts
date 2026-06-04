/**
 * Admin Organization Detail API
 * GET /api/admin/orgs/[id] — Get organization detail with subscription, team, and overrides
 */

import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            planKey: true,
            status: true,
            cancelAtPeriodEnd: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
        _count: {
          select: {
            entitlementOverrides: true,
          },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ data: org });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
