"use client";

import type { RunStatus } from "@socialcreator/types/agent";
import { RUN_STATUS_COLORS, RUN_STATUS_LABELS } from "@socialcreator/types/agent";
import { cn } from "@socialcreator/utils";

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
  showPulse?: boolean;
}

export function RunStatusBadge({ status, className, showPulse = true }: RunStatusBadgeProps) {
  const isRunning = status === "RUNNING";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-medium",
        RUN_STATUS_COLORS[status],
        isRunning && showPulse && "animate-pulse",
        className,
      )}
    >
      {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {RUN_STATUS_LABELS[status]}
    </span>
  );
}
