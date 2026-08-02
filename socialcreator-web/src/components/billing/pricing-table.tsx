"use client";

import { Button } from "@socialcreator/ui/button";
import { Check } from "lucide-react";
import { getPlanData, type PaidPlanKey, PLANS, type PlanKey } from "@/lib/plans-data";

interface PricingTableProps {
  onSelectPlan?: (plan: PlanKey) => void;
  currentPlan?: PlanKey;
}

export function PricingTable({ onSelectPlan, currentPlan }: PricingTableProps) {
  // Static prices from PLANS metadata. (Dynamic Stripe prices require a
  // server endpoint — fetching them directly from the client is not possible
  // since the Stripe secret key must never leave the server.)
  const planPrices: Record<PaidPlanKey, number> = {
    starter: PLANS.starter.price,
    pro: PLANS.pro.price,
    team: PLANS.team.price,
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(priceInCents / 100);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {(["starter", "pro", "team"] as PaidPlanKey[]).map((planKey) => {
        const plan = getPlanData(planKey);
        const price = planPrices[planKey];
        const isCurrent = currentPlan === planKey;
        const isPro = planKey === "pro";

        return (
          <div
            key={planKey}
            className={`relative rounded-xl border p-6 flex flex-col ${
              isPro
                ? "border-transparent bg-surface-dark text-on-dark"
                : "border-hairline bg-surface-card text-ink"
            }`}
          >
            {isPro && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-on-primary text-caption-uppercase rounded-full">
                Most Popular
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-title-md font-medium">{plan.name}</h3>
              <p className="text-2xl font-semibold mt-2">
                {formatPrice(price)}
                <span className="text-base font-normal opacity-70">/month</span>
              </p>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check
                    className={`w-5 h-5 flex-shrink-0 ${isPro ? "text-on-dark" : "text-semantic-success"}`}
                  />
                  <span className="text-body-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={isCurrent ? "outline" : isPro ? "primary" : "outline"}
              onClick={() => onSelectPlan?.(planKey)}
              disabled={isCurrent}
              className="w-full"
            >
              {isCurrent ? "Current Plan" : "Select Plan"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
