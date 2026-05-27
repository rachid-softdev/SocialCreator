/**
 * OAuth Middleware - Automatic token refresh at call time
 * This middleware ensures tokens are valid before making API calls
 * and automatically refreshes them if needed (optimized approach)
 */

import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateExpiresAt, isTokenExpired, refreshAccessToken } from "./token-exchange";

/**
 * Get a valid access token for a profile, refreshing if needed
 * This is the optimized approach - token is refreshed at call time only when expired
 *
 * @param profileId - The profile ID to get the token for
 * @param platform - The platform to get the token for
 * @returns The valid access token string
 * @throws Error if token cannot be obtained or profile doesn't exist
 */
export async function getValidAccessToken(profileId: string, platform: Platform): Promise<string> {
  const connectedAccount = await prisma.connectedAccount.findUnique({
    where: {
      profileId_platform: {
        profileId,
        platform,
      },
    },
    select: {
      accessToken: true,
      refreshToken: true,
      expiresAt: true,
      isActive: true,
    },
  });

  if (!connectedAccount) {
    throw new Error(`No connected account for profile ${profileId} and platform ${platform}`);
  }

  if (!connectedAccount.isActive) {
    throw new Error(`Account for profile ${profileId} and platform ${platform} is not active`);
  }

  // Get the refresh token
  const refreshToken = connectedAccount.refreshToken;

  if (!refreshToken) {
    // No refresh token available - use the access token as-is
    if (!connectedAccount.accessToken) {
      throw new Error(`No tokens available for profile ${profileId}, platform ${platform}`);
    }
    return connectedAccount.accessToken;
  }

  // Check if token needs refresh
  const needsRefresh = isTokenExpired(connectedAccount.expiresAt);

  if (!needsRefresh) {
    // Token is still valid, return it
    if (!connectedAccount.accessToken) {
      throw new Error(`No access token available for profile ${profileId}, platform ${platform}`);
    }
    return connectedAccount.accessToken;
  }

  // Token is expired or about to expire - refresh it
  console.log(
    `[OAuth Middleware] Refreshing token for profile ${profileId} (platform: ${platform})`,
  );

  try {
    const newTokens = await refreshAccessToken(platform, refreshToken);

    // Calculate new expiration
    const expiresAt = newTokens.expires_in ? calculateExpiresAt(newTokens.expires_in) : null;

    // Update the connected account with new tokens
    await prisma.connectedAccount.update({
      where: {
        profileId_platform: {
          profileId,
          platform,
        },
      },
      data: {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresAt,
      },
    });

    console.log(`[OAuth Middleware] Token refreshed successfully for profile ${profileId}`);

    return newTokens.access_token;
  } catch (error) {
    console.error(`[OAuth Middleware] Failed to refresh token for profile ${profileId}:`, error);
    throw new Error(
      `Failed to refresh token for profile ${profileId}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Batch refresh tokens for multiple profiles
 * More efficient than refreshing one at a time
 *
 * @param profileIds - Array of profile IDs to refresh
 * @param platform - Platform to refresh tokens for
 * @returns Map of profile ID to success status
 */
export async function batchRefreshTokens(
  profileIds: string[],
  platform: Platform,
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Process in parallel but handle errors individually
  const promises = profileIds.map(async (profileId) => {
    try {
      await getValidAccessToken(profileId, platform);
      results.set(profileId, true);
    } catch (error) {
      console.error(`[OAuth Middleware] Token refresh failed for profile ${profileId}:`, error);
      results.set(profileId, false);
    }
  });

  await Promise.all(promises);

  return results;
}

/**
 * Check which profiles need token refresh
 * Useful for proactive refresh before batch operations
 *
 * @param platform - Platform to check
 * @returns Array of profile IDs that need refresh
 */
export async function getProfilesNeedingRefresh(platform: Platform): Promise<string[]> {
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  const profilesWithExpiringTokens = await prisma.connectedAccount.findMany({
    where: {
      platform,
      expiresAt: {
        lte: fiveMinutesFromNow,
      },
      refreshToken: {
        not: null,
      },
      isActive: true,
    },
    select: {
      profileId: true,
    },
  });

  return profilesWithExpiringTokens.map((ca) => ca.profileId);
}
