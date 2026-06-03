/**
 * Tests for the rate limiting system.
 *
 * Focuses on:
 * - In-memory fallback rate limiting (since Redis may not be available in test)
 * - Parsing window strings to seconds
 * - Path-based config matching (exact, prefix, default)
 * - Identifier extraction from requests
 * - withRateLimit middleware behavior
 * - Strict fallback limits on Redis error
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// We need to mock Redis and Ratelimit before importing
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    keys: vi.fn(),
    publish: vi.fn(),
  })),
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn(),
  })),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import {
  checkRateLimit,
  clearRateLimitCache,
  getIdentifier,
  withRateLimit,
} from "@/lib/rate-limit-redis";

describe("Rate Limit Redis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitCache();
    // Remove env vars so Redis appears unavailable → tests exercise the in-memory fallback
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  // ============================================
  // Identifier extraction
  // ============================================

  describe("getIdentifier", () => {
    it("should use userId when provided", () => {
      const request = new Request("http://localhost/api/test");
      const id = getIdentifier(request, "user-123");
      expect(id).toBe("user:user-123");
    });

    it("should use apiKey when userId not provided", () => {
      const request = new Request("http://localhost/api/test");
      const id = getIdentifier(request, undefined, "key-abc");
      expect(id).toBe("apikey:key-abc");
    });

    it("should fallback to ip:unknown when no identifier available", () => {
      const request = new Request("http://localhost/api/test");
      const id = getIdentifier(request);
      expect(id).toBe("ip:unknown");
    });

    it("should use NextRequest.ip when available", () => {
      const request = new Request("http://localhost/api/test") as Request & { ip?: string };
      request.ip = "192.168.1.1";
      const id = getIdentifier(request);
      expect(id).toBe("ip:192.168.1.1");
    });
  });

  // ============================================
  // checkRateLimit - skips non-API and excluded
  // ============================================

  describe("checkRateLimit path exclusion", () => {
    it("should skip rate limiting for non-API routes", async () => {
      const request = new Request("http://localhost/_next/static/chunk.js");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(0);
    });

    it("should skip rate limiting for webhook paths", async () => {
      const request = new Request("http://localhost/api/stripe/webhook");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
    });

    it("should skip rate limiting for health check", async () => {
      const request = new Request("http://localhost/api/health");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
    });

    it("should skip rate limiting for uploadthing", async () => {
      const request = new Request("http://localhost/api/uploadthing/callback");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
    });

    it("should apply rate limiting for API routes", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true); // first request — within limit
      expect(result.limit).toBeGreaterThan(0);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  // ============================================
  // In-memory rate limiting (Redis not available)
  // ============================================

  describe("in-memory rate limiting", () => {
    it("should allow requests within the limit", async () => {
      // Use a path with default fallback limit (20 req/60s)
      const request = new Request("http://localhost/api/agents");

      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit(request, "user:test-user");
        expect(result.success).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      }
    });

    it("should reject requests when limit exceeded", async () => {
      // The fallback config has /api/auth/callback/credentials at limit 2
      const request = new Request("http://localhost/api/auth/callback/credentials");

      // Make 2 allowed requests
      for (let i = 0; i < 2; i++) {
        const result = await checkRateLimit(request, "ip:test-block");
        expect(result.success).toBe(true);
      }

      // 3rd request should be rate limited (fallback limit = 2)
      const blocked = await checkRateLimit(request, "ip:test-block");
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("should use different counter for different identifiers", async () => {
      // Use a path with default fallback limit (20) to avoid very-low-auth limits
      const request = new Request("http://localhost/api/content");

      // Make 18 requests for user-1 (stays under default 20 limit)
      for (let i = 0; i < 18; i++) {
        await checkRateLimit(request, "user:user-1");
      }

      // user-2 should still have full quota (default fallback limit = 20, used 1 = 19 remaining)
      const resultForUser2 = await checkRateLimit(request, "user:user-2");
      expect(resultForUser2.success).toBe(true);
      expect(resultForUser2.remaining).toBe(19); // limit 20, used 1 = 19 remaining
    });

    it("should return reset time in the future", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await checkRateLimit(request, "user:reset-test");

      expect(result.reset).toBeGreaterThan(Date.now());
    });
  });

  // ============================================
  // withRateLimit middleware
  // ============================================

  describe("withRateLimit middleware", () => {
    it("should return null when under the limit", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await withRateLimit(request);
      expect(result).toBeNull();
    });

    it("should return 429 response when over the limit", async () => {
      const request = new Request("http://localhost/api/auth/callback/credentials");

      // Exhaust the rate limit
      for (let i = 0; i < 5; i++) {
        await withRateLimit(request, { userId: "rate-limited-user" });
      }

      // The 6th request should get a 429
      const blocked = await withRateLimit(request, { userId: "rate-limited-user" });
      expect(blocked).not.toBeNull();
      if (blocked) {
        expect(blocked.status).toBe(429);

        const body = await blocked.json();
        expect(body.error).toBe("Too Many Requests");

        expect(blocked.headers.get("X-RateLimit-Limit")).toBeTruthy();
        expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(blocked.headers.get("Retry-After")).toBeTruthy();
      }
    });

    it("should use userId as identifier when provided", async () => {
      const request = new Request("http://localhost/api/test");

      // This should not rate limit since different userId
      const result = await withRateLimit(request, { userId: "specific-user" });
      expect(result).toBeNull();
    });
  });
});
