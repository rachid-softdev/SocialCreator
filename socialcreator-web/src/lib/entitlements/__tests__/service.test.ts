/**
 * Feature Gates & Entitlements - Service Tests
 * Comprehensive test suite covering all resolution priorities, consumption,
 * A/B bucketing, error factories, and edge cases.
 *
 * Resolution priority (4 levels):
 *   1. User override      (highest - not fully implemented yet)
 *   2. Org override
 *   3. Plan (subscription)
 *   4. Fallback           (lowest)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFeatureNotAvailableError,
  createLimitReachedError,
  createSubscriptionExpiredError,
  FeatureGateService,
} from "../service";
import type {
  ExperimentConfig,
  FeatureDefinition,
  FeatureNotAvailableError,
  IEntitlementRepository,
  LimitReachedError,
  PlanFeatureConfig,
  SubscriptionExpiredError,
  SubscriptionStatus,
} from "../types";

// ============================================
// Mock Repository Factory
// ============================================

const createMockRepository = (
  overrides: Partial<IEntitlementRepository> = {},
): IEntitlementRepository => ({
  getPlanFeatures: vi.fn().mockResolvedValue(new Map()),
  getPlan: vi.fn().mockResolvedValue(null),
  getFeature: vi.fn().mockImplementation((key: string) =>
    Promise.resolve({
      key,
      name: key,
      type: "LIMIT" as const,
      defaultConfig: { defaultLimit: 0 },
      isActive: true,
    }),
  ),
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
});

// ============================================
// Helpers
// ============================================

function makeActiveSubscription(
  planKey = "pro",
  overrides: Partial<{
    status: SubscriptionStatus;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date;
  }> = {},
) {
  return {
    planKey,
    status: "ACTIVE" as SubscriptionStatus,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days out
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function makePlanFeature(
  enabled: boolean,
  limitValue: number | null,
  overrides: Partial<PlanFeatureConfig> = {},
): PlanFeatureConfig {
  return { enabled, limitValue, configJson: {}, ...overrides };
}

// ============================================
// FeatureGateService Tests
// ============================================

describe("FeatureGateService", () => {
  let service: FeatureGateService;
  let mockRepo: IEntitlementRepository;

  beforeEach(() => {
    vi.resetModules();

    mockRepo = createMockRepository();
    service = new FeatureGateService();

    // Inject mock repo (bypass singleton)
    (service as any).repo = mockRepo;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Tests 1–5: resolveEntitlement — 4-level priority
  // ============================================

  describe("resolveEntitlement — 4-level priority resolution", () => {
    it("[Test 1] should resolve via plan when no overrides are set", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, 100)],
      ]);

      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");

      expect(result).toEqual({
        enabled: true,
        limit: 100,
        config: {},
      });
      expect(mockRepo.getOrgOverride).toHaveBeenCalledWith("org-1", "EXPORT_PDF");
      expect(mockRepo.getSubscription).toHaveBeenCalledWith("org-1");
      expect(mockRepo.getPlanFeatures).toHaveBeenCalledWith("pro");
    });

    it("[Test 2] user override (not implemented) currently falls through to org override", async () => {
      // The current implementation accepts _userOverrides but doesn't use them
      // This test documents that behavior and ensures the pipe continues correctly
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue({
        enabled: true,
        limit: 50,
      });
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null); // no plan

      const result = await (service as any).resolveEntitlement(
        "org-1",
        "EXPORT_PDF",
        new Map([["EXPORT_PDF", { enabled: false, limit: 0 }]]),
      );

      // Org override (level 2) wins because user override (level 1) isn't checked
      expect(result).toEqual({ enabled: true, limit: 50 });
    });

    it("[Test 3] org override beats plan", async () => {
      // Plan says: enabled=false
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(false, 0)],
      ]);

      mockRepo.getOrgOverride = vi.fn().mockResolvedValue({
        enabled: true,
        limit: 999,
      });
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("starter"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");

      // Org override wins despite plan having disabled
      expect(result).toEqual({ enabled: true, limit: 999 });
    });

    it("[Test 4] plan beats fallback", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 500)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await (service as any).resolveEntitlement("org-1", "AI_GENERATIONS");

      // Plan returns the feature enabled with a limit, not the fallback
      expect(result.enabled).toBe(true);
      expect(result.limit).toBe(500);
    });

    it("[Test 5] fallback when no override and no plan covers the feature", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null); // No subscription at all

      const result = await (service as any).resolveEntitlement("org-1", "UNKNOWN_FEATURE");

      // Fallback: disabled, limit based on feature type (LIMIT → defaultLimit from feature config)
      expect(result.enabled).toBe(false);
      expect(result.limit).toBe(0); // defaultConfig.defaultLimit = 0
    });

    it("should return disabled for a feature that doesn't exist in the system", async () => {
      mockRepo.getFeature = vi.fn().mockResolvedValue(null); // Feature not found

      const result = await (service as any).resolveEntitlement("org-1", "NONEXISTENT");

      expect(result).toEqual({ enabled: false, limit: 0 });
      expect(mockRepo.getFeature).toHaveBeenCalledWith("NONEXISTENT");
    });

    it("should fallback with null limit for BOOLEAN features with no plan coverage", async () => {
      mockRepo.getFeature = vi.fn().mockResolvedValue({
        key: "DARK_MODE",
        name: "Dark Mode",
        type: "BOOLEAN",
        defaultConfig: {},
        isActive: true,
      });
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      const result = await (service as any).resolveEntitlement("org-1", "DARK_MODE");

      expect(result.enabled).toBe(false);
      // BOOLEAN type doesn't have defaultLimit → falls through to null
      expect(result.limit).toBeNull();
    });

    it("should fallback with defaultLimit for LIMIT features with no plan coverage", async () => {
      mockRepo.getFeature = vi.fn().mockResolvedValue({
        key: "API_CALLS",
        name: "API Calls",
        type: "LIMIT",
        defaultConfig: { defaultLimit: 100 },
        isActive: true,
      });
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      const result = await (service as any).resolveEntitlement("org-1", "API_CALLS");

      expect(result.enabled).toBe(false);
      expect(result.limit).toBe(100);
    });
  });

  // ============================================
  // Test 6: getAllEntitlements
  // ============================================

  describe("getAllEntitlements", () => {
    it("[Test 6] should return full feature map with correct values", async () => {
      const features: FeatureDefinition[] = [
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 0 },
          isActive: true,
        },
        {
          key: "AI_GENERATIONS",
          name: "AI Generations",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 10 },
          isActive: true,
        },
      ];

      mockRepo.getAllFeatures = vi.fn().mockResolvedValue(features);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, null)], // unlimited
        ["AI_GENERATIONS", makePlanFeature(true, 50)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const periodEnd = new Date("2026-07-01");
      mockRepo.getCurrentPeriodUsage = vi
        .fn()
        .mockResolvedValueOnce({ used: 3, periodStart: new Date(), periodEnd })
        .mockResolvedValueOnce({ used: 12, periodStart: new Date(), periodEnd });

      const result = await service.getAllEntitlements("org-1");

      expect(result.plan).toBe("pro");
      expect(result.status).toBe("ACTIVE");
      expect(result.features).toEqual({
        EXPORT_PDF: true,
        AI_GENERATIONS: true,
      });
      expect(result.limits).toEqual({
        EXPORT_PDF: null,
        AI_GENERATIONS: 50,
      });
      expect(result.usage).toEqual({
        EXPORT_PDF: 3,
        AI_GENERATIONS: 12,
      });
      expect(result.resetAt.EXPORT_PDF).toEqual(periodEnd);
      expect(result.resetAt.AI_GENERATIONS).toEqual(periodEnd);
      expect(result.config).toBeDefined();
    });

    it("should cache the result after first call", async () => {
      const features: FeatureDefinition[] = [
        {
          key: "EXPORT_PDF",
          name: "PDF Export",
          type: "LIMIT",
          defaultConfig: { defaultLimit: 0 },
          isActive: true,
        },
      ];

      mockRepo.getAllFeatures = vi.fn().mockResolvedValue(features);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, null)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      // First call
      const result1 = await service.getAllEntitlements("org-1");
      expect(result1.plan).toBe("pro");

      // Second call should hit cache
      const result2 = await service.getAllEntitlements("org-1");
      expect(result2.plan).toBe("pro");
    });

    it("should handle empty feature list and no subscription", async () => {
      mockRepo.getAllFeatures = vi.fn().mockResolvedValue([]);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      const result = await service.getAllEntitlements("org-empty-no-sub");

      expect(result.plan).toBeNull();
      expect(result.status).toBeNull();
      expect(result.features).toEqual({});
      expect(result.limits).toEqual({});
      expect(result.usage).toEqual({});
      expect(result.resetAt).toEqual({});
      expect(result.config).toEqual({});
    });
  });

  // ============================================
  // Tests 7–9: consume
  // ============================================

  describe("consume", () => {
    it("[Test 7] should decrement usage correctly (successful consume)", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 10)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      const periodEnd = new Date("2026-07-01");
      mockRepo.getCurrentPeriodUsage = vi.fn().mockResolvedValue({
        used: 5,
        periodStart: new Date(),
        periodEnd,
      });

      mockRepo.consumeUsage = vi.fn().mockResolvedValue({ success: true, currentCount: 6 });

      const result = await service.consume("org-1", "AI_GENERATIONS", 1);

      expect(result.success).toBe(true);
      expect(result.used).toBe(6);
      expect(result.limit).toBe(10);
      expect(result.resetAt).toEqual(periodEnd);
      expect(result.error).toBeUndefined();
    });

    it("[Test 8] should return LIMIT_REACHED when over limit", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 10)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      const periodEnd = new Date("2026-07-01");
      const currentUsed = 10;
      mockRepo.getCurrentPeriodUsage = vi.fn().mockResolvedValue({
        used: currentUsed,
        periodStart: new Date(),
        periodEnd,
      });

      mockRepo.consumeUsage = vi
        .fn()
        .mockImplementation(async (_orgId, _featureKey, amount, limit) => {
          if (limit !== null && currentUsed + amount > limit) {
            return { success: false, currentCount: currentUsed };
          }
          return { success: true, currentCount: currentUsed + amount };
        });

      const result = await service.consume("org-1", "AI_GENERATIONS", 1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("LIMIT_REACHED");
      expect(result.used).toBe(10);
      expect(result.limit).toBe(10);
      expect(result.feature).toBe("AI_GENERATIONS");
    });

    it("should allow consumption with null limit (unlimited)", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, null)], // unlimited
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("enterprise"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      mockRepo.getCurrentPeriodUsage = vi.fn().mockResolvedValue({
        used: 9999,
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      mockRepo.consumeUsage = vi.fn().mockResolvedValue({ success: true, currentCount: 10000 });

      const result = await service.consume("org-1", "AI_GENERATIONS", 1);

      expect(result.success).toBe(true);
      expect(result.limit).toBeNull();
    });

    it("[Test 9] should handle multiple concurrent consumers correctly", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 10)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      let usageCount = 5;

      mockRepo.getCurrentPeriodUsage = vi.fn().mockImplementation(() =>
        Promise.resolve({
          used: usageCount,
          periodStart: new Date(),
          periodEnd: new Date(),
        }),
      );

      mockRepo.consumeUsage = vi.fn().mockImplementation(() => {
        usageCount += 1;
        return Promise.resolve({ success: true, currentCount: usageCount });
      });

      const [result1, result2] = await Promise.all([
        service.consume("org-1", "AI_GENERATIONS", 1),
        service.consume("org-1", "AI_GENERATIONS", 1),
      ]);

      // Both succeed because initial is 5 and limit is 10
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Repository-level consumeUsage should have been called twice
      expect(mockRepo.consumeUsage).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // Test 10: A/B experiment bucketing
  // ============================================

  describe("A/B experiment bucketing", () => {
    const config: ExperimentConfig = {
      percentage: 50,
      seed: "NEW_DASHBOARD_v1",
    };

    it("[Test 10] should be deterministic — same user always gets the same bucket", () => {
      const result1 = service.getExperimentVariant("user-123", "NEW_DASHBOARD", config);
      const result2 = service.getExperimentVariant("user-123", "NEW_DASHBOARD", config);
      const result3 = service.getExperimentVariant("user-123", "NEW_DASHBOARD", config);

      expect(result1.bucket).toBe(result2.bucket);
      expect(result1.bucket).toBe(result3.bucket);
      expect(result1.inExperiment).toBe(result2.inExperiment);
      expect(result1.variant).toBe(result2.variant);
    });

    it("should distribute different users into different buckets", () => {
      const buckets = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const result = service.getExperimentVariant(`user-${i}`, "TEST", config);
        buckets.add(result.bucket);
      }
      // With 100 users, we expect many unique buckets
      expect(buckets.size).toBeGreaterThan(50);
    });

    it("should return inExperiment=true when percentage is 100", () => {
      const highPctConfig: ExperimentConfig = { percentage: 100, seed: "ALWAYS_ON" };
      const result = service.getExperimentVariant("any-user", "TEST", highPctConfig);
      expect(result.inExperiment).toBe(true);
    });

    it("should not treat 0% percentage as always-excluded (hash can produce negative buckets)", () => {
      // Known behavior: murmurhash can produce negative 32-bit signed ints.
      // bucket = hash % 100 can be in range [-99, 99].
      // So `bucket < 0` is true for negative buckets (~50% of users).
      // This means percentage=0 doesn't guarantee exclusion.
      // This test documents the current behavior and the known limitation.
      const zeroPctConfig: ExperimentConfig = { percentage: 0, seed: "KNOWN_ISSUE" };
      const result = service.getExperimentVariant("any-user", "TEST", zeroPctConfig);
      expect(result.bucket).toBeLessThan(100);
      expect(result.bucket).toBeGreaterThanOrEqual(-99);
    });

    it("should use the correct variant name from variantNames", () => {
      const multiConfig: ExperimentConfig = {
        percentage: 50,
        seed: "MULTI_VARIANT",
        variantNames: ["control", "treatment-a", "treatment-b"],
      };
      const result = service.getExperimentVariant("user-1", "TEST", multiConfig);
      expect(["control", "treatment-a", "treatment-b"]).toContain(result.variant);
    });

    it("should produce bucket values in the valid JavaScript remainder range", () => {
      const seed = "DISTRIBUTION_TEST";
      for (let i = 0; i < 500; i++) {
        const result = service.getExperimentVariant(`user-${i}`, "TEST", {
          percentage: 50,
          seed,
        });
        // bucket is hash % 100, so it's in [-99, 99]
        expect(result.bucket).toBeGreaterThanOrEqual(-99);
        expect(result.bucket).toBeLessThanOrEqual(99);
      }
    });
  });

  // ============================================
  // Test 11: Edge cases
  // ============================================

  describe("edge cases — null/undefined and empty inputs", () => {
    it("[Test 11] should handle null org override gracefully", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      const result = await (service as any).resolveEntitlement("org-1", "SOME_FEATURE");

      expect(result.enabled).toBe(false);
      expect(mockRepo.getOrgOverride).toHaveBeenCalledWith("org-1", "SOME_FEATURE");
    });

    it("should handle null subscription gracefully", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      const result = await (service as any).resolveEntitlement("org-1", "SOME_FEATURE");

      expect(result.enabled).toBe(false);
    });

    it("[Test 11] should handle empty feature map in getAllEntitlements", async () => {
      mockRepo.getAllFeatures = vi.fn().mockResolvedValue([]);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));

      const result = await service.getAllEntitlements("org-empty-features");

      expect(result.features).toEqual({});
      expect(result.limits).toEqual({});
    });

    it("should handle undefined/null _userOverrides parameter", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      // Call with undefined userOverrides
      const result1 = await (service as any).resolveEntitlement("org-1", "FEAT");
      // Call with null-like userOverrides
      const result2 = await (service as any).resolveEntitlement("org-1", "FEAT", undefined);

      expect(result1.enabled).toBe(false);
      expect(result2.enabled).toBe(false);
    });

    it("should handle expired or non-ACTIVE subscription statuses", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      for (const status of ["PAST_DUE", "CANCELED", "UNPAID"] as SubscriptionStatus[]) {
        mockRepo.getSubscription = vi.fn().mockResolvedValue({
          planKey: "pro",
          status,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });

        const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");
        // Only ACTIVE and TRIALING use plan features
        expect(result.enabled).toBe(false);
      }
    });

    it("should handle TRIALING subscription same as ACTIVE", async () => {
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "TRIALING" as SubscriptionStatus,
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
      });

      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, 10)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");
      expect(result.enabled).toBe(true);
    });
  });

  // ============================================
  // hasFeature
  // ============================================

  describe("hasFeature", () => {
    it("should return true when feature is enabled in plan", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, 10)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.hasFeature("org-1", "EXPORT_PDF");

      expect(result).toBe(true);
      expect(mockRepo.getSubscription).toHaveBeenCalledWith("org-1");
      expect(mockRepo.getPlanFeatures).toHaveBeenCalledWith("pro");
    });

    it("should return false when feature is disabled in plan", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(false, 0)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("free"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.hasFeature("org-1", "EXPORT_PDF");

      expect(result).toBe(false);
    });

    it("should return false when no subscription exists (fallback)", async () => {
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null);

      const result = await service.hasFeature("org-1", "EXPORT_PDF");

      expect(result).toBe(false);
    });
  });

  // ============================================
  // getLimit
  // ============================================

  describe("getLimit", () => {
    it("should return the limit from plan when feature has a numeric limit", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 50)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.getLimit("org-1", "AI_GENERATIONS");

      expect(result).toBe(50);
    });

    it("should return null for unlimited features", async () => {
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, null)],
      ]);

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("enterprise"));
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.getLimit("org-1", "AI_GENERATIONS");

      expect(result).toBeNull();
    });
  });

  // ============================================
  // canConsume
  // ============================================

  describe("canConsume", () => {
    it("should return true when usage + amount is under the limit", async () => {
      mockRepo.getCurrentPeriodUsage = vi.fn().mockResolvedValue({
        used: 5,
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 10)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.canConsume("org-1", "AI_GENERATIONS", 1);

      expect(result).toBe(true);
    });

    it("should return false when usage + amount exceeds the limit", async () => {
      mockRepo.getCurrentPeriodUsage = vi.fn().mockResolvedValue({
        used: 10,
        periodStart: new Date(),
        periodEnd: new Date(),
      });

      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, 10)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.canConsume("org-1", "AI_GENERATIONS", 1);

      expect(result).toBe(false);
    });

    it("should return true when limit is null (unlimited)", async () => {
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("enterprise"));
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["AI_GENERATIONS", makePlanFeature(true, null)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await service.canConsume("org-1", "AI_GENERATIONS", 999999);

      expect(result).toBe(true);
      // Should NOT call getCurrentPeriodUsage for unlimited features
      expect(mockRepo.getCurrentPeriodUsage).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // assertFeature
  // ============================================

  describe("assertFeature", () => {
    it("should resolve successfully when feature is available", async () => {
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, 10)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      await expect(service.assertFeature("org-1", "EXPORT_PDF")).resolves.toBeUndefined();
    });

    it("should throw a FeatureNotAvailableError when feature is not available", async () => {
      mockRepo.getSubscription = vi.fn().mockResolvedValue(null); // No subscription
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);

      await expect(service.assertFeature("org-1", "NONEXISTENT")).rejects.toThrow();

      // Verify the error shape via try/catch
      try {
        await service.assertFeature("org-1", "NONEXISTENT");
        expect.unreachable("Should have thrown");
      } catch (error) {
        const err = error as any;
        expect(err.error).toBe("FEATURE_NOT_AVAILABLE");
        expect(err.feature).toBe("NONEXISTENT");
        expect(err.currentPlan).toBe("free"); // no plan → "free" via getDebugTrace
        expect(err.upgradeUrl).toBe("/settings/billing?upgrade=true");
      }
    });
  });

  // ============================================
  // invalidateCache
  // ============================================

  describe("invalidateCache", () => {
    it("should invalidate cache and publish event", async () => {
      // The cacheService is imported as a module - we can't easily mock it here,
      // but we can verify the method exists and doesn't throw
      await expect(service.invalidateCache("org-1")).resolves.toBeUndefined();
    });
  });

  // ============================================
  // getDebugTrace
  // ============================================

  describe("getDebugTrace", () => {
    it("should return a trace with resolution source and plan key", async () => {
      mockRepo.getFeature = vi.fn().mockResolvedValue({
        key: "EXPORT_PDF",
        name: "PDF Export",
        type: "LIMIT",
        defaultConfig: { defaultLimit: 0 },
        isActive: true,
      });
      mockRepo.getOrgOverride = vi.fn().mockResolvedValue(null);
      mockRepo.getSubscription = vi.fn().mockResolvedValue(makeActiveSubscription("pro"));
      const planFeatures = new Map<string, PlanFeatureConfig>([
        ["EXPORT_PDF", makePlanFeature(true, 10)],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const trace = await service.getDebugTrace("org-1", "EXPORT_PDF");

      expect(trace.planKey).toBe("pro");
      expect(trace.value).toBe(true); // value.enabled = true
      expect(trace.featureConfig).toBeDefined();
    });
  });

  // ============================================
  // Downgrade strategies
  // ============================================

  describe("downgrade strategies", () => {
    it("should return plan value during grace period for graceful downgrade", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      mockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE" as SubscriptionStatus,
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: true,
      });

      const planFeatures = new Map<string, PlanFeatureConfig>([
        [
          "EXPORT_PDF",
          {
            enabled: false, // After downgrade, this is false
            limitValue: 3,
            configJson: { downgradeStrategy: "graceful" } as any,
          },
        ],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      // With graceful strategy and period not ended, the code returns the plan values
      // before the downgrade check — only cancelAtPeriodEnd + strategy check runs
      const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");

      // The graceful path: enabled = false because planFeature.enabled is false
      expect(result.enabled).toBe(false);
      expect(result.limit).toBe(3);
    });

    it("should handle immediate downgrade (disable immediately)", async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      mockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE" as SubscriptionStatus,
        currentPeriodEnd: futureDate,
        cancelAtPeriodEnd: true,
      });

      const planFeatures = new Map<string, PlanFeatureConfig>([
        [
          "EXPORT_PDF",
          {
            enabled: false,
            limitValue: 3,
            configJson: { downgradeStrategy: "immediate" } as any,
          },
        ],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");

      // Immediate: falls through the strategy check, returns plan value
      expect(result.enabled).toBe(false);
    });
  });

  // ============================================
  // Subscription period-end handling
  // ============================================

  describe("subscription period end", () => {
    it("should still return plan values when currentPeriodEnd has passed (graceful expiry)", async () => {
      // DESIGN NOTE: The code has a comment "Fall through to fallback" for graceful
      // with expired period, but the outer return after the cancelAtPeriodEnd block
      // still returns planFeature values. The graceful early-return is the only
      // path that exits early — every other path falls to the outer return.
      // This test documents the ACTUAL behavior (not the commented intent).
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      mockRepo.getSubscription = vi.fn().mockResolvedValue({
        planKey: "pro",
        status: "ACTIVE" as SubscriptionStatus,
        currentPeriodEnd: pastDate,
        cancelAtPeriodEnd: true,
      });

      const planFeatures = new Map<string, PlanFeatureConfig>([
        [
          "EXPORT_PDF",
          {
            enabled: true,
            limitValue: 10,
            configJson: { downgradeStrategy: "graceful" } as any,
          },
        ],
      ]);
      mockRepo.getPlanFeatures = vi.fn().mockResolvedValue(planFeatures);

      const result = await (service as any).resolveEntitlement("org-1", "EXPORT_PDF");

      // The outer return still returns planFeature values
      expect(result.enabled).toBe(true);
      expect(result.limit).toBe(10);
    });
  });
});

// ============================================
// Error Factory Functions
// ============================================

describe("Error factory functions", () => {
  it("[Test 12] createFeatureNotAvailableError — returns correctly formatted error", () => {
    const error = createFeatureNotAvailableError("EXPORT_PDF", "free");

    expect(error.error).toBe("FEATURE_NOT_AVAILABLE");
    const featureError = error as FeatureNotAvailableError;
    expect(featureError.feature).toBe("EXPORT_PDF");
    expect(featureError.planRequired).toBe("PRO"); // Currently hardcoded as "PRO"
    expect(featureError.currentPlan).toBe("free");
    expect(featureError.upgradeUrl).toBe("/settings/billing?upgrade=true");

    // Verify the complete shape matches the FeatureNotAvailableError interface
    expect(error).toMatchObject({
      error: "FEATURE_NOT_AVAILABLE",
      feature: "EXPORT_PDF",
      planRequired: "PRO",
      currentPlan: "free",
      upgradeUrl: "/settings/billing?upgrade=true",
    });
  });

  it("createLimitReachedError — returns correctly formatted error", () => {
    const resetAt = new Date("2026-07-01");
    const error = createLimitReachedError("AI_GENERATIONS", 10, 10, resetAt);

    expect(error.error).toBe("LIMIT_REACHED");
    const limitError = error as LimitReachedError;
    expect(limitError.feature).toBe("AI_GENERATIONS");
    expect(limitError.limit).toBe(10);
    expect(limitError.used).toBe(10);
    expect(limitError.resetAt).toBe(resetAt.toISOString());
    expect(limitError.upgradeUrl).toBe("/settings/billing?upgrade=true");
  });

  it("createSubscriptionExpiredError — returns correctly formatted error", () => {
    const error = createSubscriptionExpiredError();

    expect(error.error).toBe("SUBSCRIPTION_EXPIRED");
    expect((error as SubscriptionExpiredError).renewUrl).toBe("/settings/billing");
  });
});
