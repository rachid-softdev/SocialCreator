"use client";

import type { AgentRunWithRelations } from "@socialcreator/types/agent";
import { cn, formatDateTime } from "@socialcreator/utils";
import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { PlatformBadge } from "@/components/content/platform-badge";
import { RunStatusBadge } from "./run-status-badge";

interface RunDetailProps {
  run: AgentRunWithRelations & {
    duration: number | null;
  };
}

export function RunDetail({ run }: RunDetailProps) {
  const statusConfig = {
    PENDING: { icon: Clock, color: "text-muted", bg: "bg-muted-soft" },
    RUNNING: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-100" },
    SUCCESS: { icon: CheckCircle, color: "text-semantic-success", bg: "bg-semantic-success/10" },
    FAILED: { icon: XCircle, color: "text-semantic-error", bg: "bg-semantic-error/10" },
    CANCELLED: { icon: XCircle, color: "text-muted", bg: "bg-muted-soft" },
  };

  const config = statusConfig[run.status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className={cn("flex items-center gap-4 p-6 rounded-xl", config.bg)}>
        <StatusIcon
          className={cn("w-8 h-8", config.color, run.status === "RUNNING" && "animate-spin")}
        />
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-title-md text-ink">Run #{run.id.slice(-6)}</h3>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-body-sm text-body mt-1">
            {run.agent.name} · {formatDateTime(run.createdAt)}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <h4 className="text-body-strong text-ink mb-4">Timeline</h4>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div>
              <p className="text-body-sm text-ink">Created</p>
              <p className="text-caption text-muted">{formatDateTime(run.createdAt)}</p>
            </div>
          </div>
          {run.startedAt && (
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div>
                <p className="text-body-sm text-ink">Started</p>
                <p className="text-caption text-muted">{formatDateTime(run.startedAt)}</p>
              </div>
            </div>
          )}
          {run.finishedAt && (
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  run.status === "SUCCESS" ? "bg-semantic-success" : "bg-semantic-error",
                )}
              />
              <div>
                <p className="text-body-sm text-ink">
                  {run.status === "SUCCESS" ? "Completed" : "Failed"}
                </p>
                <p className="text-caption text-muted">
                  {formatDateTime(run.finishedAt)}
                  {run.duration !== null && ` · ${run.duration}s`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brief */}
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <h4 className="text-body-strong text-ink mb-3">Brief</h4>
        <p className="text-body-sm text-body whitespace-pre-wrap">{run.brief}</p>
      </div>

      {/* Error */}
      {run.error && (
        <div className="bg-semantic-error/5 border border-semantic-error/20 rounded-xl p-6">
          <h4 className="text-body-strong text-semantic-error mb-2">Error</h4>
          <p className="text-body-sm text-body font-mono">{run.error}</p>
        </div>
      )}

      {/* Generated Content */}
      {run.generatedContents && run.generatedContents.length > 0 && (
        <div>
          <h4 className="text-body-strong text-ink mb-4">
            Generated Content ({run.generatedContents.length})
          </h4>
          <div className="space-y-4">
            {run.generatedContents.map((content) => (
              <div
                key={content.id}
                className="bg-surface-card rounded-xl border border-hairline p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <PlatformBadge platform={content.platform} />
                </div>
                <p className="text-body-sm text-body whitespace-pre-wrap line-clamp-3">
                  {content.textContent}
                </p>
                {content.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {content.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-surface-strong text-caption text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
