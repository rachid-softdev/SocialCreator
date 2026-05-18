"use client";

import { useCallback } from "react";
import { cn } from "@socialcreator/utils";

interface Word {
  word: string;
  start: number;
  end: number;
}

interface Segment {
  start: number;
  end: number;
  reason: string;
  hook: string;
}

interface VideoTimelineProps {
  words?: Word[];
  segments?: Segment[];
  duration?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoTimeline({
  words = [],
  segments = [],
  duration,
  currentTime = 0,
  onSeek,
  className,
}: VideoTimelineProps) {
  // Calculate total duration from words if not provided
  const totalDuration = duration || (words.length > 0 ? words[words.length - 1].end : 0);

  // Create time markers every 30 seconds
  const timeMarkers: number[] = [];
  for (let t = 0; t <= totalDuration; t += 30) {
    timeMarkers.push(t);
  }

  // Calculate word intensity for heatmap (words per second in 5s windows)
  const intensityMap: Map<number, number> = new Map();
  if (words.length > 0 && totalDuration > 0) {
    const windowSize = 5;
    for (let t = 0; t < totalDuration; t += windowSize) {
      const wordsInWindow = words.filter(
        (w) => w.start >= t && w.start < t + windowSize
      ).length;
      intensityMap.set(t, wordsInWindow / windowSize);
    }
  }

  const maxIntensity = Math.max(...Array.from(intensityMap.values()), 1);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const seekTime = percentage * totalDuration;

      onSeek(seekTime);
    },
    [onSeek, totalDuration]
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Time markers */}
      <div className="flex justify-between px-1">
        {timeMarkers.map((time) => (
          <span key={time} className="text-caption text-muted">
            {formatTime(time)}
          </span>
        ))}
      </div>

      {/* Timeline track */}
      <div
        onClick={handleTimelineClick}
        className="relative h-16 bg-surface-card rounded-lg border border-hairline cursor-pointer overflow-hidden"
      >
        {/* Heatmap background */}
        <div className="absolute inset-0 flex">
          {Array.from(intensityMap.entries()).map(([time, intensity]) => {
            const left = (time / totalDuration) * 100;
            const width = (5 / totalDuration) * 100;
            const opacity = 0.1 + (intensity / maxIntensity) * 0.4;

            return (
              <div
                key={time}
                className="absolute h-full bg-gradient-mint"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  opacity,
                }}
              />
            );
          })}
        </div>

        {/* Segment highlights */}
        {segments.map((segment, index) => {
          const left = (segment.start / totalDuration) * 100;
          const width = ((segment.end - segment.start) / totalDuration) * 100;

          return (
            <div
              key={index}
              className="absolute top-0 bottom-0 bg-gradient-peach/40 border-l-2 border-r-2 border-gradient-peach"
              style={{
                left: `${left}%`,
                width: `${width}%`,
              }}
              title={`${segment.hook} (${formatTime(segment.start)} - ${formatTime(segment.end)})`}
            />
          );
        })}

        {/* Progress indicator */}
        {currentTime > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gradient-mint"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-mint shadow-md cursor-grab"
          style={{ left: `${(currentTime / totalDuration) * 100}%`, marginLeft: "-6px" }}
        />
      </div>

      {/* Segment labels */}
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {segments.map((segment, index) => (
            <button
              key={index}
              onClick={() => onSeek?.(segment.start)}
              className="px-2 py-1 rounded text-caption text-muted hover:text-ink hover:bg-surface-strong transition-colors truncate max-w-[150px]"
              title={segment.hook}
            >
              Clip {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
