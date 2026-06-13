"use client";

import { Keyboard } from "lucide-react";
import { useEffect } from "react";

interface ShortcutRow {
  keys: string[][];
  description: string;
}

interface ShortcutGroup {
  name: string;
  shortcuts: ShortcutRow[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    name: "Navigation",
    shortcuts: [
      { keys: [["⌘", "D"]], description: "Dashboard" },
      { keys: [["⌘", "P"]], description: "Profiles" },
      { keys: [["⌘", "A"]], description: "Agents" },
      { keys: [["⌘", "C"]], description: "Content" },
      { keys: [["⌘", "N"]], description: "Analytics" },
      { keys: [["⌘", "S"]], description: "Settings" },
      { keys: [["⌘", "B"]], description: "Billing" },
    ],
  },
  {
    name: "Actions",
    shortcuts: [
      { keys: [["⌘", "K"]], description: "Command palette" },
      { keys: [["⌘", "/"], ["?"]], description: "Show this help" },
    ],
  },
  {
    name: "General",
    shortcuts: [
      { keys: [["↑", "↓"]], description: "Navigate lists" },
      { keys: [["↵"]], description: "Select / Open" },
      { keys: [["Esc"]], description: "Close modal" },
    ],
  },
];

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        aria-label="Close keyboard shortcuts"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-lg bg-surface-card rounded-xl border border-hairline shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="w-8 h-8 rounded-lg bg-surface-strong flex items-center justify-center shrink-0">
            <Keyboard className="w-4 h-4 text-muted" />
          </div>
          <h2 className="text-body-md text-ink font-medium">Keyboard Shortcuts</h2>
        </div>

        {/* Groups */}
        <div className="px-2 pb-2">
          {shortcutGroups.map((group) => (
            <div key={group.name}>
              {/* Category header */}
              <div className="px-3 pt-3 pb-1.5 text-caption text-muted-soft font-medium uppercase tracking-wider">
                {group.name}
              </div>

              {/* Shortcut rows */}
              {group.shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-strong/50 transition-colors"
                >
                  <span className="text-body-sm text-ink">{shortcut.description}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {shortcut.keys.map((combo, ci) => (
                      <span key={ci} className="flex items-center gap-0.5">
                        {ci > 0 && <span className="text-caption text-muted-soft mx-0.5">or</span>}
                        {combo.map((key, ki) => (
                          <kbd
                            key={ki}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-caption text-muted bg-surface-strong"
                          >
                            {key}
                          </kbd>
                        ))}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-end gap-4 px-5 py-3 border-t border-hairline bg-canvas-soft">
          <span className="text-caption text-muted-soft">
            <kbd className="px-1 py-0.5 rounded bg-surface-strong text-caption">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
