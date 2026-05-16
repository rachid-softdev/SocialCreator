"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { getMuxThumbnailUrl } from "@/lib/mux";

interface VideoCardProps {
  playbackId?: string | null;
  duration?: number | null;
  status: string;
  createdAt: Date | string;
  className?: string;
  onClick?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  UPLOADING: "bg-surface-strong text-muted",
  UPLOADED: "bg-gradient-peach text-ink",
  TRANSCRIBING: "bg-gradient-lavender text-ink",
  TRANSCRIBED: "bg-gradient-mint text-ink",
  SEGMENTS_IDENTIFIED: "bg-gradient-sky text-ink",
  CLIPS_CREATED: "bg-gradient-rose text-ink",
  PROCESSING: "bg-gradient-peach text-ink",
  READY: "bg-semantic-success text-white",
  ERROR: "bg-semantic-error text-white",
};

const STATUS_LABELS: Record<string, string> = {
  UPLOADING: "Uploading",
  UPLOADED: "Uploaded",
  TRANSCRIBING: "Transcribing",
  TRANSCRIBED: "Transcribed",
  SEGMENTS_IDENTIFIED: "Segments",
  CLIPS_CREATED: "Clips Ready",
  PROCESSING: "Processing",
  READY: "Ready",
  ERROR: "Error",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoCard({
  playbackId,
  duration,
  status,
  createdAt,
  className,
  onClick,
}: VideoCardProps) {
  const thumbnailUrl = playbackId ? getMuxThumbnailUrl(playbackId) : null;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.UPLOADING;
  const statusLabel = STATUS_LABELS[status] || status;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-surface-card rounded-xl overflow-hidden border border-hairline cursor-pointer transition-all duration-200 hover:shadow-soft",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-strong">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt="Video thumbnail"
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-muted-soft"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-ink/20">
          <div className="w-14 h-14 rounded-full bg-surface-card/90 flex items-center justify-center">
            <svg className="w-6 h-6 text-ink ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-surface-dark-elevated/90 text-on-dark text-caption font-medium">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className={cn("px-2 py-0.5 rounded-pill text-caption-uppercase text-xs font-semibold", statusColor)}>
            {statusLabel}
          </span>
          <span className="text-muted text-caption">
            {new Date(createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
