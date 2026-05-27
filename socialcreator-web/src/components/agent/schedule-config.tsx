"use client";

import { Button } from "@socialcreator/ui/button";
import { cn } from "@socialcreator/utils";
import { AlertCircle, CheckCircle, Clock, Pause, Play } from "lucide-react";
import { useState } from "react";
import { describeCron, formatNextRun, getNextExecution, isValidCron } from "@/lib/cron";

interface ScheduleConfigProps {
  agentId: string;
  initialSchedule?: string | null;
  isActive?: boolean;
  onSave: (schedule: string | null) => Promise<void>;
}

export function ScheduleConfig({
  agentId,
  initialSchedule,
  isActive = true,
  onSave,
}: ScheduleConfigProps) {
  const [schedule, setSchedule] = useState(initialSchedule || "");
  const [isEnabled, setIsEnabled] = useState(!!initialSchedule);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const nextRun = schedule && isValidCron(schedule) ? getNextExecution(schedule) : null;
  const isValidSchedule = !schedule || isValidCron(schedule);
  const cronDescription = schedule ? describeCron(schedule) : null;

  const handleToggle = async () => {
    if (!isEnabled && schedule && !isValidCron(schedule)) {
      setError("Invalid cron expression");
      return;
    }

    const newSchedule = isEnabled ? null : schedule || "0 * * * *";
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await onSave(newSchedule);
      setIsEnabled(!isEnabled);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSchedule(value);
    setError(null);

    if (value && !isValidCron(value)) {
      setError("Invalid cron expression");
    }
  };

  const handleTestSchedule = () => {
    if (!schedule || !isValidCron(schedule)) {
      setError("Enter a valid cron expression to test");
      return;
    }
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Toggle + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isActive && isEnabled ? "bg-semantic-success/10" : "bg-surface-strong",
            )}
          >
            <Clock
              className={cn(
                "w-5 h-5",
                isActive && isEnabled ? "text-semantic-success" : "text-muted",
              )}
            />
          </div>
          <div>
            <h3 className="text-body-strong text-ink">Schedule</h3>
            <p className="text-caption text-muted">
              {isActive && isEnabled ? "Active" : "Disabled"}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isSaving}
          className={cn(
            "relative w-12 h-6 rounded-full transition-colors",
            isEnabled ? "bg-semantic-success" : "bg-surface-strong",
            isSaving && "opacity-50",
          )}
        >
          <span
            className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm",
              isEnabled ? "translate-x-7" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {/* Schedule Input */}
      {isEnabled && (
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-muted mb-2">Cron Expression</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={schedule}
                onChange={handleScheduleChange}
                placeholder="0 * * * *"
                className={cn(
                  "flex-1 px-3 py-2 rounded-lg border text-body-sm font-mono",
                  !isValidSchedule
                    ? "border-semantic-error bg-semantic-error/5"
                    : "border-hairline bg-surface-card",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20",
                )}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSchedule}
                disabled={!schedule || !isValidCron(schedule)}
              >
                Test
              </Button>
            </div>
            {cronDescription && isValidSchedule && (
              <p className="text-caption text-muted mt-2">{cronDescription}</p>
            )}
          </div>

          {/* Next Run */}
          {nextRun && (
            <div className="flex items-center gap-2 p-3 bg-surface-soft rounded-lg">
              {isActive ? (
                <>
                  <Play className="w-4 h-4 text-semantic-success" />
                  <span className="text-caption text-muted">
                    Next run: <span className="text-ink font-medium">{formatNextRun(nextRun)}</span>
                  </span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 text-muted" />
                  <span className="text-caption text-muted">
                    Schedule will run when agent is active
                  </span>
                </>
              )}
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 text-semantic-error text-caption">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-semantic-success text-caption">
              <CheckCircle className="w-4 h-4" />
              Schedule saved
            </div>
          )}
        </div>
      )}

      {/* Presets */}
      {isEnabled && (
        <div>
          <label className="block text-caption text-muted mb-2">Presets</label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Every hour", value: "0 * * * *" },
              { label: "Every 6 hours", value: "0 */6 * * *" },
              { label: "Daily at 9am", value: "0 9 * * *" },
              { label: "Daily at 9am & 6pm", value: "0 9,18 * * *" },
              { label: "Weekdays 9am", value: "0 9 * * 1-5" },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSchedule(preset.value)}
                className={cn(
                  "px-3 py-1.5 rounded-pill text-caption border transition-colors",
                  schedule === preset.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-hairline text-muted hover:border-primary hover:text-primary",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
