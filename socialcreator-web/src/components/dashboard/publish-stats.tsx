"use client";

import { cn } from "@socialcreator/utils";
import { Platform } from "@prisma/client";
import { getPlatformName } from "@/components/connected-accounts/platform-icon";
import { AlertCircle, TrendingUp } from "lucide-react";

interface PublishStatsProps {
  stats: Array<{
    platform: Platform;
    count: number;
    max: number;
    allowed: boolean;
  }>;
  title?: string;
  showWarnings?: boolean;
}

export function PublishStats({
  stats,
  title = "Publication Limits",
  showWarnings = true,
}: PublishStatsProps) {
  // Filter to only platforms with activity or configured
  const activePlatforms = stats.filter((s) => s.max > 0);

  if (activePlatforms.length === 0) {
    return (
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <h3 className="text-title-sm text-ink mb-4">{title}</h3>
        <p className="text-body-sm text-muted">No active platform connections yet</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl border border-hairline p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-muted" />
        <h3 className="text-title-sm text-ink">{title}</h3>
      </div>

      <div className="space-y-4">
        {activePlatforms.map((stat) => {
          const percentage = (stat.count / stat.max) * 100;
          const isNearLimit = percentage >= 75;
          const isAtLimit = !stat.allowed;

          return (
            <div key={stat.platform} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-ink">{getPlatformName(stat.platform)}</span>
                <span
                  className={cn(
                    "text-caption font-medium",
                    isAtLimit
                      ? "text-semantic-error"
                      : isNearLimit
                        ? "text-amber-600"
                        : "text-muted",
                  )}
                >
                  {stat.count}/{stat.max}
                </span>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-surface-strong rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                    isAtLimit
                      ? "bg-semantic-error"
                      : isNearLimit
                        ? "bg-amber-500"
                        : "bg-semantic-success",
                  )}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              {/* Warning indicator */}
              {showWarnings && isNearLimit && !isAtLimit && (
                <div className="flex items-center gap-1 text-caption text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  <span>Limit approaching</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily total */}
      <div className="mt-6 pt-4 border-t border-hairline">
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted">Total today</span>
          <span className="text-body-sm text-ink font-medium">
            {activePlatforms.reduce((sum, s) => sum + s.count, 0)} posts
          </span>
        </div>
      </div>
    </div>
  );
}
