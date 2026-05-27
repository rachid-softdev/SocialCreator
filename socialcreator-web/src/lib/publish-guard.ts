/**
 * Publish guard - enforces daily cap limits per platform per profile
 * Rule: max 4 posts/day/account, configurable up to 8
 *
 * Uses Redis for scalable cap counting with fallback to database
 */

import { prisma } from "@/lib/prisma";
import { startOfDayUTC } from "@socialcreator/utils";
import { Platform } from "@prisma/client";
import { getRedis } from "./rate-limit-redis";

export interface CapStatus {
  allowed: boolean;
  count: number;
  max: number;
}

/**
 * Get Redis key for daily cap
 */
function getCapKey(profileId: string, platform: Platform): string {
  const dateStr = startOfDayUTC(new Date()).toISOString().split("T")[0];
  return `cap:${profileId}:${platform}:${dateStr}`;
}

/**
 * Get maxPerDay for a profile/platform from active agents
 */
async function getMaxPerDay(
  profileId: string,
  platform: Platform,
  maxOverride?: number,
): Promise<number> {
  const agents = await prisma.agent.findMany({
    where: {
      profileId,
      platforms: { has: platform },
      isActive: true,
    },
    select: { maxPerDay: true },
  });

  const maxByAgents = agents.length > 0 ? Math.max(...agents.map((a) => a.maxPerDay)) : 2;
  return Math.min(maxByAgents, maxOverride ?? 8);
}

/**
 * Check daily publishing cap for a profile/platform
 * Uses Redis for performance, falls back to database
 */
export async function checkDailyCap(
  profileId: string,
  platform: Platform,
  maxOverride?: number,
): Promise<CapStatus> {
  const max = await getMaxPerDay(profileId, platform, maxOverride);
  const redis = getRedis();

  if (redis) {
    try {
      const key = getCapKey(profileId, platform);
      const count = await redis.incr(key);

      // Set expiry on first increment (24 hours)
      if (count === 1) {
        await redis.expire(key, 86400); // 24 hours in seconds
      }

      return { allowed: count <= max, count, max };
    } catch (error) {
      console.warn("Redis cap check failed, falling back to database:", error);
      // Fall through to database fallback
    }
  }

  // Fallback to database count
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
 * Record a successful publish (increment cap counter)
 */
export async function recordPublish(profileId: string, platform: Platform): Promise<void> {
  const redis = getRedis();

  if (redis) {
    try {
      const key = getCapKey(profileId, platform);
      await redis.incr(key);

      // Set expiry on first increment
      const current = await redis.get(key);
      if (current === "1") {
        await redis.expire(key, 86400);
      }
    } catch (error) {
      console.warn("Failed to record publish in Redis:", error);
    }
  }
  // Note: Database write happens via PublishLog in the publish flow
}

/**
 * Full publish eligibility check
 * Verifies both cap and account availability
 */
export async function canPublish(
  profileId: string,
  platform: Platform,
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
  // Use Platform enum instead of hardcoded array
  const platforms: Platform[] = Object.values(Platform);

  const results = await Promise.all(
    platforms.map(async (platform) => {
      const { allowed, count, max } = await checkDailyCap(profileId, platform);
      return { platform, count, max, allowed };
    }),
  );

  return results.filter((r) => r.max > 0);
}
