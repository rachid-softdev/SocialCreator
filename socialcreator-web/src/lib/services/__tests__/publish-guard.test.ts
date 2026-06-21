/**
 * Tests for publish-guard service (publish-guard.ts)
 *
 * Covers canPublish, peekDailyCap, getProfileCapStatus, incrementDailyCap, recordPublish.
 * Tests Redis path + DB fallback, entitlement checks, connected account validation.
 */

import type { Platform } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before vi.mock() calls
// ---------------------------------------------------------------------------

const { mockRedisInstance, mockPrisma, mockFeatureGateService } = vi.hoisted(() => ({
  mockRedisInstance: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    keys: vi.fn(),
    publish: vi.fn(),
  },
  mockPrisma: {
    agent: { findMany: vi.fn() },
    publishLog: { count: vi.fn() },
    connectedAccount: { findUnique: vi.fn() },
  },
  mockFeatureGateService: {
    hasFeature: vi.fn().mockResolvedValue(true),
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: vi.fn(() => mockFeatureGateService),
}));

vi.mock("@/lib/rate-limit-redis", () => ({
  getRedis: vi.fn(() => mockRedisInstance),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@socialcreator/utils", () => ({
  startOfDayUTC: (date: Date) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { getRedis } from "@/lib/rate-limit-redis";
import {
  canPublish,
  getProfileCapStatus,
  incrementDailyCap,
  peekDailyCap,
  recordPublish,
} from "@/lib/services/publish-guard";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Publish Guard", () => {
  const profileId = "profile-1";
  const platform: Platform = "INSTAGRAM";
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset getRedis to its default implementation (return mockRedisInstance)
    // This is essential because canPublish tests override it with mockReturnValue(null)
    vi.mocked(getRedis).mockImplementation(() => mockRedisInstance as any);

    // Default mock implementations
    mockRedisInstance.get.mockResolvedValue("0");
    mockRedisInstance.incr.mockResolvedValue(1);
    mockRedisInstance.expire.mockResolvedValue(true);
    mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
    mockPrisma.publishLog.count.mockResolvedValue(0);
    mockPrisma.connectedAccount.findUnique.mockResolvedValue({
      id: "acct-1",
      isActive: true,
    });
  });

  // ============================================
  // canPublish
  // ============================================

  describe("canPublish", () => {
    beforeEach(() => {
      // Force DB fallback path (more reliable than mocking Redis chain for canPublish)
      vi.mocked(getRedis).mockReturnValue(null as any);
    });

    it("should return canPublish=true when all checks pass (entitlement + cap + account)", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(2);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue({
        id: "acct-1",
        isActive: true,
      });

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should return canPublish=false when the plan lacks the entitlement feature", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(false);

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toBe("Votre plan ne permet pas la publication sur cette plateforme");
    });

    it("should skip entitlement check when orgId is not provided", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(2);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue({
        id: "acct-1",
        isActive: true,
      });

      const result = await canPublish(profileId, platform);

      expect(result.canPublish).toBe(true);
      expect(mockFeatureGateService.hasFeature).not.toHaveBeenCalled();
    });

    it("should return canPublish=false when daily cap is reached (count >= max)", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(4); // Already at max

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("Cap atteint");
      expect(result.reason).toContain("4/4");
    });

    it("should return canPublish=false when no connected account exists", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(0);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue(null);

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("compte");
    });

    it("should return canPublish=false when the connected account is inactive", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(0);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue({
        id: "acct-1",
        isActive: false,
      });

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("compte");
    });

    it("should short-circuit on entitlement failure without querying cap or account", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(false);

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      // These should NOT be called if entitlement fails
      expect(mockPrisma.publishLog.count).not.toHaveBeenCalled();
      expect(mockPrisma.connectedAccount.findUnique).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // peekDailyCap
  // ============================================

  describe("peekDailyCap", () => {
    it("should return allowed=true when Redis count is under max", async () => {
      mockRedisInstance.get.mockResolvedValue("2");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2);
      expect(result.max).toBe(4);
    });

    it("should return allowed=false when Redis count >= max", async () => {
      mockRedisInstance.get.mockResolvedValue("4");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(4);
      expect(result.max).toBe(4);
    });

    it("should return count=0 when Redis key does not exist (null)", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(0);
    });

    it("should fall back to DB when Redis throws an error", async () => {
      mockRedisInstance.get.mockRejectedValue(new Error("Redis connection error"));
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(1);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(mockPrisma.publishLog.count).toHaveBeenCalled();
    });

    it("should fall back to DB when getRedis returns null", async () => {
      vi.mocked(getRedis).mockReturnValue(null as any);

      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(3);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(3);
      expect(mockPrisma.publishLog.count).toHaveBeenCalled();
    });

    it("should respect maxOverride parameter (clamp to override)", async () => {
      mockRedisInstance.get.mockResolvedValue("2");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 10 }]);

      const result = await peekDailyCap(profileId, platform, 5); // override = 5

      expect(result.max).toBe(5); // min(10, 5)
    });

    it("should cap maxPerDay at 8 even without explicit override", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 20 }]);
      mockRedisInstance.get.mockResolvedValue("1");

      const result = await peekDailyCap(profileId, platform);

      expect(result.max).toBe(8); // min(20, 8)
    });

    it("should default to 2 when no active agents found", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([]);
      mockRedisInstance.get.mockResolvedValue("0");

      const result = await peekDailyCap(profileId, platform);

      expect(result.max).toBe(2);
      expect(result.allowed).toBe(true);
    });

    it("should prefer maxOverride even when it is lower than agent max", async () => {
      mockRedisInstance.get.mockResolvedValue("1");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await peekDailyCap(profileId, platform, 2); // override = 2

      expect(result.max).toBe(2); // min(4, 2)
    });
  });

  // ============================================
  // incrementDailyCap
  // ============================================

  describe("incrementDailyCap", () => {
    it("should increment Redis counter and set expiry on first increment", async () => {
      mockRedisInstance.incr.mockResolvedValue(1);

      await expect(incrementDailyCap(profileId, platform)).resolves.not.toThrow();

      expect(mockRedisInstance.incr).toHaveBeenCalled();
      expect(mockRedisInstance.expire).toHaveBeenCalledWith(expect.any(String), 86400);
    });

    it("should not set expiry on subsequent increments", async () => {
      mockRedisInstance.incr.mockResolvedValue(3); // Already incremented twice

      await incrementDailyCap(profileId, platform);

      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });

    it("should gracefully handle Redis errors without throwing", async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error("Redis down"));

      await expect(incrementDailyCap(profileId, platform)).resolves.not.toThrow();
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // recordPublish
  // ============================================

  describe("recordPublish", () => {
    it("should delegate to incrementDailyCap and complete without error", async () => {
      mockRedisInstance.incr.mockResolvedValue(1);

      await expect(recordPublish(profileId, platform)).resolves.not.toThrow();
      expect(mockRedisInstance.incr).toHaveBeenCalled();
    });
  });

  // ============================================
  // getProfileCapStatus
  // ============================================

  describe("getProfileCapStatus", () => {
    it("should return status for all platforms with max > 0", async () => {
      mockRedisInstance.get.mockResolvedValue("1");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await getProfileCapStatus(profileId);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      for (const entry of result) {
        expect(entry).toHaveProperty("platform");
        expect(entry).toHaveProperty("count");
        expect(entry).toHaveProperty("max");
        expect(entry).toHaveProperty("allowed");
        expect(typeof entry.allowed).toBe("boolean");
        expect(entry.max).toBeGreaterThan(0);
      }
    });

    it("should filter out platforms where max is 0", async () => {
      // Simulate max = 0 by returning agents with maxPerDay = 0
      // But the code defaults to 2 when no agents...
      // To get max = 0, we'd need maxOverride = 0 and agents with max 0
      // Actually with min(0, 0) = 0, or min(0, 8) = 0
      // Let's test the filter by having agents with max 0
      vi.mocked(getRedis).mockReturnValue(null as any);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 0 }]);
      mockPrisma.publishLog.count.mockResolvedValue(0);

      const result = await getProfileCapStatus(profileId);

      // Platforms with max = 0 should be filtered out
      const platformsWithMaxZero = result.filter((r) => r.max === 0);
      expect(platformsWithMaxZero).toHaveLength(0);
    });
  });
});
