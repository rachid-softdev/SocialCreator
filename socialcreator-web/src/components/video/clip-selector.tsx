"use client";

import { cn } from "@socialcreator/utils";
import { Check, Clock, Play } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { getMuxThumbnailUrl } from "@/lib/mux";

interface Segment {
  start: number;
  end: number;
  reason: string;
  hook: string;
}

interface ClipSelectorProps {
  segments: Segment[];
  playbackId?: string | null;
  onSelectSegments: (selectedSegments: Segment[]) => void;
  onGenerateContent: () => void;
  className?: string;
  isGenerating?: boolean;
}

function formatDuration(start: number, end: number): string {
  const duration = end - start;
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ClipSelector({
  segments,
  playbackId,
  onSelectSegments,
  onGenerateContent,
  className,
  isGenerating = false,
}: ClipSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(segments.map((_, i) => i)));

  const toggleSegment = useCallback((index: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(segments.map((_, i) => i)));
  }, [segments]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleGenerate = useCallback(() => {
    const selectedSegments = segments.filter((_, i) => selectedIds.has(i));
    onSelectSegments(selectedSegments);
    onGenerateContent();
  }, [segments, selectedIds, onSelectSegments, onGenerateContent]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-title-md text-ink">Identified Clips</h3>
          <p className="text-caption text-muted mt-0.5">
            {selectedIds.size} of {segments.length} selected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 rounded-pill text-caption text-muted hover:text-ink hover:bg-surface-strong transition-colors"
          >
            Select all
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1.5 rounded-pill text-caption text-muted hover:text-ink hover:bg-surface-strong transition-colors"
          >
            Deselect all
          </button>
        </div>
      </div>

      {/* Segment cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {segments.map((segment, index) => {
          const isSelected = selectedIds.has(index);
          const thumbnailUrl = playbackId ? getMuxThumbnailUrl(playbackId, segment.start) : null;

          return (
            <div
              key={index}
              className={cn(
                "relative bg-surface-card rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer",
                isSelected
                  ? "border-gradient-mint shadow-soft"
                  : "border-hairline hover:border-hairline-strong",
              )}
              onClick={() => toggleSegment(index)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-surface-strong">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt={`Clip ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-muted-soft" />
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-ink/30 opacity-0 hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-surface-card/90 flex items-center justify-center">
                    <Play className="w-5 h-5 text-ink ml-0.5" />
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-surface-dark-elevated/90 text-on-dark text-caption font-medium">
                  <Clock className="w-3 h-3" />
                  {formatTime(segment.start)} → {formatTime(segment.end)}
                </div>

                {/* Selection indicator */}
                <div
                  className={cn(
                    "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200",
                    isSelected
                      ? "bg-gradient-mint text-ink"
                      : "bg-surface-card/80 border border-hairline",
                  )}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                {/* Hook */}
                <p className="text-body-strong text-ink line-clamp-1">{segment.hook}</p>

                {/* Reason */}
                <p className="text-caption text-muted mt-1 line-clamp-2">{segment.reason}</p>

                {/* Duration */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-pill bg-surface-strong text-caption text-muted">
                    {formatDuration(segment.start, segment.end)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Generate button */}
      <div className="flex justify-end pt-4 border-t border-hairline">
        <button
          onClick={handleGenerate}
          disabled={selectedIds.size === 0 || isGenerating}
          className={cn(
            "px-6 py-2.5 rounded-pill bg-primary text-on-primary font-medium text-button transition-all duration-200",
            "hover:bg-primary-active focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            (selectedIds.size === 0 || isGenerating) && "opacity-50 cursor-not-allowed",
          )}
        >
          {isGenerating
            ? "Generating..."
            : `Generate content for ${selectedIds.size} clip${selectedIds.size !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
