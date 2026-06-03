/**
 * API v1 /agents/[id] route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/agents/:id
export const GET = withApiMiddleware(async ({ userId }, params) => {
  const { agent: agentRepo, profile: profileRepo } = getRepositories();
  const agent = await agentRepo.findById(params?.id as string);

  if (!agent) return notFound("Agent");

  // Verify ownership through profile
  const profile = await profileRepo.findById(agent.profile.id);
  if (!profile || profile.userId !== userId) return unauthorized();

  return NextResponse.json(
    { agent },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// PUT /api/v1/agents/:id
export const PUT = withApiMiddleware(async ({ userId, request }, params) => {
  const { agent: agentRepo, profile: profileRepo } = getRepositories();
  const agent = await agentRepo.findById(params?.id as string);

  if (!agent) return notFound("Agent");

  const profile = await profileRepo.findById(agent.profile.id);
  if (!profile || profile.userId !== userId) return unauthorized();

  const body = await request.json();
  const updated = await agentRepo.update(params?.id as string, {
    name: body.name,
    platforms: body.platforms,
    scheduleCron: body.scheduleCron,
    isActive: body.isActive,
    autoPublish: body.autoPublish,
    maxPerDay: body.maxPerDay,
    config: body.config,
  });

  return NextResponse.json(
    { agent: updated },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});

// DELETE /api/v1/agents/:id
export const DELETE = withApiMiddleware(async ({ userId }, params) => {
  const { agent: agentRepo, profile: profileRepo } = getRepositories();
  const agent = await agentRepo.findById(params?.id as string);

  if (!agent) return notFound("Agent");

  const profile = await profileRepo.findById(agent.profile.id);
  if (!profile || profile.userId !== userId) return unauthorized();

  await agentRepo.delete(params?.id as string);

  return NextResponse.json(
    { success: true },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
