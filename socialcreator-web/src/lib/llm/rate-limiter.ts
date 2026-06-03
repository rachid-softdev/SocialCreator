/**
 * LLM Generation Rate Limiter & Quota
 * Free = 50/day, Pro = 500/day
 * Uses Redis for persistence, in-memory Map as fallback
 */

import { getRedis } from "@/lib/infrastructure/rate-limit-redis";
import logger from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────

export interface GenerationQuota {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt: number;
}

// ── Plan limits ─────────────────────────────────────────────────

const PLAN_DAILY_LIMITS: Record<string, number> = {
  free: 50,
  starter: 200,
  pro: 500,
  team: 1000,
};

const DEFAULT_LIMIT = 50;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── In-memory fallback store ────────────────────────────────────

interface InMemoryQuotaEntry {
  used: number;
  resetAt: number;
}

const inMemoryQuota = new Map<string, InMemoryQuotaEntry>();

// ── Helpers ─────────────────────────────────────────────────────

function getUserIdKey(userId: string): string {
  return `generation:${userId}`;
}

function getResetTime(): number {
  // Reset at midnight UTC
  const now = Date.now();
  const msUntilMidnight =
    new Date(new Date().toISOString().slice(0, 10) + "T23:59:59.999Z").getTime() - now + 1;
  return now + Math.max(msUntilMidnight, WINDOW_MS);
}

export async function getUserPlan(userId: string): Promise<string> {
  // Attempt to resolve plan via entitlements system
  try {
    const { getEntitlementRepository } = await import("@/lib/entitlements/repository");
    const repo = getEntitlementRepository();
    // Find user's org — iterate through teams
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ownedTeams: {
          select: { organization: { select: { id: true } }, id: true },
          take: 1,
        },
      },
    });

    const orgId = user?.ownedTeams?.[0]?.organization?.id;
    if (orgId) {
      const sub = await repo.getSubscription(orgId);
      if (sub) return sub.planKey;
    }
  } catch {
    // Fall through to default
  }

  return "free";
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Check generation quota for a user.
 * Returns current usage status including limit, used, remaining.
 */
export async function checkGenerationQuota(userId: string): Promise<GenerationQuota> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_DAILY_LIMITS[plan] ?? DEFAULT_LIMIT;

  // Try Redis first
  const redis = getRedis();
  if (redis) {
    try {
      const key = getUserIdKey(userId);
      const data = await redis.get<{ used: number; resetAt: number }>(key);
      if (!data) {
        return { allowed: true, used: 0, limit, remaining: limit, resetAt: getResetTime() };
      }
      if (data.resetAt < Date.now()) {
        // Window expired
        return { allowed: true, used: 0, limit, remaining: limit, resetAt: getResetTime() };
      }
      return {
        allowed: data.used < limit,
        used: data.used,
        limit,
        remaining: Math.max(0, limit - data.used),
        resetAt: data.resetAt,
      };
    } catch (error) {
      logger.error({ err: error }, "Redis quota check failed, falling back to in-memory");
    }
  }

  // In-memory fallback
  const entry = inMemoryQuota.get(userId);
  if (!entry || entry.resetAt < Date.now()) {
    return { allowed: true, used: 0, limit, remaining: limit, resetAt: getResetTime() };
  }

  return {
    allowed: entry.used < limit,
    used: entry.used,
    limit,
    remaining: Math.max(0, limit - entry.used),
    resetAt: entry.resetAt,
  };
}

/**
 * Atomic check-and-increment: atomically increment usage and return whether allowed.
 * Uses Redis INCRBY for atomicity. On first increment (return === count), sets TTL.
 * For in-memory fallback, uses a best-effort non-atomic increment.
 * Resolves the user's plan limit internally.
 */
export async function tryIncrementGenerationUsage(
  userId: string,
  count: number,
): Promise<GenerationQuota> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_DAILY_LIMITS[plan] ?? DEFAULT_LIMIT;

  const redis = getRedis();
  if (redis) {
    try {
      const key = getUserIdKey(userId);
      // INCRBY atomically increments and returns the new value
      const newCount = await redis.incrby(key, count);
      // On first increment, set TTL (24h window)
      if (newCount === count) {
        await redis.expire(key, 86400);
      }
      const resetAt = Date.now() + 86400000;
      const allowed = newCount <= limit;
      return {
        allowed,
        used: newCount,
        limit,
        remaining: Math.max(0, limit - newCount),
        resetAt,
      };
    } catch (error) {
      logger.error({ err: error }, "Redis quota increment failed, falling back to in-memory");
    }
  }

  // In-memory fallback (best-effort, non-atomic)
  const now = Date.now();
  const entry = inMemoryQuota.get(userId);
  let newUsed: number;
  let resetAt: number;
  if (!entry || entry.resetAt < now) {
    newUsed = count;
    resetAt = getResetTime();
    inMemoryQuota.set(userId, { used: newUsed, resetAt });
  } else {
    newUsed = entry.used + count;
    resetAt = entry.resetAt;
    entry.used = newUsed;
  }
  return {
    allowed: newUsed <= limit,
    used: newUsed,
    limit,
    remaining: Math.max(0, limit - newUsed),
    resetAt,
  };
}

/**
 * Increment generation usage for a user.
 * Uses atomic INCRBY via tryIncrement for consistency.
 * Kept for backward compatibility — delegates to tryIncrement.
 */
export async function incrementGenerationUsage(userId: string, count: number = 1): Promise<void> {
  await tryIncrementGenerationUsage(userId, count);
}

/**
 * Reset in-memory quota store (for testing).
 */
export function resetQuotaStore(): void {
  inMemoryQuota.clear();
}
