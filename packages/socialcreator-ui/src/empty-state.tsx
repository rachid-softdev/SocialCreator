"use client";

import { cn } from "@socialcreator/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-16 px-8", className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-muted" />
        </div>
      )}
      <h3 className="text-title-md text-ink mb-2">{title}</h3>
      <p className="text-body-md text-muted mb-6 max-w-sm">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
