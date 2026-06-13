"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import ErrorBoundary from "@/components/error-boundary";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Toggle keyboard shortcuts with ? key (when not in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if (e.key === "?" || ((e.metaKey || e.ctrlKey) && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <CommandPalette />
      <KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
}
