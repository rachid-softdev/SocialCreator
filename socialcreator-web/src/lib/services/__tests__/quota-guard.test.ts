/**
 * Tests for quota guard service (quota-guard.ts)
 *
 * Covers checkProfileQuota, getUserPlan, getPlanLimit, getRemainingQuota.
 * Guards profile creation limits per plan tier.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    profile: {
      count: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Quota guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkProfileQuota", () => {
    it("should be a function", async () => {
      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      expect(typeof checkProfileQuota).toBe("function");
    });

    it("should return allowed=true when profile count is under limit for free plan", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result).toEqual({
        allowed: true,
        current: 0,
        max: 1,
        plan: "free",
      });
    });

    it("should return allowed=false when profile count is at limit for free plan", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(1);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result).toEqual({
        allowed: false,
        current: 1,
        max: 1,
        plan: "free",
      });
    });

    it("should return starter plan for active subscribers", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: "sub_123",
        stripeSubscriptionStatus: "active",
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.plan).toBe("starter");
      expect(result.max).toBe(1);
      expect(result.allowed).toBe(true);
    });

    it("should return starter plan for trialing users", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: "sub_trial",
        stripeSubscriptionStatus: "trialing",
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.plan).toBe("starter");
    });

    it("should return free plan for past_due or canceled subscriptions", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: "sub_old",
        stripeSubscriptionStatus: "past_due",
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("user-1");

      expect(result.plan).toBe("free");
      expect(result.max).toBe(1);
    });

    it("should handle user not found in DB", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      const result = await checkProfileQuota("unknown-user");

      expect(result.plan).toBe("free");
      expect(result.max).toBe(1);
      expect(result.allowed).toBe(true);
    });

    it("should throw when Prisma query fails", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB timeout"));

      const { checkProfileQuota } = await import("@/lib/services/quota-guard");
      await expect(checkProfileQuota("user-1")).rejects.toThrow("DB timeout");
    });
  });

  describe("getUserPlan", () => {
    it("should be a function", async () => {
      const { getUserPlan } = await import("@/lib/services/quota-guard");
      expect(typeof getUserPlan).toBe("function");
    });

    it("should return the plan from checkProfileQuota", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: "sub_active",
        stripeSubscriptionStatus: "active",
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { getUserPlan } = await import("@/lib/services/quota-guard");
      const plan = await getUserPlan("user-1");

      expect(plan).toBe("starter");
    });

    it("should return free for non-subscribers", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
      } as any);
      vi.mocked(prisma.profile.count).mockResolvedValue(0);

      const { getUserPlan } = await import("@/lib/services/quota-guard");
      const plan = await getUserPlan("user-1");

      expect(plan).toBe("free");
    });
  });

  describe("getPlanLimit", () => {
    it("should be a function", async () => {
      const { getPlanLimit } = await import("@/lib/services/quota-guard");
      expect(typeof getPlanLimit).toBe("function");
    });

    it("should return correct limits for each plan tier", async () => {
      const { getPlanLimit } = await import("@/lib/services/quota-guard");
      expect(getPlanLimit("free")).toBe(1);
      expect(getPlanLimit("starter")).toBe(1);
      expect(getPlanLimit("pro")).toBe(2);
      expect(getPlanLimit("team")).toBe(4);
      expect(getPlanLimit("enterprise")).toBe(999);
    });
  });

  describe("getRemainingQuota", () => {
    it("should be a function", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");
      expect(typeof getRemainingQuota).toBe("function");
    });

    it("should return remaining quota for a given plan", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");
      expect(getRemainingQuota("user-1", 0, "free")).toBe(1);
      expect(getRemainingQuota("user-1", 1, "free")).toBe(0);
      expect(getRemainingQuota("user-1", 3, "pro")).toBe(0); // max is 2, 3 is over
      expect(getRemainingQuota("user-1", 2, "team")).toBe(2); // max is 4
    });

    it("should never return negative remaining quota", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");
      expect(getRemainingQuota("user-1", 10, "free")).toBe(0);
      expect(getRemainingQuota("user-1", 999, "pro")).toBe(0);
    });

    it("should return max for enterprise plan", async () => {
      const { getRemainingQuota } = await import("@/lib/services/quota-guard");
      expect(getRemainingQuota("user-1", 0, "enterprise")).toBe(999);
      expect(getRemainingQuota("user-1", 500, "enterprise")).toBe(499);
    });
  });
});
