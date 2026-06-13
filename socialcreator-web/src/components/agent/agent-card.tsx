"use client";

import type { AgentType, AgentWithRelations } from "@socialcreator/types/agent";
import { AGENT_TYPE_LABELS } from "@socialcreator/types/agent";
import { cn, formatDateTime } from "@socialcreator/utils";
import { Bot, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PlatformBadge } from "@/components/content/platform-badge";
import { RunStatusBadge } from "./run-status-badge";

interface AgentCardProps {
  agent: AgentWithRelations & {
    stats: { totalRuns: number; successRate: number };
  };
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

const TYPE_COLORS: Record<AgentType, string> = {
  TEXT_POST: "bg-gradient-mint/30 text-ink",
  VIDEO_CLIP: "bg-gradient-peach/30 text-ink",
  CROSS_POST: "bg-gradient-lavender/30 text-ink",
};

export function AgentCard({ agent, onDelete, onEdit }: AgentCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastRun = agent.runs?.[0];

  return (
    <div className="group relative bg-surface-card border border-hairline rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all">
      <Link href={`/profiles/${agent.profile.id}/agents/${agent.id}`} className="block">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-surface-strong flex items-center justify-center">
            <Bot className="w-6 h-6 text-body" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-body-strong text-ink truncate">{agent.name}</h3>
              {!agent.isActive && (
                <span className="px-2 py-0.5 rounded-full bg-muted-soft/50 text-xs text-muted">
                  Paused
                </span>
              )}
            </div>
            <span
              className={cn(
                "inline-block px-2 py-0.5 rounded text-xs font-medium",
                TYPE_COLORS[agent.type],
              )}
            >
              {AGENT_TYPE_LABELS[agent.type]}
            </span>
          </div>
        </div>

        {/* Platforms */}
        {agent.platforms.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {agent.platforms.slice(0, 4).map((platform) => (
              <PlatformBadge key={platform} platform={platform} size="sm" />
            ))}
            {agent.platforms.length > 4 && (
              <span className="px-2 py-0.5 rounded-full bg-surface-strong text-xs text-muted">
                +{agent.platforms.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-center border-t border-hairline pt-4">
          <div>
            <p className="text-body-sm text-muted">Total Runs</p>
            <p className="text-body-strong text-ink">{agent.stats.totalRuns}</p>
          </div>
          <div>
            <p className="text-body-sm text-muted">Success Rate</p>
            <p className="text-body-strong text-ink">{agent.stats.successRate}%</p>
          </div>
        </div>

        {/* Last Run */}
        {lastRun && (
          <div className="mt-4 pt-4 border-t border-hairline">
            <div className="flex items-center justify-between">
              <span className="text-caption text-muted">Last run</span>
              <RunStatusBadge status={lastRun.status} showPulse={false} />
            </div>
            <p className="text-caption text-body mt-1">{formatDateTime(lastRun.createdAt)}</p>
          </div>
        )}
      </Link>

      {/* Actions dropdown */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowDropdown(!showDropdown);
          }}
          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-strong transition-all"
        >
          <MoreVertical className="w-4 h-4 text-muted" />
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-8 w-40 bg-surface-card border border-hairline rounded-lg shadow-card z-10">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onEdit?.(agent.id);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-body-sm text-ink hover:bg-surface-strong rounded-t-lg"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowDeleteConfirm(true);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-body-sm text-semantic-error hover:bg-surface-strong rounded-b-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete agent?"
        description="Are you sure you want to delete this agent? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => onDelete?.(agent.id)}
      />
    </div>
  );
}
