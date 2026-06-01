/**
 * Publish guard - enforces daily cap limits per platform per profile
 * Rule: max 4 posts/day/account, configurable up to 8
 *
 * Uses Redis for scalable cap counting with fallback to database
 */

import { Platform } from "@prisma/client";
import { startOfDayUTC } from "@socialcreator/utils";
import { getFeatureGateService } from "@/lib/entitlements/service";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/rate-limit-redis";

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
 * Peek daily publishing cap for a profile/platform (read-only)
 * Uses Redis for performance, falls back to database
 * Does NOT increment the counter — use incrementDailyCap() after successful publish
 */
export async function peekDailyCap(
  profileId: string,
  platform: Platform,
  maxOverride?: number,
): Promise<CapStatus> {
  const max = await getMaxPerDay(profileId, platform, maxOverride);
  const redis = getRedis();

  if (redis) {
    try {
      const key = getCapKey(profileId, platform);
      const val = await redis.get(key);
      const count = val ? parseInt(val, 10) : 0;

      return { allowed: count < max, count, max };
    } catch (error) {
      logger.warn({ err: error }, "Redis cap check failed, falling back to database");
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
 * Increment daily cap counter for a profile/platform (write-only)
 * Called only after successful publish
 */
export async function incrementDailyCap(profileId: string, platform: Platform): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const key = getCapKey(profileId, platform);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 86400);
      }
    } catch (error) {
      logger.warn({ err: error }, "Redis increment failed");
    }
  }
}

/**
 * Record a successful publish (increment cap counter)
 * Database write happens via PublishLog in the caller
 */
export async function recordPublish(profileId: string, platform: Platform): Promise<void> {
  await incrementDailyCap(profileId, platform);
}

/**
 * Full publish eligibility check
 * Verifies entitlement, daily cap, and account availability
 */
export async function canPublish(
  profileId: string,
  platform: Platform,
  orgId?: string,
): Promise<{ canPublish: boolean; reason?: string }> {
  // Check entitlement first if orgId is provided
  if (orgId) {
    const hasFeature = await getFeatureGateService().hasFeature(orgId, `PUBLISH_${platform}`);
    if (!hasFeature) {
      return {
        canPublish: false,
        reason: "Votre plan ne permet pas la publication sur cette plateforme",
      };
    }
  }

  const { allowed, count, max } = await peekDailyCap(profileId, platform);

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

  if (!account?.isActive) {
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
      const { allowed, count, max } = await peekDailyCap(profileId, platform);
      return { platform, count, max, allowed };
    }),
  );

  return results.filter((r) => r.max > 0);
}
