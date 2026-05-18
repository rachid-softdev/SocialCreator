"use client";

import { cn } from "@socialcreator/utils";
import type { ReactNode } from "react";

const gradientColors = {
  mint: "from-gradient-mint/40 to-gradient-mint/0",
  peach: "from-gradient-peach/40 to-gradient-peach/0",
  lavender: "from-gradient-lavender/40 to-gradient-lavender/0",
  sky: "from-gradient-sky/40 to-gradient-sky/0",
  rose: "from-gradient-rose/40 to-gradient-rose/0",
};

interface GradientOrbProps {
  color: keyof typeof gradientColors;
  children?: ReactNode;
  className?: string;
}

export function GradientOrb({ color, children, className }: GradientOrbProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-xxl bg-canvas-soft", className)}>
      <div
        className={cn("absolute inset-0 bg-gradient-to-br opacity-60", gradientColors[color])}
        style={{ filter: "blur(60px)", transform: "scale(1.2)" }}
      />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}