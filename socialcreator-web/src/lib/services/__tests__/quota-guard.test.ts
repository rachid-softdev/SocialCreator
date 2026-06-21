/**
 * Tests for quota guard service (quota-guard.ts)
 *
 * Covers checkProfileQuota, getUserPlan, getPlanLimit, getRemainingQuota.
 * Guards profile creation limits per plan tier.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    profile: { count: vi.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Quota guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // checkProfileQuota
  // ============================================

  describe("checkProfileQuota", () => {
    it("should return allowed=true when profile count is under the free plan limit", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      });
      mockPrisma.profile.count.mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result).toEqual({
        allowed: true,
        current: 0,
        max: 1,
        plan: "free",
      });
    });

    it("should return allowed=false when profile count equals the free plan limit", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      });
      mockPrisma.profile.count.mockResolvedValue(1);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result).toEqual({
        allowed: false,
        current: 1,
        max: 1,
        plan: "free",
      });
    });

    it("should return allowed=false when profile count exceeds the free plan limit", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      });
      mockPrisma.profile.count.mockResolvedValue(2);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(2);
      expect(result.max).toBe(1);
    });

    it("should return starter plan for active subscribers", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_123",
        stripeSubscriptionStatus: "active",
      });
      mockPrisma.profile.count.mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.plan).toBe("starter");
      expect(result.max).toBe(1);
      expect(result.allowed).toBe(true);
    });

    it("should return starter plan for trialing users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_trial",
        stripeSubscriptionStatus: "trialing",
      });
      mockPrisma.profile.count.mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.plan).toBe("starter");
      expect(result.max).toBe(1);
    });

    it("should return free plan for non-active subscription statuses", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_old",
        stripeSubscriptionStatus: "past_due",
      });
      mockPrisma.profile.count.mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.plan).toBe("free");
      expect(result.max).toBe(1);
    });

    it("should handle user not found (null) gracefully — fallback to free plan", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.profile.count.mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("unknown-user");

      expect(result.plan).toBe("free");
      expect(result.max).toBe(1);
      expect(result.allowed).toBe(true);
    });

    it("should propagate Prisma errors (e.g. DB timeout)", async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error("DB timeout"));

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      await expect(checkProfileQuota("user-1")).rejects.toThrow("DB timeout");
    });
  });

  // ============================================
  // getUserPlan
  // ============================================

  describe("getUserPlan", () => {
    it("should return the plan from checkProfileQuota for active subscribers", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: "sub_active",
        stripeSubscriptionStatus: "active",
      });
      mockPrisma.profile.count.mockResolvedValue(0);

      const { getUserPlan } = await import("@/lib/services/quota-guard");
      const plan = await getUserPlan("user-1");

      expect(plan).toBe("starter");
    });

    it("should return free for non-subscribers", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      });
      mockPrisma.profile.count.mockResolvedValue(0);

      const { getUserPlan } = await import("@/lib/services/quota-guard");
      const plan = await getUserPlan("user-1");

      expect(plan).toBe("free");
    });
  });

  // ============================================
  // getPlanLimit
  // ============================================

  describe("getPlanLimit", () => {
    it("should return correct limits for each plan tier", async () => {
      const { getPlanLimit } = await import("@/lib/services/quota-guard");

      expect(getPlanLimit("free")).toBe(1);
      expect(getPlanLimit("starter")).toBe(1);
      expect(getPlanLimit("pro")).toBe(2);
      expect(getPlanLimit("team")).toBe(4);
      expect(getPlanLimit("enterprise")).toBe(999);
    });

    it("should return undefined for an unknown plan key", async () => {
      const { getPlanLimit } = await import("@/lib/services/quota-guard");

      // Cast needed because TS prevents calling with unknown keys
      const result = getPlanLimit("unknown-plan" as any);
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // getRemainingQuota
  // ============================================

  describe("getRemainingQuota", () => {
    it("should calculate remaining quota correctly when under limit", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");

      expect(getRemainingQuota("user-1", 0, "free")).toBe(1);
      expect(getRemainingQuota("user-1", 2, "team")).toBe(2); // max is 4
    });

    it("should return 0 when current count equals the limit", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");

      expect(getRemainingQuota("user-1", 1, "free")).toBe(0);
      expect(getRemainingQuota("user-1", 4, "team")).toBe(0);
    });

    it("should never return negative values when current exceeds max", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");

      expect(getRemainingQuota("user-1", 10, "free")).toBe(0);
      expect(getRemainingQuota("user-1", 999, "pro")).toBe(0);
    });

    it("should return correct values for enterprise plan (high limit)", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");

      expect(getRemainingQuota("user-1", 0, "enterprise")).toBe(999);
      expect(getRemainingQuota("user-1", 500, "enterprise")).toBe(499);
      expect(getRemainingQuota("user-1", 1000, "enterprise")).toBe(0);
    });

    it("should ignore the userId parameter in the calculation", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");

      // The userId is accepted but not used in calculation
      expect(getRemainingQuota("any-user", 0, "pro")).toBe(2);
      expect(getRemainingQuota("another-user", 1, "pro")).toBe(1);
    });
  });
});
