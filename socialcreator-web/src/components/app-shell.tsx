"use client";

import type { ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import ErrorBoundary from "@/components/error-boundary";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <>
      <CommandPalette />
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
}
