"use client";

import { cn } from "@socialcreator/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success";
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = "default", className, children }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors";
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary-foreground",
    outline: "border border-hairline-strong text-ink",
    destructive: "bg-semantic-error/10 text-semantic-error",
    success: "bg-semantic-success/10 text-semantic-success",
  };

  return <span className={cn(baseStyles, variantStyles[variant], className)}>{children}</span>;
}