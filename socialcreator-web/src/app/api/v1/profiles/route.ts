/**
 * API v1 /profiles route
 * Uses repository pattern instead of direct Prisma calls
 */

import { createProfileSchema } from "@socialcreator/types";
import { NextResponse } from "next/server";
import { badRequest, forbidden } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";
import { checkProfileQuota } from "@/lib/quota-guard";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/profiles
export const GET = withApiMiddleware(async ({ userId }) => {
  const { profile: profileRepo } = getRepositories();
  const profiles = await profileRepo.findByUserId(userId);

  // N+1 fix: fetch counts for ALL profiles in a single query each,
  // then merge into profiles using a lookup map.
  // This replaces the per-profile loop (N+1) with 3 aggregate queries.
  const profileIds = profiles.map((p) => p.id);

  const [agentCounts, contentCounts, accountCounts] = await Promise.all([
    prisma.agent.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds } },
      _count: true,
    }),
    prisma.generatedContent.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds } },
      _count: true,
    }),
    prisma.connectedAccount.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds } },
      _count: true,
    }),
  ]);

  const agentMap = Object.fromEntries(agentCounts.map((a) => [a.profileId, a._count]));
  const contentMap = Object.fromEntries(contentCounts.map((c) => [c.profileId, c._count]));
  const accountMap = Object.fromEntries(accountCounts.map((a) => [a.profileId, a._count]));

  const profilesWithCounts = profiles.map((profile) => ({
    ...profile,
    _count: {
      agents: agentMap[profile.id] ?? 0,
      generatedContents: contentMap[profile.id] ?? 0,
      connectedAccounts: accountMap[profile.id] ?? 0,
    },
  }));

  return NextResponse.json(
    { profiles: profilesWithCounts },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// POST /api/v1/profiles
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = createProfileSchema.safeParse(body);

  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0].message);
  }

  const hasQuota = await checkProfileQuota(userId);
  if (!hasQuota) {
    return forbidden("Profile limit reached. Upgrade to create more profiles.");
  }

  const { name, brandVoice, contentBank, platforms } = validationResult.data;

  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.create({
    userId,
    name,
    brandVoice: brandVoice || "",
    contentBank: contentBank ?? undefined,
    platforms: platforms || [],
  });

  return NextResponse.json(
    { profile },
    {
      status: 201,
      headers: {
        "X-API-Version": "v1",
      },
    },
  );
});
