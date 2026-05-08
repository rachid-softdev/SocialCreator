"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

interface BadgePillProps {
  children: ReactNode;
  className?: string;
}

export function BadgePill({ children, className }: BadgePillProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-pill bg-surface-strong px-[10px] py-1 text-caption-uppercase text-ink",
        className
      )}
    >
      {children}
    </span>
  );
}