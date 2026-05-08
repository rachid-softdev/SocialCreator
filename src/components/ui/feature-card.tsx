"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

interface FeatureCardProps {
  children: ReactNode;
  className?: string;
}

export function FeatureCard({ children, className }: FeatureCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-hairline bg-surface-card p-lg transition-shadow",
        "hover:shadow-card-hover",
        className
      )}
    >
      {children}
    </div>
  );
}