"use client";

import { cn } from "@socialcreator/utils";
import type { ReactNode } from "react";

interface PricingTierCardProps {
  children: ReactNode;
  featured?: boolean;
  className?: string;
}

export function PricingTierCard({ children, featured, className }: PricingTierCardProps) {
  return (
    <div className={cn("rounded-xl border p-lg", featured ? "border-transparent bg-surface-dark text-on-dark" : "border-hairline bg-surface-card text-ink", className)}>
      {children}
    </div>
  );
}