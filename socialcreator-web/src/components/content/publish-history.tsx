"use client";

import { Badge } from "@socialcreator/ui/badge";
import { cn } from "@socialcreator/utils";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, HistoryIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishLogEntry {
  id: string;
  platform: string;
  contentId: string;
  contentHash: string;
  success: boolean;
  error: string | null;
  publishedAt: string;
}

interface FetchResponse {
  logs: PublishLogEntry[];
  totalPages: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PublishHistoryProps {
  profileId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublishHistory({ profileId }: PublishHistoryProps) {
  const [logs, setLogs] = useState<PublishLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (profileId) params.set("profileId", profileId);

      const res = await fetch(`/api/v1/publish-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch publish history");

      const data: FetchResponse = await res.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch {
      // Silently fail — component stays in empty state
    } finally {
      setLoading(false);
    }
  }, [page, profileId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // --- Loading skeleton ----------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-surface-strong rounded-md" />
        ))}
      </div>
    );
  }

  // --- Empty state ---------------------------------------------------------
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted">
        <HistoryIcon className="w-10 h-10 mb-3" />
        <p className="text-body-md">No publish history yet</p>
      </div>
    );
  }

  // --- List + pagination ---------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start gap-4 rounded-lg border border-hairline bg-canvas p-4"
          >
            {/* Left: platform + description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-body-strong text-ink font-medium capitalize">
                  {log.platform}
                </span>
                {log.success ? (
                  <Badge className="bg-semantic-success/10 text-semantic-success text-label-xs">
                    Success
                  </Badge>
                ) : (
                  <Badge className="bg-semantic-error/10 text-semantic-error text-label-xs">
                    Failed
                  </Badge>
                )}
              </div>
              <p className="text-body-sm text-muted truncate">
                Content published to {log.platform}
              </p>
              <p className="text-label-xs text-muted-soft mt-0.5">
                {formatDistanceToNow(new Date(log.publishedAt), { addSuffix: true })}
              </p>

              {/* Error message */}
              {!log.success && log.error && (
                <p className="mt-1 text-body-sm text-semantic-error truncate max-h-[200px]">
                  {log.error}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-body-sm transition-colors",
            page <= 1
              ? "text-muted-soft cursor-not-allowed"
              : "text-muted hover:text-ink hover:bg-surface-strong",
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <span className="text-label-sm text-muted">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-body-sm transition-colors",
            page >= totalPages
              ? "text-muted-soft cursor-not-allowed"
              : "text-muted hover:text-ink hover:bg-surface-strong",
          )}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
