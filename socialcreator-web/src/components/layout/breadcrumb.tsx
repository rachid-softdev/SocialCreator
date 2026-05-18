"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@socialcreator/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cn("flex items-center gap-2 text-caption text-muted", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-ink transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}