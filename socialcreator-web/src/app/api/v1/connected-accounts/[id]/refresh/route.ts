/**
 * API v1 /connected-accounts/[id]/refresh route
 * Uses repository pattern + withApiMiddleware for auth and rate limiting
 */

import { NextResponse } from "next/server";
import { badRequest, notFound, unauthorized } from "@/lib/api-errors";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";
import { getValidAccessToken } from "@/lib/services/tokens";

// POST /api/v1/connected-accounts/:id/refresh
export const POST = withApiMiddleware(async ({ userId, params }) => {
  const { connectedAccount: caRepo, profile: profileRepo } = getRepositories();
  const account = await caRepo.findById(params.id as string);

  if (!account) return notFound("Connected account");

  // Verify ownership
  const profile = await profileRepo.findById(account.profileId);
  if (!profile || profile.userId !== userId) return unauthorized();

  // getValidAccessToken handles refresh internally if the token is expired
  const token = await getValidAccessToken(account.id);

  if (!token) {
    return badRequest("Failed to refresh token. The account may need to be reconnected.");
  }

  // Return the updated account (with decrypted tokens) for the client
  const updated = await caRepo.findById(account.id);

  return NextResponse.json(
    { success: true, account: updated },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-API-Version": "v1",
      },
    },
  );
});
