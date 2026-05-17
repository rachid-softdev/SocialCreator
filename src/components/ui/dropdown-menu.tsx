"use client";

/**
 * Simple Dropdown Menu implementation
 * For more complex dropdowns, consider using @radix-ui/react-dropdown-menu
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({ children, open, onOpenChange }: DropdownMenuProps) {
  return <div className="relative inline-block">{children}</div>;
}

export function DropdownMenuTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

interface DropdownMenuContentProps {
  align?: "start" | "center" | "end";
  className?: string;
  children: React.ReactNode;
}

export function DropdownMenuContent({
  align = "end",
  className,
  children,
}: DropdownMenuContentProps) {
  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-hairline bg-surface-card p-1 shadow-md",
        alignClass[align],
        "top-full mt-1"
      )}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export function DropdownMenuItem({
  className,
  children,
  onClick,
}: DropdownMenuItemProps) {
  return (
    <button
      className={cn(
        "relative flex w-full select-none items-center rounded-sm px-2 py-1.5 text-body-sm outline-none transition-colors",
        "hover:bg-surface-strong hover:text-ink",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}