/**
 * Tests for LLM Rate Limiter & Quota
 *
 * Verifies:
 * - Free user under limit
 * - Free user at limit
 * - Increment usage
 * - TTL / window expiry
 * - In-memory fallback
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks (must use vi.hoisted for hoisted code) ──────

const { mockGetRedis } = vi.hoisted(() => ({
  mockGetRedis: vi.fn(),
}));

vi.mock("@/lib/infrastructure/rate-limit-redis", () => ({
  getRedis: mockGetRedis,
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ ownedTeams: [] }),
    },
  },
}));

vi.mock("@/lib/entitlements/repository", () => ({
  getEntitlementRepository: vi.fn().mockReturnValue({
    getSubscription: vi.fn().mockResolvedValue(null),
  }),
}));

// ── Imports (after mocks) ──────────────────────────────────────

import { checkGenerationQuota, incrementGenerationUsage, resetQuotaStore } from "../rate-limiter";

describe("LLM Rate Limiter — checkGenerationQuota", () => {
  const userId = "test-user-id";

  beforeEach(() => {
    vi.clearAllMocks();
    resetQuotaStore();
    mockGetRedis.mockReturnValue(null); // Force in-memory by default
  });

  describe("free user (default)", () => {
    it("should allow generation when under 50/day limit", async () => {
      const quota = await checkGenerationQuota(userId);

      expect(quota.allowed).toBe(true);
      expect(quota.used).toBe(0);
      expect(quota.limit).toBe(50);
      expect(quota.remaining).toBe(50);
    });

    it("should block generation when at limit", async () => {
      await incrementGenerationUsage(userId, 50);

      const quota = await checkGenerationQuota(userId);

      expect(quota.allowed).toBe(false);
      expect(quota.used).toBe(50);
      expect(quota.remaining).toBe(0);
    });

    it("should allow generation when under limit after partial usage", async () => {
      await incrementGenerationUsage(userId, 10);

      const quota = await checkGenerationQuota(userId);

      expect(quota.allowed).toBe(true);
      expect(quota.used).toBe(10);
      expect(quota.remaining).toBe(40);
    });
  });

  describe("increment", () => {
    it("should increment usage by specified count", async () => {
      await incrementGenerationUsage(userId, 3);
      await incrementGenerationUsage(userId, 2);

      const quota = await checkGenerationQuota(userId);

      expect(quota.used).toBe(5);
      expect(quota.remaining).toBe(45);
    });

    it("should default to increment by 1", async () => {
      await incrementGenerationUsage(userId);

      const quota = await checkGenerationQuota(userId);
      expect(quota.used).toBe(1);
    });
  });

  describe("window expiry", () => {
    it("should reset usage after window expires", async () => {
      await incrementGenerationUsage(userId, 10);
      let quota = await checkGenerationQuota(userId);
      expect(quota.used).toBe(10);

      // Simulate window expiry by resetting the store
      resetQuotaStore();

      quota = await checkGenerationQuota(userId);
      expect(quota.used).toBe(0);
      expect(quota.remaining).toBe(50);
    });
  });

  describe("in-memory fallback", () => {
    it("should work with in-memory fallback when Redis is unavailable", async () => {
      mockGetRedis.mockReturnValue(null);

      await incrementGenerationUsage(userId, 5);

      const quota = await checkGenerationQuota(userId);
      expect(quota.used).toBe(5);
      expect(quota.limit).toBe(50);
    });

    it("should handle full quota on in-memory fallback", async () => {
      mockGetRedis.mockReturnValue(null);

      for (let i = 0; i < 50; i++) {
        await incrementGenerationUsage(userId);
      }

      const quota = await checkGenerationQuota(userId);
      expect(quota.allowed).toBe(false);
      expect(quota.remaining).toBe(0);
    });
  });
});
