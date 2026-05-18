"use client";

import { cn } from "@socialcreator/utils";
import Link from "next/link";
import type { ReactNode } from "react";

interface NavTopProps {
  links?: { href: string; label: string }[];
  cta?: { href: string; label: string };
}

export function NavTop({ links = [], cta }: NavTopProps) {
  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-hairline bg-canvas px-lg">
      <Link href="/" className="flex items-center gap-2">
        <span className="font-display text-title-md text-ink">SocialCreator</span>
      </Link>
      {links.length > 0 && (
        <div className="hidden items-center gap-lg md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-nav-link text-ink transition-colors hover:text-body">
              {link.label}
            </Link>
          ))}
        </div>
      )}
      {cta && (
        <Link href={cta.href} className={cn("flex h-10 items-center rounded-pill bg-primary px-xl py-0 text-button text-on-primary transition-colors hover:bg-primary-active")}>
          {cta.label}
        </Link>
      )}
    </nav>
  );
}