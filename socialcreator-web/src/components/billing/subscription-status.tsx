"use client";

import { Button } from "@socialcreator/ui/button";
import { Calendar, CreditCard, ExternalLink } from "lucide-react";
import { useState } from "react";
import { getPlanData, type PlanKey } from "@/lib/stripe";

interface SubscriptionStatusProps {
  plan?: PlanKey;
  status?: string;
  renewalDate?: Date;
  profilesUsed?: number;
  profilesMax?: number;
  onManagePortal?: () => void;
}

export function SubscriptionStatus({
  plan = "free",
  status,
  renewalDate,
  profilesUsed = 0,
  profilesMax = 1,
  onManagePortal,
}: SubscriptionStatusProps) {
  const planData = getPlanData(plan);

  const statusColors: Record<string, string> = {
    active: "bg-semantic-success/10 text-semantic-success",
    trialing: "bg-gradient-mint/30 text-semantic-success",
    past_due: "bg-gradient-peach/30 text-semantic-error",
    canceled: "bg-surface-strong text-muted",
  };

  const statusLabels: Record<string, string> = {
    active: "Active",
    trialing: "Trialing",
    past_due: "Past Due",
    canceled: "Canceled",
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-title-md">Current Plan</h3>
          <p className="text-2xl font-semibold mt-1">
            {planData?.name || "Free"}
            {planData && (
              <span className="text-base font-normal text-muted ml-1">
                /{formatDate(new Date()).split(",")[0].toLowerCase().split(" ")[1]}
              </span>
            )}
          </p>
        </div>

        {status && status !== "active" && (
          <span
            className={`px-3 py-1 rounded-full text-caption-uppercase ${
              statusColors[status] || "bg-surface-strong text-muted"
            }`}
          >
            {statusLabels[status] || status}
          </span>
        )}
      </div>

      {planData && (
        <>
          <div className="flex items-center gap-2 text-body-sm text-muted mb-4">
            <CreditCard className="w-4 h-4" />
            <span>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(planData.price / 100)}
              /month
            </span>
          </div>

          {renewalDate && (
            <div className="flex items-center gap-2 text-body-sm text-muted mb-4">
              <Calendar className="w-4 h-4" />
              <span>Renews {formatDate(renewalDate)}</span>
            </div>
          )}
        </>
      )}

      <div className="border-t border-hairline pt-4 mt-4">
        <div className="flex justify-between text-body-sm mb-2">
          <span className="text-muted">Profiles used</span>
          <span>
            {profilesUsed} / {profilesMax}
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-surface-strong overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{
              width: `${Math.min(100, (profilesUsed / profilesMax) * 100)}%`,
            }}
          />
        </div>
      </div>

      {plan !== "free" && onManagePortal && (
        <Button
          variant="outline"
          onClick={onManagePortal}
          icon={ExternalLink}
          iconPosition="right"
          className="w-full mt-4"
        >
          Manage Subscription
        </Button>
      )}
    </div>
  );
}
