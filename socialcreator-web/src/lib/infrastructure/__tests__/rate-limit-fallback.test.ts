/**
 * Tests for rate-limit-fallback.ts — In-memory rate limiting fallback (Infrastructure)
 *
 * Focuses on:
 * - getIdentifier: correct identifier prefix extraction
 * - checkRateLimit: path-based window limiting
 * - checkRateLimit: skip logic for non-API and excluded paths
 * - withRateLimit: middleware response helper
 * - clearStore: store reset
 * - isFallbackActive: always returns true
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// No external dependencies to mock — pure in-memory implementation
import {
  checkRateLimit,
  clearStore,
  getIdentifier,
  isFallbackActive,
  withRateLimit,
} from "../rate-limit-fallback";

describe("rate-limit-fallback (in-memory)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStore();
  });

  // ============================================
  // getIdentifier
  // ============================================

  describe("getIdentifier", () => {
    it("returns user: prefix when userId is provided", () => {
      const request = new Request("http://localhost/api/test");
      expect(getIdentifier(request, "user-123")).toBe("user:user-123");
    });

    it("returns apikey: prefix when apiKey is provided and userId is not", () => {
      const request = new Request("http://localhost/api/test");
      expect(getIdentifier(request, undefined, "key-abc")).toBe("apikey:key-abc");
    });

    it("prioritizes userId over apiKey", () => {
      const request = new Request("http://localhost/api/test");
      expect(getIdentifier(request, "user-1", "key-abc")).toBe("user:user-1");
    });

    it("returns ip: prefix when NextRequest.ip is available", () => {
      const request = new Request("http://localhost/api/test") as Request & { ip?: string };
      request.ip = "203.0.113.42";
      expect(getIdentifier(request)).toBe("ip:203.0.113.42");
    });

    it("returns ip:unknown when no identifier is available", () => {
      const request = new Request("http://localhost/api/test");
      expect(getIdentifier(request)).toBe("ip:unknown");
    });
  });

  // ============================================
  // isFallbackActive
  // ============================================

  describe("isFallbackActive", () => {
    it("always returns true", () => {
      expect(isFallbackActive()).toBe(true);
    });
  });

  // ============================================
  // checkRateLimit — path exclusion
  // ============================================

  describe("checkRateLimit path exclusion", () => {
    it("skips rate limiting for non-API routes", async () => {
      const request = new Request("http://localhost/_next/static/chunk.js");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it("skips rate limiting for /api/stripe/webhook", async () => {
      const request = new Request("http://localhost/api/stripe/webhook");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(0);
    });

    it("skips rate limiting for /api/health", async () => {
      const request = new Request("http://localhost/api/health");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
    });

    it("skips rate limiting for /api/uploadthing", async () => {
      const request = new Request("http://localhost/api/uploadthing/callback");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
    });

    it("applies rate limiting for other API routes", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await checkRateLimit(request, "ip:test");

      expect(result.success).toBe(true);
      expect(result.limit).toBeGreaterThan(0);
    });
  });

  // ============================================
  // checkRateLimit — window-based limiting
  // ============================================

  describe("checkRateLimit window logic", () => {
    it("allows requests within the configured limit", async () => {
      const request = new Request("http://localhost/api/agents");

      for (let i = 0; i < 15; i++) {
        const result = await checkRateLimit(request, "user:heavy-user");
        expect(result.success).toBe(true);
      }
    });

    it("blocks requests when limit is exceeded (auth endpoint)", async () => {
      const request = new Request("http://localhost/api/auth/callback/credentials");

      // First 2 requests succeed (limit = 2)
      const r1 = await checkRateLimit(request, "ip:block-test");
      expect(r1.success).toBe(true);
      expect(r1.remaining).toBe(1);

      const r2 = await checkRateLimit(request, "ip:block-test");
      expect(r2.success).toBe(true);
      expect(r2.remaining).toBe(0);

      // 3rd request is blocked
      const r3 = await checkRateLimit(request, "ip:block-test");
      expect(r3.success).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it("uses separate counters for different identifiers", async () => {
      const request = new Request("http://localhost/api/content");

      // Exhaust for user-a
      for (let i = 0; i < 20; i++) {
        await checkRateLimit(request, "user:user-a");
      }

      // user-a should now be blocked
      const userAResult = await checkRateLimit(request, "user:user-a");
      expect(userAResult.success).toBe(false);

      // user-b should still have a fresh window
      const userBResult = await checkRateLimit(request, "user:user-b");
      expect(userBResult.success).toBe(true);
      // First request for user-b: limit 20, used 1, remaining 19
      expect(userBResult.remaining).toBe(19);
    });

    it("returns a future reset time for new requests", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await checkRateLimit(request, "user:reset-test");

      expect(result.reset).toBeGreaterThan(Date.now());
    });

    it("uses stricter limit (2) for /api/auth/callback/credentials", async () => {
      const request = new Request("http://localhost/api/auth/callback/credentials");

      const r1 = await checkRateLimit(request, "user:strict");
      expect(r1.limit).toBe(2);
      expect(r1.remaining).toBe(1);
    });

    it("prevents at least one request even under strictest limits", async () => {
      const request = new Request("http://localhost/api/auth/register");
      const result = await checkRateLimit(request, "user:register-test");

      expect(result.limit).toBe(1);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  // ============================================
  // withRateLimit
  // ============================================

  describe("withRateLimit middleware", () => {
    it("returns null when under the rate limit", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await withRateLimit(request);
      expect(result).toBeNull();
    });

    it("returns null when passing explicit userId within limits", async () => {
      const request = new Request("http://localhost/api/agents");
      const result = await withRateLimit(request, { userId: "specific-user" });
      expect(result).toBeNull();
    });

    it("returns a 429 Response when rate limit is exceeded", async () => {
      const request = new Request("http://localhost/api/auth/callback/credentials");

      // Exhaust the limit (2)
      for (let i = 0; i < 2; i++) {
        await withRateLimit(request, { userId: "blocked-user" });
      }

      // 3rd call should be blocked
      const blocked = await withRateLimit(request, { userId: "blocked-user" });
      expect(blocked).not.toBeNull();
      expect(blocked?.status).toBe(429);

      const body = await blocked?.json();
      expect(body.error).toBe("Too Many Requests");
      expect(body.message).toContain("Rate limit exceeded");

      // Check rate limit headers
      expect(blocked?.headers.get("X-RateLimit-Limit")).toBe("2");
      expect(blocked?.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(blocked?.headers.get("Retry-After")).toBeTruthy();
      expect(blocked?.headers.get("Content-Type")).toBe("application/json");
    });

    it("does not rate limit different users independently", async () => {
      const request = new Request("http://localhost/api/auth/callback/credentials");

      // Exhaust for user-1
      for (let i = 0; i < 2; i++) {
        await withRateLimit(request, { userId: "user-1" });
      }

      // user-1 should be blocked
      const blockedUser1 = await withRateLimit(request, { userId: "user-1" });
      expect(blockedUser1?.status).toBe(429);

      // user-2 should still have capacity
      const okUser2 = await withRateLimit(request, { userId: "user-2" });
      expect(okUser2).toBeNull();
    });
  });

  // ============================================
  // clearStore
  // ============================================

  describe("clearStore", () => {
    it("resets the rate limit state", async () => {
      const request = new Request("http://localhost/api/auth/callback/credentials");

      // Exhaust the limit
      await checkRateLimit(request, "user:clear-test");
      await checkRateLimit(request, "user:clear-test");
      const beforeClear = await checkRateLimit(request, "user:clear-test");
      expect(beforeClear.success).toBe(false);

      // Clear the store
      clearStore();

      // Now it should allow requests again
      const afterClear = await checkRateLimit(request, "user:clear-test");
      expect(afterClear.success).toBe(true);
      expect(afterClear.remaining).toBe(1);
    });
  });
});
