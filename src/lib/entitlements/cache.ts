/**
 * Feature Flags & Entitlements - Cache Service
 * Two-level cache: Redis (primary) + Memory LRU (fallback)
 */

import { Redis } from "@upstash/redis"
import type { ICacheService } from "./types"

// ============================================
// Configuration
// ============================================

const CACHE_TTL_SECONDS = 300 // 5 minutes (Redis)
const MEMORY_TTL_MS = 30000 // 30 seconds (fallback)
const ENTITLEMENTS_PREFIX = "entitlements:"
const INVALIDATION_CHANNEL = "entitlements-invalidation"

// ============================================
// Memory LRU Cache (fallback)
// ============================================

interface MemoryCacheEntry<T> {
  value: T
  expiry: number
}

class MemoryLRUCache<T> {
  private cache = new Map<string, MemoryCacheEntry<T>>()
  private maxSize = 1000

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  set(key: string, value: T, ttlMs: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

// ============================================
// Cache Service Implementation
// ============================================

let redisInstance: Redis | null = null
const memoryCache = new MemoryLRUCache<unknown>()

/**
 * Initialize Redis connection
 */
export function getEntitlementsRedis(): Redis | null {
  if (redisInstance) return redisInstance

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn("[Entitlements] Redis not configured, using memory fallback only")
    return null
  }

  redisInstance = new Redis({
    url,
    token,
  })

  return redisInstance
}

/**
 * Get cache key for entitlements
 */
export function getEntitlementsCacheKey(orgId: string): string {
  return `${ENTITLEMENTS_PREFIX}${orgId}`
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
    const redis = getEntitlementsRedis()
    if (redis) {
      try {
        const value = await redis.get<T>(key)
        if (value !== null) {
          // Also set in memory cache for faster subsequent access
          memoryCache.set(key, value, MEMORY_TTL_MS)
          return value
        }
      } catch (error) {
        console.warn("[Entitlements] Redis get failed, falling back to memory:", error)
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(key)
    if (cached !== null) {
      console.debug("[Entitlements] Cache hit (memory):", key)
      return cached as T
    }

    console.debug("[Entitlements] Cache miss:", key)
    return null
  },

  /**
   * Set value in cache (both Redis and memory)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
    // Set in memory first (always available)
    memoryCache.set(key, value, MEMORY_TTL_MS)

    // Then try Redis
    const redis = getEntitlementsRedis()
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(value), { ex: ttlSeconds })
        console.debug("[Entitlements] Cache set (both):", key, "TTL:", ttlSeconds)
      } catch (error) {
        console.warn("[Entitlements] Redis set failed:", error)
      }
    }
  },

  /**
   * Invalidate a specific cache key
   */
  async invalidate(key: string): Promise<void> {
    // Remove from memory
    memoryCache.delete(key)

    // Remove from Redis
    const redis = getEntitlementsRedis()
    if (redis) {
      try {
        await redis.del(key)
        console.debug("[Entitlements] Cache invalidated:", key)
      } catch (error) {
        console.warn("[Entitlements] Redis invalidate failed:", error)
      }
    }
  },

  /**
   * Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const redis = getEntitlementsRedis()
    if (redis) {
      try {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
          console.debug("[Entitlements] Pattern invalidated:", pattern, "keys:", keys.length)
        }
      } catch (error) {
        console.warn("[Entitlements] Redis pattern invalidate failed:", error)
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
    const redis = getEntitlementsRedis()
    if (!redis) {
      console.warn("[Entitlements] Cannot publish - Redis not configured")
      return
    }

    const key = getEntitlementsCacheKey(orgId)

    try {
      // Publish to all subscribers
      await redis.publish(INVALIDATION_CHANNEL, JSON.stringify({ orgId, key }))
      console.debug("[Entitlements] Published invalidation for org:", orgId)
    } catch (error) {
      console.warn("[Entitlements] Failed to publish invalidation:", error)
    }
  },
}

/**
 * Subscribe to invalidation events (call once at startup)
 */
export async function subscribeToInvalidations(
  _onInvalidate: (orgId: string) => void
): Promise<() => void> {
  const redis = getEntitlementsRedis()
  if (!redis) {
    console.warn("[Entitlements] Cannot subscribe - Redis not configured")
    return () => {}
  }

  // Note: Full pub/sub implementation would require a separate subscriber client
  // For now, we rely on the publishInvalidation() function to handle fan-out
  // In production, you'd create a dedicated subscriber connection:
  // const subscriber = new Redis({ url: ..., token: ... })
  // await subscriber.subscribe(INVALIDATION_CHANNEL)
  
  console.log("[Entitlements] Pub/sub ready - invalidation events will be published")

  // Return no-op cleanup for now
  return () => {}
}

/**
 * Clear memory cache (useful for testing or server restart)
 */
export function clearMemoryCache(): void {
  memoryCache.clear()
  console.debug("[Entitlements] Memory cache cleared")
}

/**
 * Clean up expired entries from memory cache
 */
export function cleanupExpiredMemoryCache(): void {
  memoryCache.clearExpired()
}

// Start periodic cleanup for memory cache
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredMemoryCache, 60000) // Every minute
}

export default cacheService