"use client";

import { cn } from "@socialcreator/utils";

interface StatsCardProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

export function StatsCard({ label, value, icon, trend }: StatsCardProps) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-card p-4 flex items-start justify-between">
      <div>
        <p className="text-caption text-muted mb-1">{label}</p>
        <p className="text-display-sm text-ink font-semibold">{value.toLocaleString()}</p>
        {trend && (
          <p
            className={cn("text-caption mt-1", trend.positive ? "text-green-600" : "text-red-600")}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}%
          </p>
        )}
      </div>
      {icon && <div className="text-muted">{icon}</div>}
    </div>
  );
}
