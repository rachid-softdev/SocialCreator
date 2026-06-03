/**
 * Tests for health check (Sprint 8: Observability)
 *
 * Verifies database and Redis health checks, response schema,
 * and environment-dependent behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mocks for prisma and redis
const mockQueryRaw = vi.fn();
const mockPing = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({ ping: mockPing })),
}));

describe("observability/health", () => {
  beforeEach(() => {
    vi.resetModules();
    mockQueryRaw.mockReset();
    mockPing.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getHealth", () => {
    it("returns healthy when DB and Redis respond OK", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
      mockQueryRaw.mockResolvedValue([[1]]);
      mockPing.mockResolvedValue("PONG");

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(result.status).toBe("healthy");
      expect(result.checks.database).toBe("ok");
      expect(result.checks.redis).toBe("ok");
    });

    it("returns unhealthy when DB fails", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
      mockQueryRaw.mockRejectedValue(new Error("DB connection failed"));
      mockPing.mockResolvedValue("PONG");

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(result.status).toBe("unhealthy");
      expect(result.checks.database).toBe("failed");
      expect(result.checks.redis).toBe("ok");
    });

    it('returns redis: "skipped" when UPSTASH_REDIS_REST_URL is not set', async () => {
      // Ensure UPSTASH env vars are cleared
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      mockQueryRaw.mockResolvedValue([[1]]);

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(result.status).toBe("healthy");
      expect(result.checks.database).toBe("ok");
      expect(result.checks.redis).toBe("skipped");
    });

    it("returns unhealthy when both DB and Redis fail", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
      mockQueryRaw.mockRejectedValue(new Error("DB error"));
      mockPing.mockRejectedValue(new Error("Redis error"));

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(result.status).toBe("unhealthy");
      expect(result.checks.database).toBe("failed");
      expect(result.checks.redis).toBe("failed");
    });
  });

  describe("response schema", () => {
    it("includes all required fields", async () => {
      mockQueryRaw.mockResolvedValue([[1]]);

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("uptime");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("revision");
      expect(result).toHaveProperty("responseTimeMs");
      expect(result).toHaveProperty("checks");
      expect(result.checks).toHaveProperty("database");
      expect(result.checks).toHaveProperty("redis");
    });

    it("has string version and revision", async () => {
      mockQueryRaw.mockResolvedValue([[1]]);

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(typeof result.version).toBe("string");
      expect(result.version.length).toBeGreaterThan(0);
      expect(typeof result.revision).toBe("string");
    });

    it("has non-negative uptime number", async () => {
      mockQueryRaw.mockResolvedValue([[1]]);

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(typeof result.uptime).toBe("number");
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it("has valid ISO timestamp", async () => {
      mockQueryRaw.mockResolvedValue([[1]]);

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it("has non-negative responseTimeMs", async () => {
      mockQueryRaw.mockResolvedValue([[1]]);

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(typeof result.responseTimeMs).toBe("number");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("error resilience", () => {
    it("still returns valid response even when DB throws", async () => {
      mockQueryRaw.mockRejectedValue(new Error("timeout"));

      const { getHealth } = await import("../health");
      const result = await getHealth();

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("checks");
      expect(result.checks.database).toBe("failed");
    });
  });
});
