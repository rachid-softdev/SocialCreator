/**
 * Calendar View Component
 * Monthly grid showing scheduled content with event dots/badges
 */

"use client";

import { Skeleton } from "@socialcreator/ui/skeleton";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export interface CalendarEvent {
  id: string;
  title: string;
  platform: string;
  status: string;
  scheduledAt: string;
}

const MAX_EVENTS_VISIBLE = 3;

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      try {
        const response = await fetch("/api/v1/content?status=SCHEDULED&pageSize=500");
        if (!response.ok) throw new Error("Failed to fetch scheduled content");
        const data = await response.json();

        if (!cancelled) {
          const contents = data.contents ?? [];
          const mapped: CalendarEvent[] = contents.map((c: any) => ({
            id: c.id,
            title: truncateText(c.textContent || "Untitled", 60),
            platform: c.platform,
            status: c.status,
            scheduledAt: c.scheduledPublishAt,
          }));
          setEvents(mapped);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load calendar events";
        console.error("Failed to load calendar events:", err);
        if (!cancelled) setFetchError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const goToPrevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const goToNextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Build a map of date -> events for quick lookup
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const eventDate = new Date(event.scheduledAt);
    const key = format(eventDate, "yyyy-MM-dd");
    const existing = eventsByDate.get(key) ?? [];
    existing.push(event);
    eventsByDate.set(key, existing);
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (fetchError) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-body-sm">{fetchError}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-hairline rounded-xl overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
        <h2 className="text-title-md text-ink font-display">{format(currentDate, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1.5 rounded-pill border border-hairline text-caption text-ink hover:bg-surface-strong transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label="Previous month"
            className="p-1.5 rounded-lg hover:bg-surface-strong transition-colors text-muted hover:text-ink"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Next month"
            className="p-1.5 rounded-lg hover:bg-surface-strong transition-colors text-muted hover:text-ink"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Day-of-week Header */}
      <div className="grid grid-cols-7 border-b border-hairline">
        {dayNames.map((name) => (
          <div key={name} className="px-3 py-2 text-caption text-muted text-center font-medium">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(key) ?? [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          const extraCount = Math.max(0, dayEvents.length - MAX_EVENTS_VISIBLE);

          return (
            <div
              key={key}
              className={`min-h-[100px] border-b border-r border-hairline p-2 ${
                !isCurrentMonth ? "bg-surface-strong/50" : ""
              }`}
            >
              {/* Date Number */}
              <div className="flex items-center justify-center mb-1">
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-caption ${
                    isTodayDate
                      ? "bg-primary text-on-primary font-semibold"
                      : isCurrentMonth
                        ? "text-ink"
                        : "text-muted-soft"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvents.slice(0, MAX_EVENTS_VISIBLE).map((event) => (
                  <div
                    key={event.id}
                    className="px-1.5 py-0.5 rounded text-[11px] leading-tight truncate bg-primary/10 text-primary-dark cursor-default"
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {extraCount > 0 && (
                  <div className="px-1.5 text-[11px] text-muted font-medium">
                    +{extraCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Truncate text to a max length, appending "..." if needed */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}
