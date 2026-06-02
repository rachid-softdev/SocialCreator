/**
 * API v1 /connected-accounts route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

const connectAccountSchema = z.object({
  profileId: z.string().min(1),
  platform: z.enum([
    "TIKTOK",
    "INSTAGRAM",
    "YOUTUBE",
    "FACEBOOK",
    "X",
    "LINKEDIN",
    "THREADS",
    "PINTEREST",
  ]),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  accountAvatarUrl: z.string().url().optional(),
});

// GET /api/v1/connected-accounts?profileId=xxx
export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return badRequest("profileId is required");
  }

  // Verify profile ownership
  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  const { connectedAccount: caRepo } = getRepositories();
  const accounts = await caRepo.findByProfileId(profileId);

  return NextResponse.json(
    { accounts },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});

// POST /api/v1/connected-accounts
export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const validationResult = connectAccountSchema.safeParse(body);

  if (!validationResult.success) {
    return badRequest(validationResult.error.errors[0].message);
  }

  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(validationResult.data.profileId);
  if (!profile || profile.userId !== userId) {
    return notFound("Profile");
  }

  const { connectedAccount: caRepo } = getRepositories();
  const account = await caRepo.create({
    profileId: validationResult.data.profileId,
    platform: validationResult.data.platform,
    accessToken: validationResult.data.accessToken,
    refreshToken: validationResult.data.refreshToken,
    expiresAt: validationResult.data.expiresAt
      ? new Date(validationResult.data.expiresAt)
      : undefined,
    accountId: validationResult.data.accountId,
    accountName: validationResult.data.accountName,
    accountAvatarUrl: validationResult.data.accountAvatarUrl,
  });

  return NextResponse.json(
    { account },
    {
      status: 201,
      headers: { "X-API-Version": "v1" },
    },
  );
});
