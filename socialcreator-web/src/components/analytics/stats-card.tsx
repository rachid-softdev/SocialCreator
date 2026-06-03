"use client";

import { cn } from "@socialcreator/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  trend?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

export function StatsCard({ label, value, trend, icon: Icon }: StatsCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  const trendColors = {
    positive: "text-semantic-success",
    negative: "text-semantic-error",
    flat: "text-muted",
  };

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption text-muted">{label}</p>
          <p className="text-xl font-semibold mt-1">{value}</p>
        </div>

        {Icon && <Icon className="w-5 h-5 text-muted" />}
      </div>

      {trend !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-body-sm",
            trendColors[isPositive ? "positive" : isNegative ? "negative" : "flat"],
          )}
        >
          <TrendIcon className="w-4 h-4" />
          <span>
            {isPositive ? "+" : ""}
            {trend}%
          </span>
          <span className="text-muted ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
}
