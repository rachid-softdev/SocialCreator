"use client";

import type { ContentStatus, Platform } from "@prisma/client";
import type { GeneratedContentWithRelations } from "@socialcreator/types/agent";
import { CONTENT_STATUS_LABELS, PLATFORMS } from "@socialcreator/types/profile";
import { cn } from "@socialcreator/utils";
import { Filter, LayoutGrid, List, X } from "lucide-react";
import { useState } from "react";
import { ContentCard } from "./content-card";
import { ContentStatusBadge } from "./content-status-badge";
import { PlatformBadge } from "./platform-badge";

interface ContentListProps {
  contents: GeneratedContentWithRelations[];
  profileId?: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onPublish?: (id: string) => void;
  showFilters?: boolean;
  searchQuery?: string;
  statusFilter?: ContentStatus | null;
  platformFilter?: Platform | null;
}

const STATUSES: ContentStatus[] = ["DRAFT", "APPROVED", "PUBLISHED", "FAILED", "REJECTED"];

export function ContentList({
  contents,
  profileId,
  onApprove,
  onReject,
  onPublish,
  showFilters = true,
  searchQuery,
  statusFilter: externalStatusFilter,
  platformFilter: externalPlatformFilter,
}: ContentListProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [internalStatusFilter, setInternalStatusFilter] = useState<ContentStatus | null>(null);
  const [internalPlatformFilter, setInternalPlatformFilter] = useState<Platform | null>(null);

  // When external props are provided, they override internal state
  const effectiveStatusFilter =
    externalStatusFilter !== undefined ? externalStatusFilter : internalStatusFilter;
  const effectivePlatformFilter =
    externalPlatformFilter !== undefined ? externalPlatformFilter : internalPlatformFilter;

  const filteredContents = contents.filter((content) => {
    if (effectiveStatusFilter && content.status !== effectiveStatusFilter) return false;
    if (effectivePlatformFilter && content.platform !== effectivePlatformFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const textMatch = content.textContent.toLowerCase().includes(q);
      const hashtagMatch = content.hashtags.some((t) => t.toLowerCase().includes(q));
      if (!textMatch && !hashtagMatch) return false;
    }
    return true;
  });

  if (contents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center mb-4">
          <Filter className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-title-sm text-ink mb-2">No content yet</h3>
        <p className="text-body-sm text-muted max-w-md">
          Generated content from your agents will appear here. Run an agent to create content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters & View Toggle */}
      {showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                externalStatusFilter !== undefined
                  ? undefined
                  : setInternalStatusFilter(null)
              }
              className={cn(
                "px-3 py-1.5 rounded-pill text-caption transition-colors",
                !effectiveStatusFilter
                  ? "bg-primary text-on-primary"
                  : "bg-surface-strong text-muted hover:text-ink",
              )}
            >
              All
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                onClick={() =>
                  externalStatusFilter !== undefined
                    ? undefined
                    : setInternalStatusFilter(
                        status === internalStatusFilter ? null : status,
                      )
                }
                className={cn(
                  "px-3 py-1.5 rounded-pill text-caption transition-colors",
                  effectiveStatusFilter === status
                    ? "bg-primary text-on-primary"
                    : "bg-surface-strong text-muted hover:text-ink",
                )}
              >
                {CONTENT_STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === "grid" ? "bg-surface-strong text-ink" : "text-muted hover:text-ink",
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === "list" ? "bg-surface-strong text-ink" : "text-muted hover:text-ink",
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Filters */}
      {(effectiveStatusFilter || effectivePlatformFilter) && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted">Filters:</span>
          {effectiveStatusFilter && (
            <button
              onClick={() =>
                externalStatusFilter !== undefined
                  ? undefined
                  : setInternalStatusFilter(null)
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-surface-strong text-caption"
            >
              {CONTENT_STATUS_LABELS[effectiveStatusFilter]}
              <X className="w-3 h-3" />
            </button>
          )}
          {effectivePlatformFilter && (
            <button
              onClick={() =>
                externalPlatformFilter !== undefined
                  ? undefined
                  : setInternalPlatformFilter(null)
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-pill bg-surface-strong text-caption"
            >
              {PLATFORMS.find((p) => p.value === effectivePlatformFilter)?.label}
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {filteredContents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-body-sm text-muted">No content matches your filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContents.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              profileId={profileId}
              onApprove={onApprove}
              onReject={onReject}
              onPublish={onPublish}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContents.map((content) => (
            <div key={content.id} className="bg-surface-card border border-hairline rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <PlatformBadge platform={content.platform} size="sm" />
                  <ContentStatusBadge status={content.status} />
                </div>
                <span className="text-caption text-muted">
                  {content.createdAt.toLocaleDateString()}
                </span>
              </div>
              <p className="text-body-sm text-body mt-3 line-clamp-2">{content.textContent}</p>
              <div className="flex items-center gap-2 mt-3">
                {content.hashtags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-caption text-muted">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
