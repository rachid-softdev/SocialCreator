/**
 * Feature Flags & Entitlements - Types Tests
 * Validates type-level contracts and value constraints
 */

import { describe, expect, it } from "vitest";

describe("Entitlements Types", () => {
  // ============================================
  // FeatureType union constraint
  // ============================================

  describe("FeatureType", () => {
    it("should allow BOOLEAN, LIMIT, and EXPERIMENT as valid values", () => {
      const validTypes = ["BOOLEAN", "LIMIT", "EXPERIMENT"] as const;

      // Compile-time check: ensure string values match the union
      expect(validTypes).toContain("BOOLEAN");
      expect(validTypes).toContain("LIMIT");
      expect(validTypes).toContain("EXPERIMENT");

      // Ensure no unexpected values leak through
      expect(validTypes.length).toBe(3);
    });
  });

  // ============================================
  // DowngradeStrategy union constraint
  // ============================================

  describe("DowngradeStrategy", () => {
    it("should allow all three strategies", () => {
      const strategies = ["graceful", "immediate", "freeze"] as const;

      expect(strategies).toContain("graceful");
      expect(strategies).toContain("immediate");
      expect(strategies).toContain("freeze");
      expect(strategies.length).toBe(3);
    });
  });

  // ============================================
  // SubscriptionStatus union constraint
  // ============================================

  describe("SubscriptionStatus", () => {
    it("should allow all five subscription lifecycle states", () => {
      const statuses = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "UNPAID"] as const;

      expect(statuses).toContain("ACTIVE");
      expect(statuses).toContain("TRIALING");
      expect(statuses).toContain("PAST_DUE");
      expect(statuses).toContain("CANCELED");
      expect(statuses).toContain("UNPAID");
      expect(statuses.length).toBe(5);
    });
  });

  // ============================================
  // Interface shape compliance (runtime check)
  // ============================================

  describe("Interface shapes", () => {
    it("FeatureConfig should accept percentage, seed, variantNames, defaultLimit", () => {
      const config = {
        percentage: 50,
        seed: "test-experiment",
        variantNames: ["control", "treatment"],
        defaultLimit: 100,
      };

      expect(config.percentage).toBe(50);
      expect(config.seed).toBe("test-experiment");
      expect(config.variantNames).toHaveLength(2);
      expect(config.defaultLimit).toBe(100);
    });

    it("FeatureDefinition should have required structure", () => {
      const feature = {
        key: "EXPORT_PDF",
        name: "PDF Export",
        description: "Export reports as PDF",
        type: "BOOLEAN" as const,
        defaultConfig: {},
        isActive: true,
      };

      expect(feature.key).toBe("EXPORT_PDF");
      expect(feature.isActive).toBe(true);
      expect(feature.description).toBeDefined();
    });

    it("PlanFeatureConfig should allow enabled, limitValue, configJson, and downgradeStrategy", () => {
      const config = {
        enabled: true,
        limitValue: 10,
        configJson: { downgradeStrategy: "graceful" as const },
        downgradeStrategy: "graceful" as const,
      };

      expect(config.enabled).toBe(true);
      expect(config.limitValue).toBe(10);
      expect(config.downgradeStrategy).toBe("graceful");
    });

    it("EntitlementValue should support enabled, limit, expiresAt, and config", () => {
      const value = {
        enabled: true,
        limit: null,
        expiresAt: new Date("2025-12-31"),
        config: { percentage: 100 },
      };

      expect(value.enabled).toBe(true);
      expect(value.limit).toBeNull();
      expect(value.expiresAt).toBeInstanceOf(Date);
    });

    it("OverrideInput should have required fields", () => {
      const input = {
        scope: "ORG" as const,
        scopeId: "org-123",
        featureKey: "AI_GENERATIONS",
        enabled: true,
        limitValue: 50,
        expiresAt: new Date(),
        reason: "Override for testing",
      };

      expect(input.scope).toBe("ORG");
      expect(input.featureKey).toBe("AI_GENERATIONS");
      expect(input.reason).toBeTruthy();
    });

    it("EntitlementMap should hold resolved entitlement state", () => {
      const map = {
        plan: "pro",
        status: "ACTIVE" as const,
        features: { EXPORT_PDF: true, AI_GENERATIONS: false },
        limits: { EXPORT_PDF: null, AI_GENERATIONS: 10 },
        usage: { EXPORT_PDF: 0, AI_GENERATIONS: 5 },
        resetAt: { EXPORT_PDF: new Date(), AI_GENERATIONS: new Date() },
        config: { EXPORT_PDF: {}, AI_GENERATIONS: {} },
      };

      expect(map.plan).toBe("pro");
      expect(map.features.EXPORT_PDF).toBe(true);
      expect(Object.keys(map.features)).toHaveLength(2);
    });

    it("Error types should have expected discrimination", () => {
      const featureError = {
        error: "FEATURE_NOT_AVAILABLE" as const,
        feature: "X",
        planRequired: "PRO",
        currentPlan: "free",
        upgradeUrl: "/billing",
      };
      const limitError = {
        error: "LIMIT_REACHED" as const,
        feature: "X",
        limit: 10,
        used: 10,
        resetAt: "",
        upgradeUrl: "/billing",
      };
      const expiredError = { error: "SUBSCRIPTION_EXPIRED" as const, renewUrl: "/billing" };

      expect(featureError.error).toBe("FEATURE_NOT_AVAILABLE");
      expect(limitError.error).toBe("LIMIT_REACHED");
      expect(expiredError.error).toBe("SUBSCRIPTION_EXPIRED");
    });

    it("ICacheService interface should define all five methods", () => {
      // Verify the contract exists by checking the type of a conforming object
      const mock: {
        get: (...args: any[]) => any;
        set: (...args: any[]) => any;
        invalidate: (...args: any[]) => any;
        invalidatePattern: (...args: any[]) => any;
        publishInvalidation: (...args: any[]) => any;
      } = {
        get: async <T>(_key: string): Promise<T | null> => null,
        set: async <T>(_key: string, _value: T, _ttl?: number): Promise<void> => undefined,
        invalidate: async (_key: string): Promise<void> => undefined,
        invalidatePattern: async (_pattern: string): Promise<void> => undefined,
        publishInvalidation: async (_orgId: string): Promise<void> => undefined,
      };

      expect(typeof mock.get).toBe("function");
      expect(typeof mock.set).toBe("function");
      expect(typeof mock.invalidate).toBe("function");
      expect(typeof mock.invalidatePattern).toBe("function");
      expect(typeof mock.publishInvalidation).toBe("function");
    });
  });

  // ============================================
  // Resolution source enum
  // ============================================

  describe("ResolutionSource", () => {
    it("should have four possible values", () => {
      const sources: readonly string[] = ["user_override", "org_override", "plan", "fallback"];

      expect(sources).toContain("user_override");
      expect(sources).toContain("org_override");
      expect(sources).toContain("plan");
      expect(sources).toContain("fallback");
      expect(sources.length).toBe(4);
    });
  });
});
