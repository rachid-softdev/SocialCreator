import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

const createAgentSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  type: z.enum(["TEXT_POST", "VIDEO_CLIP", "CROSS_POST"]),
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
    .min(1, "At least one platform is required"),
  scheduleCron: z.string().optional(),
  autoPublish: z.boolean().optional(),
  maxPerDay: z.number().int().min(1).max(10).optional(),
  config: z.record(z.unknown()).optional(),
});

// GET /api/agents?profileId=xxx
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  const whereClause = profileId ? { profileId, profile: { userId } } : { profile: { userId } };

  const agents = await prisma.agent.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      profile: {
        select: { id: true, name: true },
      },
      _count: {
        select: {
          runs: true,
        },
      },
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Calculate stats for each agent
  const agentsWithStats = await Promise.all(
    agents.map(async (agent) => {
      const totalRuns = await prisma.agentRun.count({
        where: { agentId: agent.id },
      });
      const successRuns = await prisma.agentRun.count({
        where: { agentId: agent.id, status: "SUCCESS" },
      });

      return {
        ...agent,
        stats: {
          totalRuns,
          successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        },
      };
    }),
  );

  return NextResponse.json(
    { agents: agentsWithStats },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
});

// POST /api/agents
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = createAgentSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json({ error: validationResult.error.errors[0]!.message }, { status: 400 });
  }

  const { profileId, name, type, platforms, scheduleCron, autoPublish, maxPerDay, config } =
    validationResult.data;

  // Verify profile ownership
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const agent = await prisma.agent.create({
    data: {
      profileId,
      name,
      type,
      platforms,
      scheduleCron,
      autoPublish: autoPublish ?? false,
      maxPerDay: maxPerDay ?? 2,
      config: (config ?? {}) as any,
    },
    include: {
      profile: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ agent }, { status: 201 });
});
