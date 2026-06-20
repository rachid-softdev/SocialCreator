/**
 * Feature Flags & Entitlements - Cache Service
 * Two-level cache: Redis (primary) + Memory LRU (fallback)
 */

import { Redis } from "@upstash/redis";
import logger from "@/lib/logger";
import type { ICacheService } from "./types";

// ============================================
// Configuration
// ============================================

const CACHE_TTL_SECONDS = 300; // 5 minutes (Redis)
const MEMORY_TTL_MS = 30000; // 30 seconds (fallback)
const ENTITLEMENTS_PREFIX = "entitlements:";
const INVALIDATION_CHANNEL = "entitlements-invalidation";

// ============================================
// Memory LRU Cache (fallback)
// ============================================

interface MemoryCacheEntry<T> {
  value: T;
  expiry: number;
}

class MemoryLRUCache<T> {
  private cache = new Map<string, MemoryCacheEntry<T>>();
  private maxSize = 1000;

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================
// Cache Service Implementation
// ============================================

let redisInstance: Redis | null = null;
const memoryCache = new MemoryLRUCache<unknown>();

/**
 * Initialize Redis connection
 */
export function getEntitlementsRedis(): Redis | null {
  if (redisInstance) return redisInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.warn({}, "[Entitlements] Redis not configured, using memory fallback only");
    return null;
  }

  redisInstance = new Redis({
    url,
    token,
  });

  return redisInstance;
}

/**
 * Get cache key for entitlements
 */
export function getEntitlementsCacheKey(orgId: string): string {
  return `${ENTITLEMENTS_PREFIX}${orgId}`;
}

/**
 * Cache Service - implements ICacheService
 * Priority: Redis first, memory fallback
 */
export const cacheService: ICacheService = {
  /**
   * Get value from cache (Redis first, then memory)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    const redis = getEntitlementsRedis();
    if (redis) {
      try {
        const value = await redis.get<T>(key);
        if (value !== null) {
          // Also set in memory cache for faster subsequent access
          memoryCache.set(key, value, MEMORY_TTL_MS);
          return value;
        }
      } catch (error) {
        logger.warn({ err: error }, "[Entitlements] Redis get failed, falling back to memory");
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(key);
    if (cached !== null) {
      logger.debug({ key }, "[Entitlements] Cache hit (memory)");
      return cached as T;
    }

    logger.debug({ key }, "[Entitlements] Cache miss");
    return null;
  },

  /**
   * Set value in cache (both Redis and memory)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
    // Set in memory first (always available)
    memoryCache.set(key, value, MEMORY_TTL_MS);

    // Then try Redis
    const redis = getEntitlementsRedis();
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
        logger.debug({ key, ttlSeconds }, "[Entitlements] Cache set (both)");
      } catch (error) {
        logger.warn({ err: error }, "[Entitlements] Redis set failed");
      }
    }
  },

  /**
   * Invalidate a specific cache key
   */
  async invalidate(key: string): Promise<void> {
    // Remove from memory
    memoryCache.delete(key);

    // Remove from Redis
    const redis = getEntitlementsRedis();
    if (redis) {
      try {
        await redis.del(key);
        logger.debug({ key }, "[Entitlements] Cache invalidated");
      } catch (error) {
        logger.warn({ err: error }, "[Entitlements] Redis invalidate failed");
      }
    }
  },

  /**
   * Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const redis = getEntitlementsRedis();
    if (redis) {
      try {
        // ⚠️ redis.keys(pattern) is O(N) - avoid in production with large datasets.
        // Consider using redis.SCAN for production workloads.
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.debug({ pattern, keyCount: keys.length }, "[Entitlements] Pattern invalidated");
        }
      } catch (error) {
        logger.warn({ err: error }, "[Entitlements] Redis pattern invalidate failed");
      }
    }

    // Memory cache doesn't support patterns, just clear all if needed
    // For full invalidation, use invalidate() for specific keys
  },

  /**
   * Publish cache invalidation for multi-instance coordination
   * Uses Redis pub/sub (fan-out pattern)
   */
  async publishInvalidation(orgId: string): Promise<void> {
    const redis = getEntitlementsRedis();
    if (!redis) {
      logger.warn({}, "[Entitlements] Cannot publish - Redis not configured");
      return;
    }

    const key = getEntitlementsCacheKey(orgId);

    try {
      // Publish to all subscribers
      await redis.publish(INVALIDATION_CHANNEL, JSON.stringify({ orgId, key }));
      logger.debug({ orgId }, "[Entitlements] Published invalidation for org");
    } catch (error) {
      logger.warn({ err: error }, "[Entitlements] Failed to publish invalidation");
    }
  },
};

/**
 * Subscribe to invalidation events (call once at startup)
 */
export async function subscribeToInvalidations(
  _onInvalidate: (orgId: string) => void,
): Promise<() => void> {
  const redis = getEntitlementsRedis();
  if (!redis) {
    logger.warn({}, "[Entitlements] Cannot subscribe - Redis not configured");
    return () => {};
  }

  // Note: Full pub/sub implementation would require a separate subscriber client
  // For now, we rely on the publishInvalidation() function to handle fan-out
  // In production, you'd create a dedicated subscriber connection:
  // const subscriber = new Redis({ url: ..., token: ... })
  // await subscriber.subscribe(INVALIDATION_CHANNEL)

  logger.info({}, "[Entitlements] Pub/sub ready - invalidation events will be published");

  // Return no-op cleanup for now
  return () => {};
}

/**
 * Clear memory cache (useful for testing or server restart)
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
  logger.debug({}, "[Entitlements] Memory cache cleared");
}

/**
 * Clean up expired entries from memory cache
 */
export function cleanupExpiredMemoryCache(): void {
  memoryCache.clearExpired();
}

// ── Lifecycle-managed periodic cleanup ──────────────────────────
// NOTE: setInterval is NOT registered at module scope to avoid memory leaks
// in serverless environments. Call start/stop from instrumentation.ts instead.

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic cleanup of expired memory cache entries.
 * Call once at server startup (e.g., from instrumentation.ts).
 * @param intervalMs - Cleanup interval in milliseconds (default: 60000)
 * @returns A cleanup function to stop the interval
 */
export function startMemoryCacheCleanup(intervalMs: number = 60000): () => void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(cleanupExpiredMemoryCache, intervalMs);
  logger.debug({ intervalMs }, "[Entitlements] Memory cache cleanup started");
  return stopMemoryCacheCleanup;
}

/**
 * Stop periodic cleanup of expired memory cache entries.
 */
export function stopMemoryCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.debug({}, "[Entitlements] Memory cache cleanup stopped");
  }
}

export default cacheService;
