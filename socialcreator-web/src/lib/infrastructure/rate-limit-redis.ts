/**
 * Rate Limiting with Upstash Redis
 * Production-ready rate limiting with persistence
 *
 * Install: npm install @upstash/redis @upstash/ratelimit
 * Configure: Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import logger from "@/lib/logger";

// ============================================
// Configuration
// ============================================

interface RateLimitConfig {
  limit: number;
  window: string; // e.g., "60s", "1m", "1h"
}

// Rate limits per endpoint path
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Auth - strict limits for security
  "/api/auth/callback/credentials": { limit: 5, window: "60s" },
  "/api/auth/signin": { limit: 10, window: "60s" },
  "/api/auth/register": { limit: 3, window: "60s" },
  "/api/auth/session": { limit: 30, window: "60s" },
  "/api/auth": { limit: 20, window: "60s" },

  // MCP API - plus strict because publicly exposed
  "/api/mcp": { limit: 60, window: "60s" },

  // Agents - running agents
  "/api/agents": { limit: 30, window: "60s" },
  "/api/agents/[id]/run": { limit: 10, window: "60s" },

  // Content - creation and publishing
  "/api/content": { limit: 30, window: "60s" },
  "/api/content/[id]/publish": { limit: 10, window: "60s" },

  // Connected accounts - OAuth flows
  "/api/connected-accounts": { limit: 20, window: "60s" },

  // Profiles
  "/api/profiles": { limit: 20, window: "60s" },

  // Video uploads
  "/api/video/upload": { limit: 5, window: "300s" },

  // Stripe
  "/api/stripe/checkout": { limit: 5, window: "60s" },
  "/api/stripe/portal": { limit: 5, window: "60s" },

  // Default for other API endpoints
  default: { limit: 100, window: "60s" },
};

// ============================================
// In-Memory Fallback Store
// ============================================

interface InMemoryEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiting store (fallback when Redis unavailable)
 * Resets on server restart - not persistent
 */
const inMemoryStore = new Map<string, InMemoryEntry>();

/**
 * Clean up expired entries from in-memory store
 */
function cleanupInMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore.entries()) {
    if (entry.resetTime < now) {
      inMemoryStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupInMemoryStore, 5 * 60 * 1000);
}

/**
 * Strict fallback limits used when Redis is unavailable.
 * These are MORE restrictive than normal limits because:
 * - In-memory store resets on server restart
 * - In-memory is per-instance (not shared across deployments)
 * - Redis failure may indicate an attack (resource exhaustion)
 *
 * This is a FAIL CLOSED approach for the degraded mode.
 */
const STRICT_FALLBACK_LIMITS: Record<string, { limit: number; window: string }> = {
  // Auth: extremely strict when degraded
  "/api/auth/callback/credentials": { limit: 2, window: "120s" },
  "/api/auth/signin": { limit: 5, window: "120s" },
  "/api/auth/register": { limit: 1, window: "120s" },
  // Default for everything else when degraded
  default: { limit: 20, window: "60s" },
};

/**
 * In-memory rate limiting store (fallback when Redis unavailable)
 *
 * ⚠️ LIMITATIONS (documented):
 * - Resets on server restart → limits reset after deploy/restart
 * - NOT shared across instances → each instance has independent counter
 * - Used ONLY when Redis is not configured or when Redis call fails
 * - For production: configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 *
 * Behavior: FAIL CLOSED on Redis error (applies stricter limits).
 * When Redis is simply not configured (dev mode), normal limits apply.
 */
function checkRateLimitInMemory(
  identifier: string,
  path: string,
  useStrictLimits: boolean = false,
): RateLimitResult {
  let config: RateLimitConfig | null;

  if (useStrictLimits) {
    // Use strict limits when falling back due to Redis error
    const strictKey = Object.keys(STRICT_FALLBACK_LIMITS).find((k) => path.startsWith(k));
    const strictConfig = strictKey
      ? STRICT_FALLBACK_LIMITS[strictKey]
      : STRICT_FALLBACK_LIMITS.default;
    config = { limit: strictConfig.limit, window: strictConfig.window };
  } else {
    config = getConfigForPath(path);
  }

  const limit = config?.limit ?? 100;
  const windowSeconds = config ? parseWindowToSeconds(config.window) : 60;

  const key = `${path}:${identifier}`;
  const now = Date.now();
  const resetTime = now + windowSeconds * 1000;

  // Atomic read-and-increment using a single Map operation
  // This avoids the race condition of read-then-write
  const prevEntry = inMemoryStore.get(key);

  if (!prevEntry || prevEntry.resetTime < now) {
    // New window
    const remaining = limit - 1;
    inMemoryStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: Math.max(0, remaining),
      reset: resetTime,
    };
  }

  // Existing window — atomically increment
  const newCount = prevEntry.count + 1;
  prevEntry.count = newCount;

  const remaining = Math.max(0, limit - newCount);
  const success = newCount <= limit;

  return {
    success,
    limit,
    remaining,
    reset: prevEntry.resetTime,
  };
}

/**
 * Parse window string to seconds
 */
function parseWindowToSeconds(window: string): number {
  const match = window.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    default:
      return 60;
  }
}

// ============================================
// Redis Instance
// ============================================

let redis: Redis | null = null;

/**
 * Initialize Redis connection
 * Called on server startup
 */
export function initRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.warn(
      "Upstash Redis not configured. Using in-memory fallback. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment for production.",
    );
    return null;
  }

  redis = new Redis({
    url,
    token,
  });

  return redis;
}

/**
 * Get Redis instance
 * Returns null if not configured (fallback to in-memory)
 */
export function getRedis(): Redis | null {
  if (!redis) {
    return initRedis();
  }
  return redis;
}

// ============================================
// Rate Limiter Factory
// ============================================

/**
 * Cache for rate limiters (path -> Ratelimit instance)
 */
const limiterCache = new Map<string, Ratelimit>();

/**
 * Create or get cached rate limiter for a path
 */
function getRateLimiter(path: string): Ratelimit | null {
  // Check cache first
  if (limiterCache.has(path)) {
    return limiterCache.get(path)!;
  }

  // Get config for path
  const config = getConfigForPath(path);
  if (!config) {
    return null;
  }

  // Check if Redis is available
  const redisClient = getRedis();
  if (!redisClient) {
    logger.warn(`Redis not available, falling back to no rate limiting for ${path}`);
    return null;
  }

  // Create new rate limiter
  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(config.limit, config.window as any),
    timeout: 1000, // 1 second timeout
  });

  // Cache it
  limiterCache.set(path, limiter);

  return limiter;
}

/**
 * Get rate limit config for a path
 */
function getConfigForPath(path: string): RateLimitConfig | null {
  // Exact match
  if (RATE_LIMIT_CONFIGS[path]) {
    return RATE_LIMIT_CONFIGS[path];
  }

  // Prefix match (e.g., /api/agents -> /api/agents)
  for (const [key, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (key.endsWith("/") && path.startsWith(key.replace(/\/$/, ""))) {
      return config;
    }
    if (path.startsWith(key)) {
      return config;
    }
  }

  // Default
  if (path.startsWith("/api/")) {
    return RATE_LIMIT_CONFIGS.default;
  }

  return null;
}

// ============================================
// Rate Limit Check
// ============================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a request
 * @param request - The incoming request
 * @param identifier - Unique identifier (user ID, IP, API key)
 * @returns RateLimitResult with success status and metadata
 */
export async function checkRateLimit(
  request: Request,
  identifier: string,
): Promise<RateLimitResult> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip rate limiting for non-API routes
  if (!path.startsWith("/api/")) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  // Skip rate limiting for webhooks and health checks
  const excludedPaths = ["/api/stripe/webhook", "/api/uploadthing", "/api/health"];
  if (excludedPaths.some((p) => path.startsWith(p))) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  // Get rate limiter
  const limiter = getRateLimiter(path);

  if (!limiter) {
    // Redis not configured (dev mode) — use in-memory fallback with normal limits
    logger.debug(`Using in-memory rate limiting for ${path}`);
    return checkRateLimitInMemory(identifier, path, false);
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    // On Redis error, fall back to in-memory with STRICT limits
    // This is fail-closed: we rate-limit MORE aggressively when degraded
    logger.error({ err: error }, "Rate limit Redis check failed, using strict in-memory fallback");
    return checkRateLimitInMemory(identifier, path, true);
  }
}

/**
 * Extract identifier from request
 * Priority: user ID > API key > IP address
 *
 * ⚠️ SECURITY: Does NOT trust x-forwarded-for or x-real-ip headers
 * because they can be spoofed by clients to bypass rate limits.
 * Uses NextRequest.ip (actual TCP connection IP) when available.
 */
export function getIdentifier(request: Request, userId?: string, apiKey?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // Use actual connection IP from NextRequest (not spoofable headers)
  // NextRequest.ip is set by the server from the actual TCP connection
  const nextReq = request as { ip?: string };
  if (nextReq.ip) {
    return `ip:${nextReq.ip}`;
  }

  return `ip:unknown`;
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Create rate limiting middleware for API routes
 * Usage in API route:
 *
 * export async function POST(request: Request) {
 *   const rateLimitResponse = await withRateLimit(request, { userId: session?.user?.id });
 *   if (rateLimitResponse) return rateLimitResponse;
 *   // ... continue with handler
 * }
 */

export interface RateLimitOptions {
  userId?: string;
  apiKey?: string;
}

export async function withRateLimit(
  request: Request,
  options: RateLimitOptions = {},
): Promise<Response | null> {
  const identifier = getIdentifier(request, options.userId, options.apiKey);
  const result = await checkRateLimit(request, identifier);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${Math.ceil((result.reset - Date.now()) / 1000)} seconds.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      },
    );
  }

  return null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get current rate limit status (for debugging/dashboard)
 */
export async function getRateLimitStatus(
  identifier: string,
  path: string,
): Promise<{ limit: number; remaining: number; reset: number } | null> {
  const config = getConfigForPath(path);
  if (!config) return null;

  const redisClient = getRedis();
  if (!redisClient) {
    // Read from in-memory store (read-only peek, no increment)
    const inMemKey = `${path}:${identifier}`;
    const entry = inMemoryStore.get(inMemKey);
    const now = Date.now();
    const windowSeconds = parseWindowToSeconds(config.window);

    if (!entry || entry.resetTime < now) {
      return {
        limit: config.limit,
        remaining: config.limit,
        reset: now + windowSeconds * 1000,
      };
    }

    const remaining = Math.max(0, config.limit - entry.count);
    return { limit: config.limit, remaining, reset: entry.resetTime };
  }

  try {
    // Read-only: Redis GET to peek at counter without incrementing
    // NOTE: Key format @upstash/ratelimit:{path}:{identifier} is an internal
    // detail of the @upstash/ratelimit library. If this breaks, fall back
    // to the in-memory path above.
    const prefix = `@upstash/ratelimit:${path}`;
    const key = `${prefix}:${identifier}`;
    const data = await redisClient.get<string>(key);

    const windowSeconds = parseWindowToSeconds(config.window);
    const now = Date.now();

    if (!data) {
      return { limit: config.limit, remaining: config.limit, reset: now + windowSeconds * 1000 };
    }

    // @upstash/ratelimit stores data as a JSON string with 'count' field
    const parsed = JSON.parse(data);
    const currentCount = parsed.count || 0;
    const windowStart = parsed.start || now;
    const windowEndMs = windowStart + windowSeconds * 1000;

    return {
      limit: config.limit,
      remaining: Math.max(0, config.limit - currentCount),
      reset: windowEndMs,
    };
  } catch {
    return null;
  }
}

/**
 * Clear rate limit cache (useful for testing)
 */
export function clearRateLimitCache(): void {
  limiterCache.clear();
}

/**
 * Check if Upstash Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
