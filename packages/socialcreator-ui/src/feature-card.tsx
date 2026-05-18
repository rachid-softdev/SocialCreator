"use client";

import { cn } from "@socialcreator/utils";
import type { ReactNode } from "react";

interface FeatureCardProps {
  children: ReactNode;
  className?: string;
}

export function FeatureCard({ children, className }: FeatureCardProps) {
  return (
    <div className={cn("rounded-xl border border-hairline bg-surface-card p-lg transition-shadow hover:shadow-card-hover", className)}>
      {children}
    </div>
  );
}