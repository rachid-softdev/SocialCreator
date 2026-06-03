"use client";

import { cn } from "@socialcreator/utils";
import { useEffect, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { useQueueStore } from "@/lib/stores/queue-store";

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  queued: { label: "Queued", className: "bg-blue-100 text-blue-800" },
  running: { label: "Running", className: "bg-yellow-100 text-yellow-800" },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800",
  },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
};

const PRIORITY_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  critical: { label: "Critical", className: "bg-red-100 text-red-800" },
  high: { label: "High", className: "bg-orange-100 text-orange-800" },
  normal: { label: "Normal", className: "bg-gray-100 text-gray-800" },
  low: { label: "Low", className: "bg-gray-50 text-gray-500" },
};

const STAT_CARDS = [
  {
    key: "queued" as const,
    label: "Queued",
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "running" as const,
    label: "Running",
    icon: Loader2,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
  },
  {
    key: "completed" as const,
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    key: "failed" as const,
    label: "Failed",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
];

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return "-";
  const date = new Date(ts);
  return date.toLocaleString();
}

export function QueueDashboard() {
  const {
    status,
    jobs,
    isLoading,
    error,
    autoRefresh,
    fetchStatus,
    fetchJobs,
    retryJob,
    setAutoRefresh,
  } = useQueueStore();

  const refreshAll = useCallback(() => {
    fetchStatus();
    fetchJobs();
  }, [fetchStatus, fetchJobs]);

  // Initial fetch + auto-refresh interval
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refreshAll, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const handleRetry = async (jobId: string) => {
    await retryJob(jobId);
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-title-md text-ink font-semibold">
          Queue Overview
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-body-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-hairline"
            />
            Auto-refresh (5s)
          </label>
          <button
            type="button"
            onClick={refreshAll}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline bg-surface-card text-body-sm text-ink hover:bg-surface-strong transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-body-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const value = status?.[card.key] ?? 0;
          return (
            <div
              key={card.key}
              className={cn(
                "rounded-xl border border-hairline bg-surface-card p-5 flex items-center gap-4",
              )}
            >
              <div
                className={cn(
                  "rounded-lg p-3",
                  card.bg,
                )}
              >
                <Icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div>
                <p className="text-caption text-muted">{card.label}</p>
                <p className="text-display-sm text-ink font-semibold">
                  {value.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total from status */}
      {status && (
        <p className="text-body-sm text-muted">
          Total jobs in queue:{" "}
          <span className="font-medium text-ink">{status.total}</span>
        </p>
      )}

      {/* Jobs table */}
      <div className="bg-surface-card border border-hairline rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-hairline">
          <h3 className="text-title-sm text-ink font-medium">Jobs</h3>
        </div>

        {isLoading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-body-sm text-muted">No jobs in the queue.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-hairline-soft bg-surface-strong/50">
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    ID
                  </th>
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    Priority
                  </th>
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    Attempts
                  </th>
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    Created
                  </th>
                  <th className="text-left px-6 py-3 text-caption text-muted font-medium">
                    Completed
                  </th>
                  <th className="text-right px-6 py-3 text-caption text-muted font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-soft">
                {jobs.map((job) => {
                  const statusBadge = STATUS_BADGE[job.status] ?? {
                    label: job.status,
                    className: "bg-gray-100 text-gray-800",
                  };
                  const priorityBadge = PRIORITY_BADGE[job.priority] ?? {
                    label: job.priority,
                    className: "bg-gray-100 text-gray-800",
                  };

                  return (
                    <tr key={job.id} className="hover:bg-surface-strong/30">
                      <td className="px-6 py-4 text-body-sm text-ink font-mono truncate max-w-[120px]">
                        {job.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-body-sm text-ink capitalize">
                        {job.type}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-caption font-medium",
                            statusBadge.className,
                          )}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-caption font-medium",
                            priorityBadge.className,
                          )}
                        >
                          {priorityBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-body-sm text-ink">
                        {job.attempts}/{job.maxAttempts}
                      </td>
                      <td className="px-6 py-4 text-body-sm text-muted whitespace-nowrap">
                        {formatTimestamp(job.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-body-sm text-muted whitespace-nowrap">
                        {formatTimestamp(job.completedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {job.status === "failed" && (
                          <button
                            type="button"
                            onClick={() => handleRetry(job.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-hairline bg-surface-card text-body-sm text-ink hover:bg-surface-strong transition-colors"
                            title="Retry job"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job errors section */}
      {jobs.some((j) => j.error) && (
        <div className="bg-surface-card border border-hairline rounded-xl p-6">
          <h3 className="text-title-sm text-ink font-medium mb-4">
            Recent Errors
          </h3>
          <div className="space-y-2">
            {jobs
              .filter((j) => j.error)
              .slice(0, 5)
              .map((job) => (
                <div
                  key={`error-${job.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100"
                >
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-red-800">
                      {job.type} — {job.id.slice(0, 8)}...
                    </p>
                    <p className="text-caption text-red-600 mt-0.5 break-words">
                      {job.error}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRetry(job.id)}
                    className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-white text-caption text-red-700 hover:bg-red-50 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
