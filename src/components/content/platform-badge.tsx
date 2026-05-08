"use client";

import { cn } from "@/lib/utils";
import { PLATFORMS } from "@/types/profile";

interface PlatformBadgeProps {
  platform: string;
  className?: string;
  size?: "sm" | "md";
}

export function PlatformBadge({ platform, className, size = "md" }: PlatformBadgeProps) {
  const platformInfo = PLATFORMS.find((p) => p.value === platform);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-strong text-ink",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-caption",
        className
      )}
    >
      <span>{platformInfo?.icon}</span>
      <span>{platformInfo?.label || platform}</span>
    </span>
  );
}
