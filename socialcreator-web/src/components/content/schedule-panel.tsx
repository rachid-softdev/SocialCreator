"use client";

import { formatDateTime } from "@socialcreator/utils";
import { AlertCircle, Calendar, Clock, Loader2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { DateTimePicker } from "./date-time-picker";
import { TimezoneSelect } from "./timezone-select";

type ScheduleState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "scheduled"; date: Date; tz: string }
  | { status: "cancelling" }
  | { status: "error"; message: string };

interface SchedulePanelProps {
  contentId: string;
  initialSchedule: {
    scheduledPublishAt?: string | Date | null;
    scheduledTimezone?: string;
  } | null;
  onScheduled: () => void;
}

/**
 * SchedulePanel manages scheduling and cancelling publication.
 *
 * State machine:
 *   idle → submitting → scheduled | error
 *   scheduled → cancelling → idle | error
 */
export function SchedulePanel({ contentId, initialSchedule, onScheduled }: SchedulePanelProps) {
  const [state, setState] = useState<ScheduleState>(() => {
    if (initialSchedule?.scheduledPublishAt) {
      return {
        status: "scheduled",
        date: new Date(initialSchedule.scheduledPublishAt),
        tz: initialSchedule.scheduledTimezone || "UTC",
      };
    }
    return { status: "idle" };
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTz, setSelectedTz] = useState("UTC");

  const handleSchedule = useCallback(async () => {
    if (!selectedDate) return;

    setState({ status: "submitting" });

    try {
      const response = await fetch(`/api/content/${contentId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledPublishAt: selectedDate.toISOString(),
          scheduledTimezone: selectedTz,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({ status: "error", message: data.error || "Failed to schedule" });
        return;
      }

      setState({ status: "scheduled", date: selectedDate, tz: selectedTz });
      onScheduled();
    } catch {
      setState({ status: "error", message: "Network error occurred" });
    }
  }, [contentId, selectedDate, selectedTz, onScheduled]);

  const handleCancel = useCallback(async () => {
    const prevState = state;
    setState({ status: "cancelling" });
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/content/${contentId}/schedule`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // Revert to previous state with error
        setState({ status: "error", message: data.error || "Failed to cancel schedule" });
        return;
      }

      setState({ status: "idle" });
      setSelectedDate(null);
      setSelectedTz("UTC");
      onScheduled();
    } catch {
      setState({
        status:
          prevState.status === "scheduled"
            ? prevState
            : { status: "error", message: "Network error occurred" },
      });
    }
  }, [contentId, onScheduled, state]);

  // ----- Scheduled state -----
  if (state.status === "scheduled") {
    return (
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-title-sm text-ink">Scheduled for publication</span>
            </div>
            <p className="text-body-sm text-body">
              {formatDateTime(state.date)} ({state.tz})
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-semantic-error/10 text-semantic-error text-button hover:bg-semantic-error/20 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel Schedule
          </button>
        </div>
      </div>
    );
  }

  // ----- Cancelling state -----
  if (state.status === "cancelling") {
    return (
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted" />
          <span className="text-body-sm text-muted">Cancelling schedule...</span>
        </div>
      </div>
    );
  }

  // ----- Idle / Submitting / Error states -----
  const isSubmitting = state.status === "submitting";
  const apiError = state.status === "error" ? state.message : null;
  const canSchedule = selectedDate !== null && !isSubmitting;

  return (
    <div className="bg-surface-card rounded-xl border border-hairline p-6 space-y-4">
      <h3 className="text-title-sm text-ink flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Schedule Publication
      </h3>

      <DateTimePicker value={selectedDate} onChange={setSelectedDate} minDate={new Date()} />

      <TimezoneSelect value={selectedTz} onChange={setSelectedTz} />

      {/* Inline error */}
      {apiError && (
        <div className="flex items-start gap-2 text-semantic-error bg-semantic-error/5 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="text-body-sm">{apiError}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleSchedule}
        disabled={!canSchedule}
        className="inline-flex items-center gap-2 px-6 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
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
  );
}
