"use client";

import type { GeneratedContent, Platform } from "@prisma/client";
import {
  CONTENT_STATUS_COLORS,
  CONTENT_STATUS_LABELS,
  PLATFORMS,
} from "@socialcreator/types/profile";
import { cn, formatDate } from "@socialcreator/utils";

interface RecentContentProps {
  contents?: Array<GeneratedContent & { profileName?: string }>;
}

function getPlatformBadge(platform: Platform) {
  const platformInfo = PLATFORMS.find((p) => p.value === platform);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-strong text-caption text-ink">
      <span>{platformInfo?.icon}</span>
      {platformInfo?.label}
    </span>
  );
}

export function RecentContent({ contents }: RecentContentProps) {
  const defaultContents: typeof contents = [];

  const displayContents = contents?.length ? contents : defaultContents;

  if (displayContents.length === 0) {
    return (
      <div className="bg-surface-card border border-hairline rounded-xl p-6">
        <h3 className="text-title-sm text-ink mb-4">Recent Content</h3>
        <p className="text-body-sm text-muted">
          No content yet. Create your first profile to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-6">
      <h3 className="text-title-sm text-ink mb-4">Recent Content</h3>
      <div className="space-y-3">
        {displayContents.map((content) => (
          <div
            key={content.id}
            className="flex items-center justify-between py-3 border-b border-hairline-soft last:border-0"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getPlatformBadge(content.platform)}
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-caption",
                    CONTENT_STATUS_COLORS[content.status],
                  )}
                >
                  {CONTENT_STATUS_LABELS[content.status]}
                </span>
              </div>
              <p className="text-body-sm text-muted truncate">
                {content.profileName && (
                  <span className="text-muted-soft">{content.profileName} · </span>
                )}
                {content.textContent ? `${content.textContent.substring(0, 60)}...` : "No content"}
              </p>
            </div>
            <span className="text-caption text-muted-soft whitespace-nowrap ml-4">
              {formatDate(content.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
