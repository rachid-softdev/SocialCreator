"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "./sidebar";

export function MobileHeader({
  user,
}: {
  user?: { name?: string | null; image?: string | null } | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden h-16 flex items-center gap-4 px-4 border-b border-hairline bg-canvas sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          className="p-1 -ml-1 rounded-lg hover:bg-surface-strong transition-colors"
        >
          <Menu className="w-6 h-6 text-ink" />
        </button>
        <span className="font-display text-title-md text-ink">SocialCreator</span>
      </header>

      {/* Sidebar (mobile drawer mode) */}
      <Sidebar user={user} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
