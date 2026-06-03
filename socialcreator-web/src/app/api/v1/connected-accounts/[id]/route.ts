/**
 * API v1 /connected-accounts/[id] route
 * Uses repository pattern instead of direct Prisma calls
 */

import { NextResponse } from "next/server";
import { notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

// DELETE /api/v1/connected-accounts/:id
export const DELETE = withApiMiddleware(async ({ userId }, params) => {
  const { connectedAccount: caRepo, profile: profileRepo } = getRepositories();
  const account = await caRepo.findById(params?.id as string);

  if (!account) return notFound("Connected account");

  const profile = await profileRepo.findById(account.profileId);
  if (!profile || profile.userId !== userId) return unauthorized();

  await caRepo.delete(params?.id as string);

  return NextResponse.json(
    { success: true },
    {
      headers: { "X-API-Version": "v1" },
    },
  );
});
