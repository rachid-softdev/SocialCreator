/**
 * API v1 /agents route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

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

// GET /api/v1/agents?profileId=xxx
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  const { agent: agentRepo } = getRepositories();

  // Validate profile ownership if profileId provided
  if (profileId) {
    const { profile: profileRepo } = getRepositories();
    const profile = await profileRepo.findById(profileId);
    if (!profile || profile.userId !== userId) {
      return notFound("Profile");
    }
  }

  const agents = profileId ? await agentRepo.findByProfileId(profileId) : await Promise.resolve([]);

  // If no profileId filter, find all agents across user's profiles
  let allAgents = agents;
  if (!profileId) {
    const { profile: profileRepo } = getRepositories();
    const profiles = await profileRepo.findByUserId(userId);
    const profileAgents = await Promise.all(profiles.map((p) => agentRepo.findByProfileId(p.id)));
    allAgents = profileAgents.flat();
  }

  // Calculate stats for each agent using agentRun repo
  const { agentRun: runRepo } = getRepositories();
  const agentsWithStats = await Promise.all(
    allAgents.map(async (agent) => {
      const runs = await runRepo.findByAgentId(agent.id);
      const totalRuns = runs.length;
      const successRuns = runs.filter((r) => r.status === "SUCCESS").length;

      return {
        ...agent,
        stats: {
          totalRuns,
          successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0,
        },
        _count: { runs: totalRuns },
      };
    }),
  );

  return NextResponse.json(
    { agents: agentsWithStats },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// POST /api/v1/agents
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = createAgentSchema.safeParse(body);

  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0]!.message);
  }

  const { profileId, name, type, platforms, scheduleCron, autoPublish, maxPerDay, config } =
    validationResult.data;

  // Verify profile ownership
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  const { agent: agentRepo } = getRepositories();
  const agent = await agentRepo.create({
    profileId,
    name,
    type,
    platforms,
    scheduleCron: scheduleCron ?? null,
    autoPublish: autoPublish ?? false,
    maxPerDay: maxPerDay ?? 2,
    config: config ?? {},
  });

  return NextResponse.json(
    { agent },
    {
      status: 201,
      headers: { "X-API-Version": "v1" },
    },
  );
});
