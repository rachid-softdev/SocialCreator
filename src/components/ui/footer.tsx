"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface FooterColumn {
  title: string;
  links: { href: string; label: string }[];
}

interface FooterProps {
  columns?: FooterColumn[];
}

export function Footer({ columns = [] }: FooterProps) {
  return (
    <footer className="border-t border-hairline bg-canvas px-xxl py-xl">
      <div className="mx-auto max-w-content">
        <div className="grid grid-cols-1 gap-xl md:grid-cols-5">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-sm text-caption-uppercase text-muted">{column.title}</h3>
              <ul className="space-y-xs">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-body-sm text-body transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-xl border-t border-hairline pt-lg">
          <p className="text-caption text-muted">
            © {new Date().getFullYear()} SocialCreator. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}