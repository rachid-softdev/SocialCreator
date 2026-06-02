"use client";

import { cn } from "@socialcreator/utils";
import {
  BarChart3,
  Bot,
  Calendar,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuthStore, useUIStore } from "@/lib/stores";

interface SidebarProps {
  user?: {
    name?: string | null;
    image?: string | null;
  } | null;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/content", label: "Content", icon: FileText },
  { href: "/content/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar({
  user: propUser,
  isOpen: propIsOpen,
  onClose: propOnClose,
}: SidebarProps) {
  const pathname = usePathname();

  // Prefer Zustand store over props (props kept for backward compat)
  const storeSidebarOpen = useUIStore((s) => s.sidebar === "open");
  const storeToggleSidebar = useUIStore((s) => s.toggleSidebar);
  const storeUser = useAuthStore((s) => s.user);

  const isOpen = propIsOpen ?? storeSidebarOpen;
  const onClose =
    propOnClose ??
    (() => {
      if (storeSidebarOpen) storeToggleSidebar();
    });
  const displayUser =
    propUser ?? (storeUser ? { name: storeUser.name, image: storeUser.image } : null);

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn("fixed inset-0 bg-black/50 z-40 lg:hidden", isOpen ? "block" : "hidden")}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-[256px] bg-canvas border-r border-hairline flex flex-col",
          "transform transition-transform duration-200 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-hairline">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-on-primary" />
          </div>
          <span className="font-display text-title-md text-ink">SocialCreator</span>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-nav-link transition-colors",
                  isActive
                    ? "bg-surface-strong text-ink"
                    : "text-muted hover:text-ink hover:bg-surface-strong/50",
                )}
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-hairline p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-surface-strong flex items-center justify-center text-body-strong text-muted overflow-hidden">
              {displayUser?.image ? (
                <Image
                  src={displayUser.image}
                  alt={displayUser.name || "User"}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                displayUser?.name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm text-ink truncate">{displayUser?.name || "User"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-nav-link text-muted hover:text-ink hover:bg-surface-strong/50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
