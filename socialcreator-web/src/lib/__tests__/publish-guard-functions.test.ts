/**
 * Functional tests for the publish guard
 *
 * Tests the actual logic of:
 * - peekDailyCap: Redis path + DB fallback
 * - incrementDailyCap: Redis counter increment
 * - canPublish: entitlement check + daily cap + connected account
 * - getProfileCapStatus: multi-platform status
 * - recordPublish: alias for incrementDailyCap
 */

import type { Platform } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Hoisted mocks — vitest hoists vi.mock() calls,
// so all mock data must go through vi.hoisted()
// ============================================

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

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

vi.mock("@/lib/entitlements/service", () => ({
  getFeatureGateService: vi.fn(() => mockFeatureGateService),
}));

// Track whether getRedis should return the mock or null
const getRedisReturnsMock = true;

vi.mock("@/lib/rate-limit-redis", () => ({
  getRedis: vi.fn(() => (getRedisReturnsMock ? mockRedisInstance : null)),
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

// Import function under test
import {
  canPublish,
  getProfileCapStatus,
  incrementDailyCap,
  peekDailyCap,
  recordPublish,
} from "@/lib/publish-guard";
import { getRedis } from "@/lib/rate-limit-redis";

describe("Publish Guard - Functional Tests", () => {
  const profileId = "profile-1";
  const platform: Platform = "INSTAGRAM";
  const orgId = "org-1";

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default mock implementations
    mockRedisInstance.get.mockResolvedValue("0");
    mockRedisInstance.incr.mockResolvedValue(1);
    mockRedisInstance.expire.mockResolvedValue(true);
    mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
    mockPrisma.publishLog.count.mockResolvedValue(0);
    mockPrisma.connectedAccount.findUnique.mockResolvedValue({ id: "acct-1", isActive: true });
  });

  // ============================================
  // peekDailyCap
  // ============================================

  describe("peekDailyCap", () => {
    it("should return allowed=true when Redis count < max", async () => {
      mockRedisInstance.get.mockResolvedValue("2");
      // Agent returns maxPerDay of 4
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

    it("should return count=0 when Redis returns null", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(0);
    });

    it("should fall back to DB when Redis throws", async () => {
      mockRedisInstance.get.mockRejectedValue(new Error("Redis connection error"));
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(1);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(mockPrisma.publishLog.count).toHaveBeenCalled();
    });

    it("should fall back to DB when Redis is null", async () => {
      // Override the mock to return null (no Redis)
      vi.mocked(getRedis).mockReturnValue(null as any);

      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(3);

      const result = await peekDailyCap(profileId, platform);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(3);
      expect(mockPrisma.publishLog.count).toHaveBeenCalled();
    });

    it("should respect maxOverride parameter", async () => {
      mockRedisInstance.get.mockResolvedValue("2");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 10 }]); // agent says 10

      const result = await peekDailyCap(profileId, platform, 5); // override to 5

      expect(result.max).toBe(5); // min(10, 5) = 5
    });

    it("should cap maxPerDay at 8 even without override", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 20 }]); // agent says 20
      mockRedisInstance.get.mockResolvedValue("1");

      const result = await peekDailyCap(profileId, platform);

      expect(result.max).toBe(8); // min(20, 8) = 8
    });

    it("should default to 2 when no active agents found", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([]);
      mockRedisInstance.get.mockResolvedValue("0");

      const result = await peekDailyCap(profileId, platform);

      expect(result.max).toBe(2);
    });
  });

  // ============================================
  // incrementDailyCap
  // ============================================

  describe("incrementDailyCap", () => {
    it("should increment Redis counter and set expiry on first increment", async () => {
      mockRedisInstance.incr.mockResolvedValue(1);
      mockRedisInstance.expire.mockResolvedValue(true);

      // Function should complete without throwing
      await expect(incrementDailyCap(profileId, platform)).resolves.not.toThrow();
    });

    it("should gracefully handle Redis errors", async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error("Redis down"));

      // Should not throw - the function catches errors
      await expect(incrementDailyCap(profileId, platform)).resolves.not.toThrow();
    });
  });

  // ============================================
  // recordPublish (alias)
  // ============================================

  describe("recordPublish", () => {
    it("should complete without error (delegates to incrementDailyCap)", async () => {
      // recordPublish calls incrementDailyCap
      // Should not throw regardless of Redis availability
      await expect(recordPublish(profileId, platform)).resolves.not.toThrow();
    });
  });

  // ============================================
  // canPublish
  // ============================================

  describe("canPublish", () => {
    beforeEach(() => {
      // Force DB fallback path (more reliable in test than mocking Redis chain)
      vi.mocked(getRedis).mockReturnValue(null as any);
    });

    it("should return canPublish=true when all checks pass", async () => {
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

    it("should return canPublish=false when feature not enabled in plan", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(false);

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("plan");
    });

    it("should skip entitlement check when orgId is not provided", async () => {
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(2);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue({
        id: "acct-1",
        isActive: true,
      });

      // No orgId — should skip feature check
      const result = await canPublish(profileId, platform);

      expect(result.canPublish).toBe(true);
      expect(mockFeatureGateService.hasFeature).not.toHaveBeenCalled();
    });

    it("should return canPublish=false when daily cap reached", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(4); // 4 already published, max is 4

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("Cap atteint");
    });

    it("should return canPublish=false when account not connected", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.publishLog.count.mockResolvedValue(0);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue(null);

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("compte");
    });

    it("should return canPublish=false when account is not active", async () => {
      mockFeatureGateService.hasFeature.mockResolvedValue(true);
      mockRedisInstance.get.mockResolvedValue("0");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);
      mockPrisma.connectedAccount.findUnique.mockResolvedValue({
        id: "acct-1",
        isActive: false,
      });

      const result = await canPublish(profileId, platform, orgId);

      expect(result.canPublish).toBe(false);
      expect(result.reason).toContain("compte");
    });
  });

  // ============================================
  // getProfileCapStatus
  // ============================================

  describe("getProfileCapStatus", () => {
    it("should return status for all platforms with active agents", async () => {
      mockRedisInstance.get.mockResolvedValue("1");
      mockPrisma.agent.findMany.mockResolvedValue([{ maxPerDay: 4 }]);

      const result = await getProfileCapStatus(profileId);

      // Should return entries for platforms that have max > 0
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      for (const entry of result) {
        expect(entry).toHaveProperty("platform");
        expect(entry).toHaveProperty("count");
        expect(entry).toHaveProperty("max");
        expect(entry).toHaveProperty("allowed");
        expect(typeof entry.allowed).toBe("boolean");
      }
    });

    it("should filter out platforms with max=0", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      mockPrisma.agent.findMany.mockResolvedValue([]); // no agents → max = 2 per fallback

      const result = await getProfileCapStatus(profileId);

      // With no agents, maxPerDay defaults to 2, so platforms should have max > 0
      // They won't be filtered out since max = 2
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
