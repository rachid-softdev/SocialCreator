/**
 * Rate Limiting with Upstash Redis
 * Production-ready rate limiting with persistence
 * 
 * Install: npm install @upstash/redis @upstash/ratelimit
 * Configure: Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================
// Configuration
// ============================================

interface RateLimitConfig {
  limit: number;
  window: string; // e.g., "60s", "1m", "1h"
}

// Rate limits per endpoint path
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
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
  "default": { limit: 100, window: "60s" },
};

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
    console.warn(
      "Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in environment."
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
    console.warn(`Redis not available, falling back to no rate limiting for ${path}`);
    return null;
  }

  // Create new rate limiter
  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    prefix: `ratelimit:${path}`,
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
  identifier: string
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
    // Redis not configured, allow request
    return { success: true, limit: 0, remaining: 0, reset: 0 };
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
    // On error, allow the request (fail open)
    console.error("Rate limit check failed:", error);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Extract identifier from request
 * Priority: user ID > API key > IP address
 */
export function getIdentifier(request: Request, userId?: string, apiKey?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // Fall back to IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return `ip:${ip}`;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return `ip:${realIp}`;
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
  options: RateLimitOptions = {}
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
      }
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
  path: string
): Promise<{ limit: number; remaining: number; reset: number } | null> {
  const limiter = getRateLimiter(path);
  if (!limiter) return null;

  try {
    // Use Redis directly to get current state
    const redisClient = getRedis();
    if (!redisClient) return null;

    const key = `${limiter.prefix}:${identifier}`;
    const data = await redisClient.get(key);

    if (!data) {
      return { limit: limiter.limit, remaining: limiter.limit, reset: 0 };
    }

    // Parse the stored data
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return {
      limit: limiter.limit,
      remaining: Math.max(0, limiter.limit - (parsed.remaining || 0)),
      reset: parsed.reset || 0,
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