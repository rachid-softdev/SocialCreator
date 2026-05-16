"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getMuxThumbnailUrl } from "@/lib/mux";
import { Play, Trash2, Download, MoreVertical } from "lucide-react";
import { Platform } from "@prisma/client";

interface Clip {
  assetId: string;
  playbackId: string;
  streamUrl: string;
  thumbnailUrl: string;
  segment: {
    start: number;
    end: number;
    reason: string;
    hook: string;
  };
  status?: "CREATING" | "READY" | "ERROR";
}

interface ClipsListProps {
  clips: Clip[];
  onPreview?: (clip: Clip) => void;
  onDelete?: (clip: Clip) => void;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  CREATING: "bg-gradient-lavender text-ink",
  READY: "bg-gradient-mint text-ink",
  ERROR: "bg-semantic-error text-white",
};

const STATUS_LABELS: Record<string, string> = {
  CREATING: "Creating",
  READY: "Ready",
  ERROR: "Error",
};

const PLATFORM_ICONS: Record<Platform, string> = {
  TIKTOK: "🎵",
  INSTAGRAM: "📷",
  YOUTUBE: "▶️",
  FACEBOOK: "👥",
  X: "𝕏",
  LINKEDIN: "💼",
  THREADS: "🧵",
  PINTEREST: "📌",
};

function formatDuration(start: number, end: number): string {
  const duration = end - start;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ClipsList({
  clips,
  onPreview,
  onDelete,
  className,
}: ClipsListProps) {
  const [hoveredClip, setHoveredClip] = useState<string | null>(null);

  if (clips.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <p className="text-caption text-muted">No clips created yet</p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {clips.map((clip, index) => {
        const thumbnailUrl = getMuxThumbnailUrl(clip.playbackId, clip.segment.start);
        const status = clip.status || "READY";
        const statusColor = STATUS_COLORS[status] || STATUS_COLORS.READY;
        const statusLabel = STATUS_LABELS[status] || status;

        return (
          <div
            key={clip.assetId}
            onMouseEnter={() => setHoveredClip(clip.assetId)}
            onMouseLeave={() => setHoveredClip(null)}
            className={cn(
              "bg-surface-card rounded-xl overflow-hidden border border-hairline transition-all duration-200",
              hoveredClip === clip.assetId && "shadow-soft"
            )}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-surface-strong group">
              <Image
                src={thumbnailUrl}
                alt={`Clip ${index + 1}`}
                fill
                className="object-cover"
              />

              {/* Play overlay */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-ink/40 transition-opacity",
                  hoveredClip === clip.assetId ? "opacity-100" : "opacity-0"
                )}
              >
                <button
                  onClick={() => onPreview?.(clip)}
                  className="w-14 h-14 rounded-full bg-surface-card/90 flex items-center justify-center hover:bg-surface-card transition-colors"
                >
                  <Play className="w-6 h-6 text-ink ml-0.5" />
                </button>
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-surface-dark-elevated/90 text-on-dark text-caption font-medium">
                {formatDuration(clip.segment.start, clip.segment.end)}
              </div>

              {/* Status badge */}
              <div className={cn("absolute top-2 left-2 px-2 py-1 rounded-pill text-caption-uppercase text-xs font-semibold", statusColor)}>
                {statusLabel}
              </div>

              {/* Actions */}
              <div
                className={cn(
                  "absolute top-2 right-2 transition-opacity",
                  hoveredClip === clip.assetId ? "opacity-100" : "opacity-0"
                )}
              >
                <button className="w-8 h-8 rounded-full bg-surface-card/90 flex items-center justify-center hover:bg-surface-card transition-colors">
                  <MoreVertical className="w-4 h-4 text-ink" />
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              {/* Hook */}
              <p className="text-body-sm text-ink font-medium line-clamp-1">
                {clip.segment.hook}
              </p>

              {/* Reason */}
              <p className="text-caption text-muted mt-1 line-clamp-2">
                {clip.segment.reason}
              </p>

              {/* Actions */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => onPreview?.(clip)}
                    className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-strong transition-colors"
                    title="Preview"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-strong transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete?.(clip)}
                    className="p-2 rounded-lg text-muted hover:text-semantic-error hover:bg-semantic-error/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
