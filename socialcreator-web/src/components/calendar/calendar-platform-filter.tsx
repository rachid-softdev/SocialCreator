/**
 * Calendar Platform Filter
 * A row of clickable platform chips for filtering the calendar grid by platform.
 * Shows a count badge for each platform.
 */

"use client";

import { PLATFORMS } from "@socialcreator/types/profile";
import { cn } from "@socialcreator/utils";

interface CalendarPlatformFilterProps {
  selected: string | null; // null = all
  onChange: (platform: string | null) => void;
  counts: Record<string, number>;
}

export function CalendarPlatformFilter({
  selected,
  onChange,
  counts,
}: CalendarPlatformFilterProps) {
  const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* All chips */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border text-caption font-medium transition-colors",
          selected === null
            ? "bg-ink text-on-primary border-ink"
            : "border-hairline text-ink hover:bg-surface-strong",
        )}
      >
        All
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[11px] px-1",
            selected === null
              ? "bg-on-primary/20 text-on-primary"
              : "bg-surface-strong text-muted",
          )}
        >
          {totalCount}
        </span>
      </button>

      {/* Platform chips */}
      {PLATFORMS.map((platform) => {
        const platformCount = counts[platform.value] ?? 0;
        const isSelected = selected === platform.value;

        return (
          <button
            key={platform.value}
            type="button"
            onClick={() => onChange(isSelected ? null : platform.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border text-caption font-medium transition-colors",
              isSelected
                ? "bg-ink text-on-primary border-ink"
                : "border-hairline text-ink hover:bg-surface-strong",
            )}
          >
            <span>{platform.label}</span>
            {platformCount > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[11px] px-1",
                  isSelected
                    ? "bg-on-primary/20 text-on-primary"
                    : "bg-surface-strong text-muted",
                )}
              >
                {platformCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
