import { prisma } from "@/lib/prisma";

/**
 * @deprecated Use FeatureGateService instead.
 * Migration tracked for future: Move plan limits to PlanFeature table.
 * The FeatureGateService already supports feature flags and limits.
 */
const PLAN_LIMITS = {
  free: 1,
  starter: 1,
  pro: 2,
  team: 4,
  enterprise: 999,
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;

export async function checkProfileQuota(userId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
  plan: PlanTier;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true, stripeSubscriptionStatus: true },
  });

  const status = user?.stripeSubscriptionStatus;
  let plan: PlanTier = "free";
  if (status === "active" || status === "trialing") {
    // Default to starter for subscribers - could fetch actual plan from Stripe
    plan = "starter";
  }

  const current = await prisma.profile.count({ where: { userId } });
  const max = PLAN_LIMITS[plan];

  return {
    allowed: current < max,
    current,
    max,
    plan,
  };
}

export async function getUserPlan(userId: string): Promise<PlanTier> {
  const { plan } = await checkProfileQuota(userId);
  return plan;
}

export function getPlanLimit(plan: PlanTier): number {
  return PLAN_LIMITS[plan];
}

export function getRemainingQuota(_userId: string, currentCount: number, plan: PlanTier): number {
  return Math.max(0, PLAN_LIMITS[plan] - currentCount);
}
