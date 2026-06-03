"use client";

import type { Platform } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { PlatformBadge } from "./platform-badge";

export interface GeneratedContentResult {
  id: string;
  platform: Platform;
  textContent: string;
  hashtags: string[];
  status: "DRAFT";
}

interface GenerationResultProps {
  content: GeneratedContentResult;
}

export function GenerationResult({ content }: GenerationResultProps) {
  return (
    <div className="bg-surface-card border border-hairline rounded-xl p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PlatformBadge platform={content.platform} size="sm" />
        <span className="text-caption text-muted">{content.textContent.length} chars</span>
      </div>

      {/* Text Content */}
      <p className="text-body-sm text-body whitespace-pre-wrap">{content.textContent}</p>

      {/* Hashtags */}
      {content.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {content.hashtags.map((tag) => (
            <span key={tag} className="text-caption text-muted">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-hairline">
        <Link
          href={`/content/${content.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-caption text-muted hover:bg-surface-strong transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Edit
        </Link>
      </div>
    </div>
  );
}
