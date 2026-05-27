import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createRunSchema = z.object({
  brief: z.string().min(10, "Brief must be at least 10 characters").max(5000),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/agents/[id]/run
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id, profile: { userId: session.user.id } },
      include: {
        profile: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (!agent.isActive) {
      return NextResponse.json(
        { error: "Agent is not active. Please enable it first." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validationResult = createRunSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 },
      );
    }

    const { brief } = validationResult.data;

    // Create the run with PENDING status
    const run = await prisma.agentRun.create({
      data: {
        agentId: id,
        brief,
        status: "PENDING",
      },
    });

    // Trigger the job asynchronously
    // In production, use Trigger.dev; in development, run synchronously
    try {
      if (process.env.TRIGGER_API_KEY && process.env.TRIGGER_API_URL) {
        // Production: Use Trigger.dev
        const { enqueueAgentRun } = await import("@/lib/trigger-client");
        enqueueAgentRun({
          agentId: id,
          runId: run.id,
          userId: session.user.id,
          profileId: agent.profileId,
        }).catch((err) => {
          console.error("Failed to enqueue agent run:", err);
        });
      } else {
        // Development: Run synchronously
        const { triggerAgentRun } = await import("@/lib/agent-runner");
        triggerAgentRun({ agentId: id, runId: run.id }).catch((err) => {
          console.error("Failed to trigger agent run:", err);
        });
      }
    } catch (err) {
      console.error("Error triggering agent run:", err);
      // Don't fail the request - the run is created and can be retried
    }

    return NextResponse.json({ runId: run.id, status: run.status }, { status: 201 });
  } catch (error) {
    console.error("Error creating agent run:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/agents/[id]/run - List all runs for an agent
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: { id, profile: { userId: session.user.id } },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const [runs, total] = await Promise.all([
      prisma.agentRun.findMany({
        where: { agentId: id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { generatedContents: true },
          },
        },
      }),
      prisma.agentRun.count({ where: { agentId: id } }),
    ]);

    return NextResponse.json({
      runs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching agent runs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
