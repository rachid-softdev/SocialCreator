/**
 * Client-safe plan metadata.
 *
 * Pure constants + functions only — NO server dependencies (no Stripe SDK,
 * no prisma, no logger). Safe to import from "use client" components.
 * Server code can keep importing the full API via `@/lib/stripe` (which
 * re-exports everything from here through `./infrastructure/stripe`).
 */

/**
 * @deprecated Use FeatureGateService / PlanFeature table instead.
 * Migration tracked for future: Move plan limits to PlanFeature table.
 */
export const PLANS = {
  starter: {
    name: "Starter",
    price: 5000, // Will be overridden by dynamic fetch
    profiles: 1,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: ["1 profile", "AI content generation", "Basic scheduling", "Email support"],
  },
  pro: {
    name: "Pro",
    price: 7000, // Will be overridden by dynamic fetch
    profiles: 2,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: [
      "2 profiles",
      "AI content generation",
      "Advanced scheduling",
      "Video clipping",
      "Priority support",
    ],
  },
  team: {
    name: "Team",
    price: 11000, // Will be overridden by dynamic fetch
    profiles: 4,
    addOnPrice: 2000,
    addOnProfiles: 1,
    features: [
      "4 profiles",
      "AI content generation",
      "Advanced scheduling",
      "Video clipping",
      "Team collaboration",
      "Dedicated support",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS | "free";
export type PaidPlanKey = keyof typeof PLANS;

export function getPlanData(plan: "free"): null;
export function getPlanData(plan: PaidPlanKey): (typeof PLANS)[PaidPlanKey];
export function getPlanData(plan: PlanKey): (typeof PLANS)[PaidPlanKey] | null;
export function getPlanData(plan: PlanKey) {
  if (plan === "free") return null;
  return PLANS[plan];
}
