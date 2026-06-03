/**
 * Calendar Event Detail Popover
 * Small popover/card that appears when clicking an event badge in the calendar grid.
 * Shows full text content, platform badge, status badge, scheduled time, and a link
 * to the content editor.
 */

"use client";

import { cn } from "@socialcreator/utils";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { CalendarEvent } from "@/components/content/calendar-view";

interface CalendarEventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
  position: { top: number; left: number };
}

/**
 * Returns a status color class string matching the project's badge patterns.
 */
function statusColor(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "bg-blue-100 text-blue-800";
    case "DRAFT":
      return "bg-gray-100 text-gray-700";
    case "APPROVED":
    case "PUBLISHED":
      return "bg-green-100 text-green-800";
    case "FAILED":
    case "REJECTED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

const MAX_PREVIEW_CHARS = 100;

export function CalendarEventDetail({
  event,
  onClose,
  position,
}: CalendarEventDetailProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fullText = event.textContent || event.title || "Untitled";
  const isTruncatable = fullText.length > MAX_PREVIEW_CHARS;
  const displayText = expanded || !isTruncatable ? fullText : `${fullText.slice(0, MAX_PREVIEW_CHARS).trimEnd()}...`;

  const formattedTime = format(new Date(event.scheduledAt), "MMM d, yyyy 'at' h:mm a");

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-72 bg-surface-card border border-hairline rounded-xl shadow-card-hover p-4"
      style={{ top: position.top, left: position.left }}
    >
      {/* Text content */}
      <div className="mb-3">
        <p className="text-body-sm text-ink whitespace-pre-wrap break-words">
          {displayText}
        </p>
        {isTruncatable && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-1 text-caption text-primary hover:text-primary-active transition-colors"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Platform + Status badges */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
            "bg-surface-strong text-ink",
          )}
        >
          {event.platform}
        </span>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
            statusColor(event.status),
          )}
        >
          {event.status}
        </span>
      </div>

      {/* Scheduled time */}
      <p className="text-caption text-muted mb-3">{formattedTime}</p>

      {/* Link to content editor */}
      <Link
        href={`/content/${event.id}`}
        className="inline-flex items-center gap-1.5 text-caption text-primary hover:text-primary-active transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View full content
      </Link>
    </div>
  );
}
