/**
 * API v1 /agents/[id]/runs route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/agents/:id/runs
export const GET = withApiMiddleware(async ({ userId, params }) => {
  const { agent: agentRepo, agentRun: runRepo, profile: profileRepo } = getRepositories();

  const agent = await agentRepo.findById(params.id as string);
  if (!agent) return notFound("Agent");

  const profile = await profileRepo.findById(agent.profile.id);
  if (!profile || profile.userId !== userId) return unauthorized();

  const runs = await runRepo.findByAgentId(params.id as string);

  return NextResponse.json(
    { runs },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
