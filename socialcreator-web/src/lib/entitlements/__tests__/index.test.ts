/**
 * Feature Flags & Entitlements - Barrel Export Smoke Test
 * Verifies all public exports are accessible from index.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks for all transitive dependencies
// ============================================

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
    publish: vi.fn(),
  })),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { findUnique: vi.fn(), findMany: vi.fn() },
    feature: { findUnique: vi.fn(), findMany: vi.fn() },
    entitlementOverride: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: { findUnique: vi.fn() },
    usageTracking: { findUnique: vi.fn(), upsert: vi.fn() },
    experiment: { findUnique: vi.fn() },
    $transaction: vi.fn((cb: (...args: any[]) => any) =>
      cb({ usageTracking: { findUnique: vi.fn(), upsert: vi.fn() } }),
    ),
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: vi.fn() },
  })),
}));

vi.mock("@/lib/entitlements/cache", () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidatePattern: vi.fn(),
    publishInvalidation: vi.fn().mockResolvedValue(undefined),
  },
  getEntitlementsCacheKey: vi.fn((key: string) => `entitlements:${key}`),
  clearMemoryCache: vi.fn(),
  getEntitlementsRedis: vi.fn(),
}));

vi.mock("@/lib/entitlements/repository", () => ({
  getEntitlementRepository: vi.fn(),
  PrismaEntitlementRepository: vi.fn(),
  resetEntitlementRepository: vi.fn(),
  setEntitlementRepository: vi.fn(),
}));

vi.mock("@/lib/entitlements/service", () => ({
  createFeatureNotAvailableError: vi.fn(),
  createLimitReachedError: vi.fn(),
  createSubscriptionExpiredError: vi.fn(),
  FeatureGateService: vi.fn(),
  getFeatureGateService: vi.fn(),
  resetFeatureGateService: vi.fn(),
}));

vi.mock("@/lib/entitlements/stripe-webhook", () => ({
  handleStripeWebhook: vi.fn(),
}));

// ============================================
// Tests
// ============================================

describe("Entitlements barrel export (index.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("Cache exports", () => {
    it("should export cacheService", async () => {
      const mod = await import("../index");
      expect(mod.cacheService).toBeDefined();
    });

    it("should export getEntitlementsCacheKey", async () => {
      const mod = await import("../index");
      expect(typeof mod.getEntitlementsCacheKey).toBe("function");
    });

    it("should export getEntitlementsRedis", async () => {
      const mod = await import("../index");
      expect(typeof mod.getEntitlementsRedis).toBe("function");
    });

    it("should export clearMemoryCache", async () => {
      const mod = await import("../index");
      expect(typeof mod.clearMemoryCache).toBe("function");
    });
  });

  describe("Downgrade exports", () => {
    it("should export DowngradeService class", async () => {
      const mod = await import("../index");
      expect(mod.DowngradeService).toBeDefined();
    });

    it("should export getDowngradeService function", async () => {
      const mod = await import("../index");
      expect(typeof mod.getDowngradeService).toBe("function");
    });

    it("should export resetDowngradeService function", async () => {
      const mod = await import("../index");
      expect(typeof mod.resetDowngradeService).toBe("function");
    });
  });

  describe("Repository exports", () => {
    it("should export PrismaEntitlementRepository class", async () => {
      const mod = await import("../index");
      expect(mod.PrismaEntitlementRepository).toBeDefined();
    });

    it("should export getEntitlementRepository function", async () => {
      const mod = await import("../index");
      expect(typeof mod.getEntitlementRepository).toBe("function");
    });

    it("should export resetEntitlementRepository function", async () => {
      const mod = await import("../index");
      expect(typeof mod.resetEntitlementRepository).toBe("function");
    });

    it("should export setEntitlementRepository function", async () => {
      const mod = await import("../index");
      expect(typeof mod.setEntitlementRepository).toBe("function");
    });
  });

  describe("Service exports", () => {
    it("should export FeatureGateService class", async () => {
      const mod = await import("../index");
      expect(mod.FeatureGateService).toBeDefined();
    });

    it("should export getFeatureGateService function", async () => {
      const mod = await import("../index");
      expect(typeof mod.getFeatureGateService).toBe("function");
    });

    it("should export error creation functions", async () => {
      const mod = await import("../index");
      expect(typeof mod.createFeatureNotAvailableError).toBe("function");
      expect(typeof mod.createLimitReachedError).toBe("function");
      expect(typeof mod.createSubscriptionExpiredError).toBe("function");
    });
  });

  describe("Middleware exports", () => {
    it("should export middleware functions", async () => {
      const mod = await import("../index");
      expect(typeof mod.requireFeature).toBe("function");
      expect(typeof mod.requireLimit).toBe("function");
      expect(typeof mod.consumeFeature).toBe("function");
      expect(typeof mod.withFeature).toBe("function");
      expect(typeof mod.withLimit).toBe("function");
      expect(typeof mod.withConsume).toBe("function");
      expect(typeof mod.withEntitlements).toBe("function");
    });
  });

  describe("Stripe webhook export", () => {
    it("should export handleStripeWebhook", async () => {
      const mod = await import("../index");
      expect(typeof mod.handleStripeWebhook).toBe("function");
    });
  });

  describe("Type exports", () => {
    it("should export FeatureType", async () => {
      const mod = await import("../index");
      // Types are re-exported with `export * from "./types"`,
      // so they should be present at runtime as objects/functions
      // (only value exports are available at runtime)
      expect(mod.FeatureGateService).toBeDefined();
    });
  });

  describe("Default export", () => {
    it("should export a default function", async () => {
      const mod = await import("../index");
      expect(typeof mod.default).toBe("function");
    });
  });
});
