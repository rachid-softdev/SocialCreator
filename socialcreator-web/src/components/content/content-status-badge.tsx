"use client";

import type { ContentStatus } from "@prisma/client";
import { CONTENT_STATUS_COLORS, CONTENT_STATUS_LABELS } from "@socialcreator/types/profile";
import { cn } from "@socialcreator/utils";

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
        className,
      )}
    >
      {CONTENT_STATUS_LABELS[status]}
    </span>
  );
}
