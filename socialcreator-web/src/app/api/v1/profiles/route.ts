/**
 * API v1 /profiles route
 * Uses repository pattern instead of direct Prisma calls
 */

import { createProfileSchema } from "@socialcreator/types";
import { NextResponse } from "next/server";
import { badRequest, forbidden } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { checkProfileQuota } from "@/lib/quota-guard";
import { getRepositories } from "@/lib/repositories";

// GET /api/v1/profiles
export const GET = withApiMiddleware(async ({ userId }) => {
  const { profile: profileRepo } = getRepositories();
  const profiles = await profileRepo.findByUserId(userId);

  // Enrich with counts
  const profilesWithCounts = await Promise.all(
    profiles.map(async (profile) => {
      const {
        agent: agentRepo,
        content: contentRepo,
        connectedAccount: caRepo,
      } = getRepositories();
      const [agents, contents, connectedAccounts] = await Promise.all([
        agentRepo.findByProfileId(profile.id),
        contentRepo.findByProfileId(profile.id, { pageSize: 1 }),
        caRepo.findByProfileId(profile.id),
      ]);

      return {
        ...profile,
        _count: {
          agents: agents.length,
          generatedContents: contents.total,
          connectedAccounts: connectedAccounts.length,
        },
      };
    }),
  );

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
    contentBank: contentBank || null,
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
