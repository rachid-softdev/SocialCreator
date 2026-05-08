/**
 * Publish guard - enforces daily cap limits per platform per profile
 * Rule: max 4 posts/day/account, configurable up to 8
 */

import { prisma } from "@/lib/prisma";
import { startOfDayUTC } from "@/lib/utils";
import { Platform } from "@prisma/client";

export interface CapStatus {
  allowed: boolean;
  count: number;
  max: number;
}

/**
 * Check daily publishing cap for a profile/platform
 * Returns the current count and whether publishing is allowed
 */
export async function checkDailyCap(
  profileId: string,
  platform: Platform,
  maxOverride?: number
): Promise<CapStatus> {
  // Get maxPerDay from active agents on this platform
  const agents = await prisma.agent.findMany({
    where: {
      profileId,
      platforms: { has: platform },
      isActive: true,
    },
    select: { maxPerDay: true },
  });

  const maxByAgents = agents.length > 0 ? Math.max(...agents.map((a) => a.maxPerDay)) : 2;
  const max = Math.min(maxByAgents, maxOverride ?? 8);

  const startOfDay = startOfDayUTC(new Date());
  const count = await prisma.publishLog.count({
    where: {
      profileId,
      platform,
      publishedAt: { gte: startOfDay },
      success: true,
    },
  });

  return { allowed: count < max, count, max };
}

/**
 * Full publish eligibility check
 * Verifies both cap and account availability
 */
export async function canPublish(
  profileId: string,
  platform: Platform
): Promise<{ canPublish: boolean; reason?: string }> {
  const { allowed, count, max } = await checkDailyCap(profileId, platform);

  if (!allowed) {
    return {
      canPublish: false,
      reason: `Cap atteint: ${count}/${max} publications aujourd'hui pour ${platform}`,
    };
  }

  // Check connected account exists and is active
  const account = await prisma.connectedAccount.findUnique({
    where: { profileId_platform: { profileId, platform } },
  });

  if (!account || !account.isActive) {
    return { canPublish: false, reason: `Aucun compte ${platform} connecté` };
  }

  return { canPublish: true };
}

/**
 * Get cap status for all platforms of a profile
 */
export async function getProfileCapStatus(profileId: string): Promise<
  Array<{
    platform: Platform;
    count: number;
    max: number;
    allowed: boolean;
  }>
> {
  const platforms: Platform[] = [
    "INSTAGRAM",
    "TIKTOK",
    "YOUTUBE",
    "FACEBOOK",
    "X",
    "LINKEDIN",
    "THREADS",
    "PINTEREST",
  ];

  const results = await Promise.all(
    platforms.map(async (platform) => {
      const { allowed, count, max } = await checkDailyCap(profileId, platform);
      return { platform, count, max, allowed };
    })
  );

  return results.filter((r) => r.max > 0);
}
