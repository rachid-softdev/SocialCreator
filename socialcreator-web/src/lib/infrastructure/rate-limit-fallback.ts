/**
 * In-Memory Rate Limiting Fallback
 *
 * Used when Redis is unavailable. Simple Map with TTL-based window.
 * Limits are more restrictive than Redis mode because:
 * - In-memory store resets on server restart
 * - Per-instance (not shared across deployments)
 *
 * ⚠️ This is a fallback only. DO NOT use in production with multiple instances.
 */

// ============================================
// Types
// ============================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimitOptions {
  userId?: string;
  apiKey?: string;
}

// ============================================
// Configuration
// ============================================

interface WindowConfig {
  limit: number;
  windowMs: number;
}

/**
 * Conservative limits for fallback mode.
 * These are MORE restrictive than normal Redis limits to
 * protect the system when degraded.
 */
const FALLBACK_LIMITS: Record<string, WindowConfig> = {
  // Auth: strictest when degraded
  "/api/auth/callback/credentials": { limit: 2, windowMs: 120_000 },
  "/api/auth/signin": { limit: 5, windowMs: 120_000 },
  "/api/auth/register": { limit: 1, windowMs: 120_000 },
  // Default for everything else
  default: { limit: 20, windowMs: 60_000 },
};

// ============================================
// In-Memory Store
// ============================================

interface InMemoryEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, InMemoryEntry>();

/**
 * Clean up expired entries
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 5 * 60 * 1000);
}

// ============================================
// Identifier extraction
// ============================================

/**
 * Extract identifier from request
 * Priority: user ID > API key > IP address
 *
 * SECURITY: Does NOT trust x-forwarded-for or x-real-ip headers
 * because they can be spoofed. Uses NextRequest.ip when available.
 */
export function getIdentifier(request: Request, userId?: string, apiKey?: string): string {
  if (userId) return `user:${userId}`;
  if (apiKey) return `apikey:${apiKey}`;
  const nextReq = request as { ip?: string };
  if (nextReq.ip) return `ip:${nextReq.ip}`;
  return "ip:unknown";
}

// ============================================
// Check rate limit
// ============================================

/**
 * Get the window config for a given path
 */
function getConfigForPath(path: string): WindowConfig {
  // Exact match
  if (FALLBACK_LIMITS[path]) return FALLBACK_LIMITS[path];
  // Prefix match
  for (const [key, config] of Object.entries(FALLBACK_LIMITS)) {
    if (key !== "default" && path.startsWith(key)) return config;
  }
  // default is always present in FALLBACK_LIMITS
  return FALLBACK_LIMITS.default!;
}

/**
 * Check rate limit using in-memory store
 *
 * Same interface as the Redis-based checkRateLimit.
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

  // Skip for webhooks and health checks
  const excludedPaths = ["/api/stripe/webhook", "/api/uploadthing", "/api/health"];
  if (excludedPaths.some((p) => path.startsWith(p))) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const config = getConfigForPath(path);
  const key = `${path}:${identifier}`;
  const now = Date.now();
  const resetTime = now + config.windowMs;

  const prevEntry = store.get(key);

  if (!prevEntry || prevEntry.resetTime < now) {
    // New window
    store.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: resetTime,
    };
  }

  // Existing window
  prevEntry.count += 1;

  return {
    success: prevEntry.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - prevEntry.count),
    reset: prevEntry.resetTime,
  };
}

// ============================================
// Middleware helper
// ============================================

/**
 * Create rate limiting middleware response for API routes.
 *
 * Returns a 429 Response if rate limited, or null if allowed.
 *
 * Usage:
 *   const rateLimitResponse = await withRateLimit(request, { userId });
 *   if (rateLimitResponse) return rateLimitResponse;
 */
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
// Utilities
// ============================================

/**
 * Check if in-memory fallback is being used
 */
export function isFallbackActive(): boolean {
  return true;
}

/**
 * Clear the store (useful for testing)
 */
export function clearStore(): void {
  store.clear();
}
