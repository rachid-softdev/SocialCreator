/**
 * Feature Flags & Entitlements - Downgrade Service Tests
 * SECURITY CRITICAL: Tests all three downgrade strategies
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IEntitlementRepository } from "../types";

// ============================================
// Mocks
// ============================================

const mockCacheService = {
  invalidate: vi.fn().mockResolvedValue(undefined),
  publishInvalidation: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/entitlements/cache", () => ({
  cacheService: mockCacheService,
  getEntitlementsCacheKey: vi.fn((key: string) => `entitlements:${key}`),
}));

// Closure variable for mock repository — matches existing pattern
// where vi.mock factory captures a module-scoped variable
let currentMockRepo: IEntitlementRepository;

vi.mock("@/lib/entitlements/repository", () => ({
  getEntitlementRepository: vi.fn(() => currentMockRepo),
}));

// ============================================
// Mock Repository Factory
// ============================================

const createMockRepo = (overrides: Partial<IEntitlementRepository> = {}): IEntitlementRepository =>
  ({
    getPlanFeatures: vi.fn().mockResolvedValue(new Map()),
    getPlan: vi.fn().mockResolvedValue(null),
    getFeature: vi.fn().mockResolvedValue(null),
    getAllFeatures: vi.fn().mockResolvedValue([]),
    getUserOverride: vi.fn().mockResolvedValue(null),
    getOrgOverride: vi.fn().mockResolvedValue(null),
    createOverride: vi.fn().mockResolvedValue(undefined),
    deleteOverride: vi.fn().mockResolvedValue(undefined),
    getSubscription: vi.fn().mockResolvedValue(null),
    getUsage: vi.fn().mockResolvedValue(0),
    getCurrentPeriodUsage: vi
      .fn()
      .mockResolvedValue({ used: 0, periodStart: new Date(), periodEnd: new Date() }),
    consumeUsage: vi.fn().mockResolvedValue({ success: true, currentCount: 0 }),
    getExperiment: vi.fn().mockResolvedValue(null),
    ...overrides,
  }) as IEntitlementRepository;

// ============================================
// Tests
// ============================================

describe("DowngradeService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    currentMockRepo = createMockRepo();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // previewDowngrade
  // ============================================

  describe("previewDowngrade", () => {
    it("should return empty impacts when no subscription exists", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      const impacts = await service.previewDowngrade("org-none", "pro");
      expect(impacts).toEqual([]);
      expect(currentMockRepo.getSubscription).toHaveBeenCalledWith("org-none");
    });

    it("should detect BOOLEAN feature as affected (enabled → disabled)", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "starter",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        ["EXPORT_PDF", { enabled: false, limitValue: null, configJson: {} }],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures) // current plan
        .mockResolvedValueOnce(targetFeatures); // target plan

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      const impacts = await service.previewDowngrade("org-1", "free");
      expect(impacts).toHaveLength(1);
      expect(impacts[0]!.featureKey).toBe("EXPORT_PDF");
      expect(impacts[0]!.affected).toBe(true);
      expect(impacts[0]!.currentEnabled).toBe(true);
      expect(impacts[0]!.newEnabled).toBe(false);
    });

    it("should NOT mark BOOLEAN as affected when already disabled", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "free",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const features = new Map([
        ["EXPORT_PDF", { enabled: false, limitValue: null, configJson: {} }],
      ]);
      currentMockRepo.getPlanFeatures = vi.fn().mockResolvedValue(features);
      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      const impacts = await service.previewDowngrade("org-1", "free");
      expect(impacts).toHaveLength(0);
    });

    it("should detect LIMIT feature as affected (limit decreases)", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["AI_GENERATIONS", { enabled: true, limitValue: 1000, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        ["AI_GENERATIONS", { enabled: true, limitValue: 100, configJson: {} }],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "AI_GENERATIONS",
          name: "AI Generations",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 0 },
          isActive: true,
        },
      ]);

      const impacts = await service.previewDowngrade("org-1", "starter");
      expect(impacts).toHaveLength(1);
      expect(impacts[0]!.featureKey).toBe("AI_GENERATIONS");
      expect(impacts[0]!.affected).toBe(true);
      expect(impacts[0]!.currentLimit).toBe(1000);
      expect(impacts[0]!.newLimit).toBe(100);
    });

    it("should NOT mark LIMIT as affected when current limit <= new limit", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const features = new Map([
        ["AI_GENERATIONS", { enabled: true, limitValue: 50, configJson: {} }],
      ]);
      currentMockRepo.getPlanFeatures = vi.fn().mockResolvedValue(features);
      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "AI_GENERATIONS",
          name: "AI Generations",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 0 },
          isActive: true,
        },
      ]);

      const impacts = await service.previewDowngrade("org-1", "pro");
      expect(impacts).toHaveLength(0);
    });
  });

  // ============================================
  // wouldBeAffected
  // ============================================

  describe("wouldBeAffected", () => {
    it("should return true when features would be affected", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        ["EXPORT_PDF", { enabled: false, limitValue: null, configJson: {} }],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      const result = await service.wouldBeAffected("org-1", "free");
      expect(result).toBe(true);
    });

    it("should return false when no features affected", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "free",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([]);

      const result = await service.wouldBeAffected("org-1", "free");
      expect(result).toBe(false);
    });
  });

  // ============================================
  // getAffectedFeatureCount
  // ============================================

  describe("getAffectedFeatureCount", () => {
    it("should return correct count of affected features", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
        ["AI_GENERATIONS", { enabled: true, limitValue: 1000, configJson: {} }],
        ["BASIC", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        ["EXPORT_PDF", { enabled: false, limitValue: null, configJson: {} }],
        ["AI_GENERATIONS", { enabled: true, limitValue: 100, configJson: {} }],
        ["BASIC", { enabled: true, limitValue: null, configJson: {} }],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
        {
          key: "AI_GENERATIONS",
          name: "AI Generations",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 0 },
          isActive: true,
        },
        { key: "BASIC", name: "Basic Feature", type: "BOOLEAN", defaultConfig: {}, isActive: true },
      ]);

      const count = await service.getAffectedFeatureCount("org-1", "starter");
      expect(count).toBe(2); // EXPORT_PDF (boolean) + AI_GENERATIONS (limit decrease)
    });

    it("should return 0 when no features affected", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "free",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([]);

      const count = await service.getAffectedFeatureCount("org-1", "free");
      expect(count).toBe(0);
    });
  });

  // ============================================
  // applyDowngrade — Strategy: immediate (default)
  // ============================================

  describe("applyDowngrade — immediate strategy", () => {
    it("should NOT create overrides and should invalidate cache", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        [
          "EXPORT_PDF",
          {
            enabled: false,
            limitValue: null,
            configJson: {},
            // No downgradeStrategy → defaults to "immediate"
          },
        ],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      await service.applyDowngrade("org-1", "free");

      // No override should be created for immediate
      expect(currentMockRepo.createOverride).not.toHaveBeenCalled();
      // Cache should be invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });
  });

  // ============================================
  // applyDowngrade — Strategy: graceful
  // ============================================

  describe("applyDowngrade — graceful strategy", () => {
    it("should create override with expiresAt when periodEnd is in the future", async () => {
      const futureDate = new Date(Date.now() + 86400000 * 15); // 15 days from now
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        [
          "EXPORT_PDF",
          {
            enabled: false,
            limitValue: null,
            configJson: { downgradeStrategy: "graceful" },
            downgradeStrategy: "graceful" as const,
          },
        ],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      await service.applyDowngrade("org-1", "starter");

      // Should create an override that keeps access until periodEnd
      expect(currentMockRepo.createOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "ORG",
          scopeId: "org-1",
          featureKey: "EXPORT_PDF",
          enabled: true,
          expiresAt: futureDate,
          reason: expect.stringContaining("Graceful downgrade"),
        }),
      );
      // Cache should be invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });

    it("should fall to immediate when periodEnd has already passed", async () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: pastDate,
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        [
          "EXPORT_PDF",
          {
            enabled: false,
            limitValue: null,
            configJson: { downgradeStrategy: "graceful" },
            downgradeStrategy: "graceful" as const,
          },
        ],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      await service.applyDowngrade("org-1", "starter");

      // No override should be created since the period already ended
      expect(currentMockRepo.createOverride).not.toHaveBeenCalled();
      // Cache should still be invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });
  });

  // ============================================
  // applyDowngrade — Strategy: freeze
  // ============================================

  describe("applyDowngrade — freeze strategy", () => {
    it("should create override without expiry to preserve current state", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });

      const currentFeatures = new Map([
        ["AI_GENERATIONS", { enabled: true, limitValue: 500, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        [
          "AI_GENERATIONS",
          {
            enabled: false,
            limitValue: 0,
            configJson: { downgradeStrategy: "freeze" },
            downgradeStrategy: "freeze" as const,
          },
        ],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "AI_GENERATIONS",
          name: "AI Generations",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 0 },
          isActive: true,
        },
      ]);

      await service.applyDowngrade("org-1", "starter");

      // Should create an override preserving current limit (500) without expiry
      expect(currentMockRepo.createOverride).toHaveBeenCalledWith({
        scope: "ORG",
        scopeId: "org-1",
        featureKey: "AI_GENERATIONS",
        enabled: true,
        limitValue: 500,
        reason: expect.stringContaining("Freeze"),
      });
      // Cache should be invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });
  });

  // ============================================
  // applyDowngrade — strategyOverride parameter
  // ============================================

  describe("applyDowngrade — strategyOverride", () => {
    it("should use strategyOverride when provided instead of the feature's default", async () => {
      const futureDate = new Date(Date.now() + 86400000 * 15);
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      currentMockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE",
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: false,
      });

      // Feature has "immediate" as default, but we override with "graceful"
      const currentFeatures = new Map([
        ["EXPORT_PDF", { enabled: true, limitValue: null, configJson: {} }],
      ]);
      const targetFeatures = new Map([
        [
          "EXPORT_PDF",
          {
            enabled: false,
            limitValue: null,
            configJson: {},
            // No downgradeStrategy → defaults to "immediate"
          },
        ],
      ]);

      currentMockRepo.getPlanFeatures = vi
        .fn()
        .mockResolvedValueOnce(currentFeatures)
        .mockResolvedValueOnce(targetFeatures);

      currentMockRepo.getAllFeatures = vi.fn().mockResolvedValue([
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "BOOLEAN",
          defaultConfig: {},
          isActive: true,
        },
      ]);

      await service.applyDowngrade("org-1", "starter", "graceful");

      // Should use the override strategy (graceful) and create override
      expect(currentMockRepo.createOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "ORG",
          scopeId: "org-1",
          featureKey: "EXPORT_PDF",
          enabled: true,
          expiresAt: futureDate,
        }),
      );
    });
  });

  // ============================================
  // applyDowngrade — cache invalidation always happens
  // ============================================

  describe("applyDowngrade — cache invalidation", () => {
    it("should always invalidate cache after downgrade", async () => {
      const { DowngradeService } = await import("../downgrade");
      const service = new DowngradeService();

      // No subscription → empty impacts → no created overrides
      currentMockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      await service.applyDowngrade("org-none", "pro");

      // Even with no impacts, cache should be invalidated
      expect(mockCacheService.invalidate).toHaveBeenCalled();
      expect(currentMockRepo.createOverride).not.toHaveBeenCalled();
    });
  });
});
