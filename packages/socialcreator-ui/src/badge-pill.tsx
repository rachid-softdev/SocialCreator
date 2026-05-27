"use client";

import { cn } from "@socialcreator/utils";
import type { ReactNode } from "react";

interface BadgePillProps {
  children: ReactNode;
  className?: string;
}

export function BadgePill({ children, className }: BadgePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill bg-surface-strong px-[10px] py-1 text-caption-uppercase text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
