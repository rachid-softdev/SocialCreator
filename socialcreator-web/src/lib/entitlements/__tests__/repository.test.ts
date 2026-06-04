/**
 * Feature Flags & Entitlements - Repository Tests
 * Prisma-based repository with CRUD operations and cache coordination
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mock: Cache
// ============================================

const mockCacheService = {
  invalidate: vi.fn().mockResolvedValue(undefined),
  publishInvalidation: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/entitlements/cache", () => ({
  cacheService: mockCacheService,
  getEntitlementsCacheKey: vi.fn((key: string) => `entitlements:${key}`),
}));

// ============================================
// Mock: Logger
// ============================================

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ============================================
// Mock: Prisma
// ============================================

interface MockTx {
  usageTracking: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
}

let txMock: MockTx;

const mockPrisma = {
  plan: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  feature: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  entitlementOverride: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findUnique: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  usageTracking: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  experiment: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: MockTx) => unknown) => cb(txMock)),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ============================================
// Tests
// ============================================

describe("PrismaEntitlementRepository", () => {
  let repo: import("../repository").PrismaEntitlementRepository;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    txMock = {
      usageTracking: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    // Re-import to get fresh instance with mocks
    const { PrismaEntitlementRepository } = await import("../repository");
    repo = new PrismaEntitlementRepository();
  });

  // ============================================
  // getPlanFeatures
  // ============================================

  describe("getPlanFeatures", () => {
    it("should return mapped features for a plan", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        key: "pro",
        name: "Pro Plan",
        isActive: true,
        planFeatures: [
          {
            enabled: true,
            limitValue: 100,
            configJson: { downgradeStrategy: "graceful" },
            feature: {
              key: "AI_GENERATIONS",
              name: "AI Generations",
              type: "LIMIT",
              defaultConfig: { defaultLimit: 0 },
              isActive: true,
            },
          },
          {
            enabled: true,
            limitValue: null,
            configJson: {},
            feature: {
              key: "EXPORT_PDF",
              name: "PDF Export",
              type: "BOOLEAN",
              defaultConfig: {},
              isActive: true,
            },
          },
        ],
      });

      const features = await repo.getPlanFeatures("pro");

      expect(features.size).toBe(2);
      expect(features.get("AI_GENERATIONS")).toMatchObject({
        enabled: true,
        limitValue: 100,
        downgradeStrategy: "graceful",
      });
      expect(features.get("EXPORT_PDF")).toMatchObject({
        enabled: true,
        limitValue: null,
      });
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { key: "pro" },
        include: { planFeatures: { include: { feature: true } } },
      });
    });

    it("should return empty map when plan not found", async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      const features = await repo.getPlanFeatures("nonexistent");
      expect(features.size).toBe(0);
    });
  });

  // ============================================
  // getFeature
  // ============================================

  describe("getFeature", () => {
    it("should return feature when found", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue({
        key: "EXPORT_PDF",
        name: "PDF Export",
        description: "Export reports as PDF",
        type: "BOOLEAN",
        defaultConfig: {},
        isActive: true,
      });

      const feature = await repo.getFeature("EXPORT_PDF");
      expect(feature).not.toBeNull();
      expect(feature?.key).toBe("EXPORT_PDF");
      expect(feature?.type).toBe("BOOLEAN");
      expect(feature?.description).toBe("Export reports as PDF");
    });

    it("should return null when feature not found", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue(null);

      const feature = await repo.getFeature("nonexistent");
      expect(feature).toBeNull();
    });
  });

  // ============================================
  // getAllFeatures
  // ============================================

  describe("getAllFeatures", () => {
    it("should return all active features", async () => {
      mockPrisma.feature.findMany.mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          description: null,
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
        {
          key: "AI_GENERATIONS",
          name: "AI Generations",
          description: "AI generation quota",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 10 },
          isActive: true,
        },
      ]);

      const features = await repo.getAllFeatures();
      expect(features).toHaveLength(2);
      expect(features[0].key).toBe("EXPORT_PDF");
      expect(features[1].type).toBe("LIMIT");

      expect(mockPrisma.feature.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it("should return empty array when no active features", async () => {
      mockPrisma.feature.findMany.mockResolvedValue([]);

      const features = await repo.getAllFeatures();
      expect(features).toEqual([]);
    });
  });

  // ============================================
  // getUserOverride / getOrgOverride
  // ============================================

  describe("getUserOverride", () => {
    it("should return non-expired user override", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue({
        enabled: true,
        limitValue: 50,
        expiresAt: null,
        createdAt: new Date(),
        scope: "USER",
        scopeId: "user-1",
        featureKey: "AI_GENERATIONS",
        reason: "User grant",
        orgId: null,
        id: "override-1",
      });

      const result = await repo.getUserOverride("user-1", "AI_GENERATIONS");
      expect(result).not.toBeNull();
      expect(result?.enabled).toBe(true);
      expect(result?.limit).toBe(50);

      expect(mockPrisma.entitlementOverride.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scope: "USER",
            scopeId: "user-1",
            featureKey: "AI_GENERATIONS",
          }),
        }),
      );
    });

    it("should return null when no override exists", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue(null);

      const result = await repo.getUserOverride("user-1", "NONEXISTENT");
      expect(result).toBeNull();
    });
  });

  describe("getOrgOverride", () => {
    it("should return non-expired org override with expiresAt", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue({
        enabled: true,
        limitValue: 200,
        expiresAt: futureDate,
        createdAt: new Date(),
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "EXPORT_PDF",
        reason: "Org override",
        orgId: "org-1",
        id: "override-2",
      });

      const result = await repo.getOrgOverride("org-1", "EXPORT_PDF");
      expect(result).not.toBeNull();
      expect(result?.enabled).toBe(true);
      expect(result?.limit).toBe(200);
      expect(result?.expiresAt).toEqual(futureDate);
    });

    it("should return null for expired override (repository filters by expiresAt > now)", async () => {
      mockPrisma.entitlementOverride.findFirst.mockResolvedValue(null);

      const result = await repo.getOrgOverride("org-1", "EXPIRED_FEATURE");
      expect(result).toBeNull();
    });
  });

  // ============================================
  // createOverride
  // ============================================

  describe("createOverride", () => {
    it("should create override in DB and invalidate cache for ORG scope", async () => {
      mockPrisma.entitlementOverride.create.mockResolvedValue({
        id: "new-override",
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "AI_GENERATIONS",
        enabled: true,
        limitValue: 500,
        expiresAt: null,
        reason: "Admin grant",
        orgId: "org-1",
      });

      await repo.createOverride({
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "AI_GENERATIONS",
        enabled: true,
        limitValue: 500,
        reason: "Admin grant",
      });

      expect(mockPrisma.entitlementOverride.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scope: "ORG",
          scopeId: "org-1",
          featureKey: "AI_GENERATIONS",
          enabled: true,
          limitValue: 500,
          reason: "Admin grant",
          orgId: "org-1",
        }),
      });

      // Cache invalidation for ORG scope
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-1");
      expect(mockCacheService.publishInvalidation).toHaveBeenCalledWith("org-1");
    });

    it("should NOT invalidate cache for USER scope", async () => {
      mockPrisma.entitlementOverride.create.mockResolvedValue({
        id: "user-override",
        scope: "USER",
        scopeId: "user-1",
        featureKey: "EXPORT_PDF",
        enabled: true,
        limitValue: null,
        expiresAt: null,
        reason: "User-specific",
        orgId: null,
      });

      await repo.createOverride({
        scope: "USER",
        scopeId: "user-1",
        featureKey: "EXPORT_PDF",
        enabled: true,
        reason: "User-specific",
      });

      expect(mockPrisma.entitlementOverride.create).toHaveBeenCalled();
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
      expect(mockCacheService.publishInvalidation).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // deleteOverride
  // ============================================

  describe("deleteOverride", () => {
    it("should delete override and invalidate cache for ORG scope", async () => {
      mockPrisma.entitlementOverride.findUnique.mockResolvedValue({
        id: "override-to-delete",
        scope: "ORG",
        scopeId: "org-1",
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        enabled: true,
        limitValue: 500,
        expiresAt: null,
        reason: "Admin grant",
        createdAt: new Date(),
      });
      mockPrisma.entitlementOverride.delete.mockResolvedValue({});

      await repo.deleteOverride("override-to-delete");

      expect(mockPrisma.entitlementOverride.findUnique).toHaveBeenCalledWith({
        where: { id: "override-to-delete" },
      });
      expect(mockPrisma.entitlementOverride.delete).toHaveBeenCalledWith({
        where: { id: "override-to-delete" },
      });
      expect(mockCacheService.invalidate).toHaveBeenCalledWith("entitlements:org-1");
      expect(mockCacheService.publishInvalidation).toHaveBeenCalledWith("org-1");
    });

    it("should handle deletion of USER-scoped override gracefully", async () => {
      mockPrisma.entitlementOverride.findUnique.mockResolvedValue({
        id: "user-ov",
        scope: "USER",
        scopeId: "user-1",
        orgId: null,
        featureKey: "EXPORT_PDF",
        enabled: true,
        limitValue: null,
        expiresAt: null,
        reason: "User test",
        createdAt: new Date(),
      });
      mockPrisma.entitlementOverride.delete.mockResolvedValue({});

      await repo.deleteOverride("user-ov");

      // No cache invalidation for USER scope
      expect(mockCacheService.invalidate).not.toHaveBeenCalled();
      expect(mockCacheService.publishInvalidation).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // getSubscription
  // ============================================

  describe("getSubscription", () => {
    it("should return subscription for org", async () => {
      const periodEnd = new Date(Date.now() + 86400000 * 30);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        orgId: "org-1",
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      const sub = await repo.getSubscription("org-1");
      expect(sub).not.toBeNull();
      expect(sub?.planKey).toBe("pro");
      expect(sub?.status).toBe("ACTIVE");
      expect(sub?.currentPeriodEnd).toEqual(periodEnd);
      expect(sub?.cancelAtPeriodEnd).toBe(false);
    });

    it("should return null when no subscription exists", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const sub = await repo.getSubscription("org-none");
      expect(sub).toBeNull();
    });
  });

  // ============================================
  // getUsage
  // ============================================

  describe("getUsage", () => {
    it("should return usage count for a period", async () => {
      const periodStart = new Date("2025-01-01");
      mockPrisma.usageTracking.findUnique.mockResolvedValue({
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        periodStart,
        usageCount: 42,
      });

      const usage = await repo.getUsage("org-1", "AI_GENERATIONS", periodStart);
      expect(usage).toBe(42);

      expect(mockPrisma.usageTracking.findUnique).toHaveBeenCalledWith({
        where: {
          orgId_featureKey_periodStart: {
            orgId: "org-1",
            featureKey: "AI_GENERATIONS",
            periodStart,
          },
        },
      });
    });

    it("should return 0 when no tracking record exists", async () => {
      mockPrisma.usageTracking.findUnique.mockResolvedValue(null);

      const usage = await repo.getUsage("org-1", "AI_GENERATIONS", new Date());
      expect(usage).toBe(0);
    });
  });

  // ============================================
  // getCurrentPeriodUsage
  // ============================================

  describe("getCurrentPeriodUsage", () => {
    it("should return usage with calculated period boundaries", async () => {
      // Use a fixed date for deterministic testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

      mockPrisma.usageTracking.findUnique.mockResolvedValue({
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        periodStart: new Date("2025-06-01T00:00:00.000Z"),
        usageCount: 15,
      });

      const result = await repo.getCurrentPeriodUsage("org-1", "AI_GENERATIONS");

      expect(result.used).toBe(15);
      // Period should be current month (June 2025)
      expect(result.periodStart.getMonth()).toBe(5); // 0-indexed: June = 5
      expect(result.periodStart.getFullYear()).toBe(2025);

      // periodEnd should be last day of current month
      expect(result.periodEnd.getMonth()).toBe(5);
      expect(result.periodEnd.getDate()).toBe(30); // June has 30 days

      vi.useRealTimers();
    });

    it("should return 0 when no usage record exists", async () => {
      mockPrisma.usageTracking.findUnique.mockResolvedValue(null);

      const result = await repo.getCurrentPeriodUsage("org-1", "NEW_FEATURE");
      expect(result.used).toBe(0);
    });
  });

  // ============================================
  // consumeUsage
  // ============================================

  describe("consumeUsage", () => {
    const periodStart = new Date("2025-06-01");
    const periodEnd = new Date("2025-06-30T23:59:59.999Z");

    it("should succeed when under limit", async () => {
      txMock.usageTracking.findUnique.mockResolvedValue({
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        periodStart,
        usageCount: 5,
      });
      txMock.usageTracking.upsert.mockResolvedValue({
        usageCount: 6,
      });

      const result = await repo.consumeUsage(
        "org-1",
        "AI_GENERATIONS",
        1,
        10,
        periodStart,
        periodEnd,
      );

      expect(result.success).toBe(true);
      expect(result.currentCount).toBe(6);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should fail when over limit", async () => {
      txMock.usageTracking.findUnique.mockResolvedValue({
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        periodStart,
        usageCount: 10,
      });

      const result = await repo.consumeUsage(
        "org-1",
        "AI_GENERATIONS",
        1,
        10,
        periodStart,
        periodEnd,
      );

      expect(result.success).toBe(false);
      expect(result.currentCount).toBe(10);
      // upsert should NOT be called when over limit
      expect(txMock.usageTracking.upsert).not.toHaveBeenCalled();
    });

    it("should fail when limit is 0 and trying to consume", async () => {
      txMock.usageTracking.findUnique.mockResolvedValue({
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        periodStart,
        usageCount: 0,
      });

      const result = await repo.consumeUsage(
        "org-1",
        "AI_GENERATIONS",
        1,
        0,
        periodStart,
        periodEnd,
      );

      expect(result.success).toBe(false);
      expect(result.currentCount).toBe(0);
    });

    it("should succeed with null limit (unlimited)", async () => {
      txMock.usageTracking.findUnique.mockResolvedValue({
        orgId: "org-1",
        featureKey: "AI_GENERATIONS",
        periodStart,
        usageCount: 1000,
      });
      txMock.usageTracking.upsert.mockResolvedValue({
        usageCount: 1001,
      });

      const result = await repo.consumeUsage(
        "org-1",
        "AI_GENERATIONS",
        1,
        null,
        periodStart,
        periodEnd,
      );

      expect(result.success).toBe(true);
      expect(result.currentCount).toBe(1001);
    });

    it("should create new tracking entry on first use", async () => {
      // No existing record
      txMock.usageTracking.findUnique.mockResolvedValue(null);
      txMock.usageTracking.upsert.mockResolvedValue({
        usageCount: 1,
      });

      const result = await repo.consumeUsage(
        "org-1",
        "AI_GENERATIONS",
        1,
        10,
        periodStart,
        periodEnd,
      );

      expect(result.success).toBe(true);
      expect(result.currentCount).toBe(1);
      expect(txMock.usageTracking.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            orgId: "org-1",
            usageCount: 1,
          }),
          update: expect.objectContaining({
            usageCount: { increment: 1 },
          }),
        }),
      );
    });

    it("should handle DB error gracefully and return safe default", async () => {
      // Simulate transaction throwing (e.g. DB connection drop)
      mockPrisma.$transaction.mockRejectedValue(new Error("Connection lost"));

      const result = await repo.consumeUsage(
        "org-1",
        "AI_GENERATIONS",
        1,
        10,
        periodStart,
        periodEnd,
      );

      // Safe default: failure, 0 count
      expect(result.success).toBe(false);
      expect(result.currentCount).toBe(0);
    });
  });

  // ============================================
  // getExperiment
  // ============================================

  describe("getExperiment", () => {
    it("should return experiment config when found", async () => {
      const experimentConfig = {
        percentage: 50,
        seed: "NEW_DASHBOARD_v1",
        variantNames: ["control", "treatment"],
      };

      mockPrisma.experiment.findUnique.mockResolvedValue({
        key: "NEW_DASHBOARD",
        config: experimentConfig,
      });

      const result = await repo.getExperiment("NEW_DASHBOARD");
      expect(result).not.toBeNull();
      expect(result?.percentage).toBe(50);
      expect(result?.seed).toBe("NEW_DASHBOARD_v1");
      expect(result?.variantNames).toEqual(["control", "treatment"]);
    });

    it("should return null when experiment not found", async () => {
      mockPrisma.experiment.findUnique.mockResolvedValue(null);

      const result = await repo.getExperiment("nonexistent");
      expect(result).toBeNull();
    });
  });
});
