/**
 * Today's Upcoming Schedule List
 * Renders a panel below the calendar grid showing events scheduled for today,
 * sorted by time ascending. Displays time, platform, and truncated text content.
 */

"use client";

import { cn } from "@socialcreator/utils";
import { format, isToday } from "date-fns";
import { Calendar } from "lucide-react";

import type { CalendarEvent } from "@/components/content/calendar-view";

interface TodayScheduleListProps {
  events: CalendarEvent[];
}

/**
 * Truncate text to a max length for list display.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}...`;
}

export function TodayScheduleList({ events }: TodayScheduleListProps) {
  // Filter events scheduled for today
  const todayEvents = events
    .filter((e) => isToday(new Date(e.scheduledAt)))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  if (todayEvents.length === 0) {
    return (
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <h3 className="text-title-sm text-ink font-display mb-4">Today's Schedule</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted">
          <Calendar className="w-8 h-8 mb-2" />
          <p className="text-body-sm">No items scheduled for today</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-6">
      <h3 className="text-title-sm text-ink font-display mb-4">Today's Schedule</h3>
      <div className="space-y-2">
        {todayEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-4 rounded-lg border border-hairline bg-canvas px-4 py-3"
          >
            {/* Time */}
            <div className="flex-shrink-0 w-12 text-center">
              <span className="text-caption font-medium text-ink">
                {format(new Date(event.scheduledAt), "HH:mm")}
              </span>
            </div>

            {/* Platform badge */}
            <span
              className={cn(
                "flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                "bg-surface-strong text-ink",
              )}
            >
              {event.platform}
            </span>

            {/* Text content */}
            <p className="flex-1 min-w-0 text-body-sm text-body truncate">
              {truncate(event.textContent || event.title || "Untitled", 80)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
