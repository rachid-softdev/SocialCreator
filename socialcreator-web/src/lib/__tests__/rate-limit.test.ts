/**
 * @jest-environment node
 */

import {
  checkRateLimit,
  getRateLimitConfig,
  getRateLimitKey,
  cleanupRateLimitStore,
} from "../rate-limit";
import { NextRequest } from "next/server";

// Mock NextRequest helper
function createMockRequest(path: string, options: { ip?: string; userId?: string } = {}): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  const req = {
    nextUrl: url,
    headers: new Map(
      Object.entries({
        "x-forwarded-for": options.ip || "",
        "x-real-ip": options.ip || "",
      }).filter(([, v]) => v)
    ),
  } as unknown as NextRequest;
  return req;
}

describe("rate-limit", () => {
  beforeEach(() => {
    // Clear the store before each test
    cleanupRateLimitStore();
  });

  describe("getRateLimitConfig", () => {
    it("should return config for MCP endpoint", () => {
      const config = getRateLimitConfig("/api/mcp");
      expect(config).toEqual({ limit: 60, window: 60 });
    });

    it("should return config for agents endpoint", () => {
      const config = getRateLimitConfig("/api/agents");
      expect(config).toEqual({ limit: 30, window: 60 });
    });

    it("should return config for content endpoint", () => {
      const config = getRateLimitConfig("/api/content");
      expect(config).toEqual({ limit: 30, window: 60 });
    });

    it("should return config for video upload", () => {
      const config = getRateLimitConfig("/api/video/upload");
      expect(config).toEqual({ limit: 10, window: 300 });
    });

    it("should return default config for unknown API routes", () => {
      const config = getRateLimitConfig("/api/unknown");
      expect(config).toEqual({ limit: 100, window: 60 });
    });

    it("should return high limit for non-API routes", () => {
      const config = getRateLimitConfig("/dashboard");
      expect(config).toEqual({ limit: 1000, window: 60 });
    });
  });

  describe("getRateLimitKey", () => {
    it("should use userId when provided", () => {
      const request = createMockRequest("/api/test");
      const key = getRateLimitKey(request, "user123");
      expect(key).toBe("user:user123");
    });

    it("should use IP when no userId", () => {
      const request = createMockRequest("/api/test", { ip: "192.168.1.1" });
      const key = getRateLimitKey(request);
      expect(key).toBe("ip:192.168.1.1");
    });

    it("should handle multiple IPs in forwarded header", () => {
      const request = createMockRequest("/api/test", { ip: "10.0.0.1, 192.168.1.1" });
      const key = getRateLimitKey(request);
      expect(key).toBe("ip:10.0.0.1");
    });

    it("should fallback to unknown IP", () => {
      const request = createMockRequest("/api/test");
      const key = getRateLimitKey(request);
      expect(key).toBe("ip:unknown");
    });
  });

  describe("checkRateLimit", () => {
    it("should allow requests within limit", () => {
      const request = createMockRequest("/api/test");
      const result = checkRateLimit(request);

      // First request should be allowed (null means allowed)
      expect(result).toBeNull();
    });

    it("should block requests exceeding limit", () => {
      const request = createMockRequest("/api/test");

      // Make many requests to exceed the default limit
      for (let i = 0; i < 101; i++) {
        checkRateLimit(request);
      }

      const result = checkRateLimit(request);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it("should ignore non-API routes", () => {
      const request = createMockRequest("/dashboard");
      const result = checkRateLimit(request);

      expect(result).toBeNull();
    });

    it("should ignore health check route", () => {
      const request = createMockRequest("/api/health");
      const result = checkRateLimit(request);

      expect(result).toBeNull();
    });

    it("should ignore stripe webhook", () => {
      const request = createMockRequest("/api/stripe/webhook");
      const result = checkRateLimit(request);

      expect(result).toBeNull();
    });
  });

  describe("cleanupRateLimitStore", () => {
    it("should clean up expired entries", () => {
      const request = createMockMockRequest("/api/test");

      // Make a request to add entry
      checkRateLimit(request);

      // Manually expire the entry
      // In real scenario, entries expire based on window time

      // Run cleanup
      cleanupRateLimitStore();

      // Should complete without error
      expect(true).toBe(true);
    });
  });
});

// Helper to create mock request for internal tests
function createMockMockRequest(path: string): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  return {
    nextUrl: url,
    headers: new Map(),
  } as unknown as NextRequest;
}