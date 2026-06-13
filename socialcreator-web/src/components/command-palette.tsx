"use client";

import {
  BarChart3,
  Bot,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
}

const defaultItems: CommandItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    action: () => (window.location.href = "/dashboard"),
    shortcut: "G D",
  },
  {
    id: "profiles",
    label: "Profiles",
    icon: Users,
    action: () => (window.location.href = "/profiles"),
    shortcut: "G P",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Bot,
    action: () => (window.location.href = "/agents"),
    shortcut: "G A",
  },
  {
    id: "content",
    label: "Content",
    icon: FileText,
    action: () => (window.location.href = "/content"),
    shortcut: "G C",
  },
  {
    id: "calendar",
    label: "Content Calendar",
    description: "View scheduled content",
    icon: Calendar,
    action: () => (window.location.href = "/content/calendar"),
  },
  {
    id: "queue",
    label: "Publish Queue",
    description: "Review pending publications",
    icon: Clock,
    action: () => (window.location.href = "/content/queue"),
  },
  {
    id: "history",
    label: "Content History",
    description: "View published content",
    icon: History,
    action: () => (window.location.href = "/content/history"),
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    action: () => (window.location.href = "/analytics"),
    shortcut: "G N",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    action: () => (window.location.href = "/settings"),
    shortcut: "G S",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    action: () => (window.location.href = "/settings/billing"),
    shortcut: "G B",
  },
  {
    id: "new-profile",
    label: "New Profile",
    description: "Create a new brand profile",
    icon: Plus,
    action: () => (window.location.href = "/profiles/new"),
  },
  {
    id: "new-agent",
    label: "New Agent",
    description: "Create a new content agent",
    icon: Plus,
    action: () => (window.location.href = "/profiles"),
  },
  {
    id: "generate-content",
    label: "Generate Content",
    description: "Create new content with AI",
    icon: Plus,
    action: () => (window.location.href = "/content/generate"),
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build items with router navigation
  const items = defaultItems.map((item) => ({
    ...item,
    action: () => {
      router.push(
        item.action.toString().replace("window.location.href = ", "").replace(/['"]/g, ""),
      );
      setOpen(false);
    },
  }));

  // Filter items by query
  const filtered = query.trim()
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  // Keyboard: toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay so the dialog renders first
      requestAnimationFrame(() => inputRef.current?.focus());
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation within palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].action();
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Cycle through items with Tab
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      }
    },
    [filtered, selectedIndex],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        aria-label="Close search"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative z-10 w-full max-w-lg bg-surface-card rounded-xl border border-hairline shadow-xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-hairline">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions…"
            className="flex-1 h-12 bg-transparent text-body-md text-ink placeholder:text-muted-soft outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption text-muted bg-surface-strong">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-body-sm text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-surface-strong text-ink"
                      : "text-muted hover:text-ink hover:bg-surface-strong/50"
                  }`}
                >
                  {Icon && (
                    <div className="w-8 h-8 rounded-lg bg-surface-strong flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-body-sm text-ink truncate">{item.label}</div>
                    {item.description && (
                      <div className="text-caption text-muted truncate">{item.description}</div>
                    )}
                  </div>
                  {item.shortcut && (
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption text-muted bg-surface-strong shrink-0">
                      {item.shortcut.split(" ").map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-0.5">+</span>}
                          <span>{key}</span>
                        </span>
                      ))}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-hairline bg-canvas-soft">
          <span className="text-caption text-muted-soft">
            <kbd className="px-1 py-0.5 rounded bg-surface-strong text-caption">↑↓</kbd> Navigate
          </span>
          <span className="text-caption text-muted-soft">
            <kbd className="px-1 py-0.5 rounded bg-surface-strong text-caption">↵</kbd> Open
          </span>
          <span className="text-caption text-muted-soft">
            <kbd className="px-1 py-0.5 rounded bg-surface-strong text-caption">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
