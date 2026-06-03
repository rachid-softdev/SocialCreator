import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string; runId: string }>;
}

// GET /api/agents/[id]/runs/[runId]
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, runId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id, profile: { userId: session.user.id } },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const run = await prisma.agentRun.findFirst({
      where: { id: runId, agentId: id },
      include: {
        agent: {
          select: { id: true, name: true, type: true },
        },
        generatedContents: {
          orderBy: { platform: "asc" },
          include: {
            profile: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Calculate duration if finished
    let duration: number | null = null;
    if (run.startedAt && run.finishedAt) {
      duration = Math.round(
        (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000,
      );
    }

    return NextResponse.json({
      run: {
        ...run,
        duration,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Error fetching run");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/agents/[id]/runs/[runId]/rerun
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, runId } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id, profile: { userId: session.user.id } },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const existingRun = await prisma.agentRun.findFirst({
      where: { id: runId, agentId: id },
    });

    if (!existingRun) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Only allow rerun for failed runs
    if (existingRun.status !== "FAILED") {
      return NextResponse.json({ error: "Only failed runs can be rerun" }, { status: 400 });
    }

    // Create a new run with the same brief
    const newRun = await prisma.agentRun.create({
      data: {
        agentId: id,
        brief: existingRun.brief,
        status: "PENDING",
      },
    });

    // Trigger the job asynchronously
    try {
      if (process.env.TRIGGER_API_KEY && process.env.TRIGGER_API_URL) {
        const { enqueueAgentRun } = await import("@/lib/trigger-client");
        enqueueAgentRun({
          agentId: id,
          runId: newRun.id,
          userId: session.user.id,
          profileId: agent.profileId,
        }).catch((err) => {
          logger.error({ err }, "Failed to enqueue agent run");
        });
      } else {
        const { triggerAgentRun } = await import("@/lib/agent-runner");
        triggerAgentRun({ agentId: id, runId: newRun.id }).catch((err) => {
          logger.error({ err }, "Failed to trigger agent run");
        });
      }
    } catch (err) {
      logger.error({ err }, "Error triggering agent run");
    }

    return NextResponse.json({ runId: newRun.id, status: newRun.status }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Error rerunning agent");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
