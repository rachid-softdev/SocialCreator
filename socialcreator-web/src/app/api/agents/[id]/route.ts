import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyAgentOwnership } from "@/lib/ownership";
import { prisma } from "@/lib/prisma";

const updateAgentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  type: z.enum(["TEXT_POST", "VIDEO_CLIP", "CROSS_POST"]).optional(),
  platforms: z
    .array(
      z.enum([
        "TIKTOK",
        "INSTAGRAM",
        "YOUTUBE",
        "FACEBOOK",
        "X",
        "LINKEDIN",
        "THREADS",
        "PINTEREST",
      ]),
    )
    .min(1)
    .optional(),
  scheduleCron: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
  maxPerDay: z.number().int().min(1).max(10).optional(),
  config: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id]
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await verifyAgentOwnership(session.user.id, id);

    if (!result.valid) return result.error;

    const agent = result.data;

    // Calculate stats
    const totalRuns = await prisma.agentRun.count({
      where: { agentId: id },
    });
    const successRuns = await prisma.agentRun.count({
      where: { agentId: id, status: "SUCCESS" },
    });

    return NextResponse.json({
      agent: {
        ...agent,
        stats: {
          totalRuns,
          successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/agents/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ownership = await verifyAgentOwnership(session.user.id, id);

    if (!ownership.valid) return ownership.error;

    const body = await request.json();
    const validationResult = updateAgentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const updateData = validationResult.data;

    const agent = await prisma.agent.update({
      where: { id },
      data: updateData as any,
      include: {
        profile: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("Error updating agent:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/agents/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ownership = await verifyAgentOwnership(session.user.id, id);

    if (!ownership.valid) return ownership.error;

    // Cascade delete - Prisma handles this via onDelete: Cascade
    // But we need to explicitly delete runs first if not using cascade
    await prisma.agentRun.deleteMany({
      where: { agentId: id },
    });

    await prisma.agent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agent:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
