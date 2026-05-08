"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RunStatusBadge } from "./run-status-badge";
import type { AgentRunWithRelations } from "@/types/agent";
import { formatDateTime } from "@/lib/utils";

interface RunListProps {
  runs: (AgentRunWithRelations & { _count?: { generatedContents: number } })[];
  agentId: string;
  profileId: string;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRerun?: (runId: string) => void;
}

export function RunList({ runs, agentId, profileId, pagination, onRerun }: RunListProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="w-12 h-12 text-muted-soft mb-4" />
        <h3 className="text-title-sm text-ink mb-2">No runs yet</h3>
        <p className="text-body-sm text-muted">
          Run the agent to generate content for your platforms.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Runs Table */}
      <div className="bg-surface-card rounded-xl border border-hairline overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline bg-surface-strong/50">
              <th className="text-left px-4 py-3 text-caption-uppercase text-muted font-medium">
                Status
              </th>
              <th className="text-left px-4 py-3 text-caption-uppercase text-muted font-medium">
                Brief
              </th>
              <th className="text-left px-4 py-3 text-caption-uppercase text-muted font-medium">
                Started
              </th>
              <th className="text-left px-4 py-3 text-caption-uppercase text-muted font-medium">
                Contents
              </th>
              <th className="text-right px-4 py-3 text-caption-uppercase text-muted font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {runs.map((run) => {
              const duration =
                run.startedAt && run.finishedAt
                  ? Math.round(
                      (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) /
                        1000
                    )
                  : null;

              return (
                <tr key={run.id} className="hover:bg-surface-strong/30 transition-colors">
                  <td className="px-4 py-4">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/profiles/${profileId}/agents/${agentId}/runs/${run.id}`}
                      className="text-body-sm text-ink hover:underline line-clamp-1 max-w-xs"
                    >
                      {run.brief}
                    </Link>
                    {run.error && (
                      <p className="text-caption text-semantic-error mt-1 truncate max-w-xs">
                        {run.error}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-body-sm text-body">{formatDateTime(run.createdAt)}</p>
                    {duration !== null && (
                      <p className="text-caption text-muted">{duration}s</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-body-sm text-ink">
                      {run._count?.generatedContents || run.generatedContents?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/profiles/${profileId}/agents/${agentId}/runs/${run.id}`}
                        className="p-2 rounded-lg hover:bg-surface-strong text-muted hover:text-ink transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {run.status === "FAILED" && onRerun && (
                        <button
                          onClick={() => onRerun(run.id)}
                          className="p-2 rounded-lg hover:bg-surface-strong text-muted hover:text-ink transition-colors"
                          title="Rerun"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-caption text-muted">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg hover:bg-surface-strong disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg hover:bg-surface-strong disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
