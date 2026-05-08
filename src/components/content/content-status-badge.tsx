"use client";

import { cn } from "@/lib/utils";
import type { ContentStatus } from "@prisma/client";
import { CONTENT_STATUS_LABELS, CONTENT_STATUS_COLORS } from "@/types/profile";

interface ContentStatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

export function ContentStatusBadge({ status, className }: ContentStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium",
        CONTENT_STATUS_COLORS[status],
        className
      )}
    >
      {CONTENT_STATUS_LABELS[status]}
    </span>
  );
}
