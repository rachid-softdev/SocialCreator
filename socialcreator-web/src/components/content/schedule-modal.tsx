/**
 * Schedule Modal Component
 * Dialog-based modal for scheduling content publication
 * Uses @socialcreator/ui/dialog for the modal wrapper
 */

"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@socialcreator/ui/dialog";
import { addHours, startOfHour } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useContentStore } from "@/lib/stores/content-store";
import { DateTimePicker } from "./date-time-picker";

interface ScheduleModalProps {
  contentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Rounds a date to the next full hour (60 minutes from now, ceiling).
 * If the result is in the past, adds another hour.
 */
function getDefaultScheduleTime(): Date {
  const now = new Date();
  const nextHour = addHours(startOfHour(now), 1);
  // Ensure the default time is in the future
  if (nextHour <= now) {
    return addHours(nextHour, 1);
  }
  return nextHour;
}

export function ScheduleModal({ contentId, open, onOpenChange }: ScheduleModalProps) {
  const [scheduledDate, setScheduledDate] = useState<Date | null>(getDefaultScheduleTime);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!scheduledDate) return;

    // Validate future date client-side
    if (scheduledDate <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/content/${contentId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledPublishAt: scheduledDate.toISOString(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule content");
      }

      // Update Zustand store
      useContentStore.getState().updateItem(contentId, {
        status: "SCHEDULED",
        scheduledPublishAt: scheduledDate.toISOString(),
      });

      toast.success("Content scheduled successfully", {
        description: `Publication scheduled for ${scheduledDate.toLocaleString()}`,
        duration: 5000,
      });

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule content");
    } finally {
      setIsSaving(false);
    }
  }, [contentId, scheduledDate, onOpenChange]);

  const hasValidDate = scheduledDate !== null && scheduledDate > new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Publication</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <p className="text-body-sm text-muted">
              Choose the date and time for this content to be published.
            </p>
          </div>

          <DateTimePicker value={scheduledDate} onChange={setScheduledDate} minDate={new Date()} />

          {scheduledDate && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-soft">
              <Calendar className="w-4 h-4 text-muted" />
              <span className="text-body-sm text-ink">
                {scheduledDate.toLocaleString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="px-4 py-2 rounded-pill border border-hairline text-button text-ink hover:bg-surface-strong transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasValidDate || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Schedule
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
