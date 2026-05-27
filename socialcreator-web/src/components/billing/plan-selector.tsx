"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@socialcreator/ui/button";
import { getPlanData, type PlanKey, PLANS } from "@/lib/stripe";

interface PlanSelectorProps {
  onSubmit?: (plan: PlanKey, additionalProfiles: number) => void;
  currentPlan?: PlanKey;
}

export function PlanSelector({ onSubmit, currentPlan }: PlanSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(currentPlan || "starter");
  const [additionalProfiles, setAdditionalProfiles] = useState(0);

  const plan = getPlanData(selectedPlan)!;

  const totalPrice = (plan?.price ?? 0) + (plan?.addOnPrice ?? 0) * additionalProfiles;

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(priceInCents / 100);
  };

  const handleSubmit = () => {
    onSubmit?.(selectedPlan, additionalProfiles);
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-6">
      <div className="mb-6">
        <h3 className="text-title-md mb-4">Choose your plan</h3>

        <div className="flex gap-2">
          {(["starter", "pro", "team"] as PlanKey[]).map((planKey) => {
            const isSelected = selectedPlan === planKey;
            const isCurrent = currentPlan === planKey;

            return (
              <button
                key={planKey}
                onClick={() => {
                  setSelectedPlan(planKey);
                  setAdditionalProfiles(0);
                }}
                disabled={isCurrent}
                className={`flex-1 py-2 px-3 rounded-lg border text-center text-body-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-surface-dark text-on-dark"
                    : isCurrent
                      ? "border-hairline-severe text-muted cursor-not-allowed"
                      : "border-hairline text-ink hover:border-hairline-strong"
                }`}
              >
                {getPlanData(planKey)?.name}
                {isCurrent && " (current)"}
              </button>
            );
          })}
        </div>
      </div>

      {selectedPlan !== "free" && (
        <div className="mb-6">
          <h3 className="text-title-md mb-4">Additional profiles</h3>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setAdditionalProfiles(Math.max(0, additionalProfiles - 1))}
              disabled={additionalProfiles <= 0}
              className="w-10 h-10 rounded-full border border-hairline flex items-center justify-center hover:bg-surface-strong disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="text-xl font-semibold w-12 text-center">{additionalProfiles}</div>

            <button
              onClick={() => setAdditionalProfiles(additionalProfiles + 1)}
              className="w-10 h-10 rounded-full border border-hairline flex items-center justify-center hover:bg-surface-strong"
            >
              <Plus className="w-4 h-4" />
            </button>

            <span className="text-body-sm text-muted ml-2">
              +{formatPrice(plan.addOnPrice)}/mo each
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-hairline pt-4 mt-4">
        <div className="flex justify-between items-center">
          <span className="text-body-sm text-muted">Monthly total</span>
          <span className="text-2xl font-semibold">{formatPrice(totalPrice)}/mo</span>
        </div>
      </div>

      <Button onClick={handleSubmit} className="w-full mt-4">
        Continue to Checkout
      </Button>
    </div>
  );
}
