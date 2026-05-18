"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ children, className, ...props }: DropdownMenuPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={`z-50 min-w-[8rem] overflow-hidden rounded-md border border-hairline bg-surface-card p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className ?? ""}`}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({ children, className, ...props }: DropdownMenuPrimitive.DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-body-sm outline-none transition-colors focus:bg-surface-strong focus:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className ?? ""}`}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;