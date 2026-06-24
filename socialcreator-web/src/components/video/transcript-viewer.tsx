"use client";

import { cn } from "@socialcreator/utils";
import { useCallback, useState } from "react";

interface Word {
  word: string;
  start: number;
  end: number;
}

interface TranscriptViewerProps {
  transcript: string;
  words?: Word[];
  onSeek?: (time: number) => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({
  transcript,
  words = [],
  onSeek,
  className,
}: TranscriptViewerProps) {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const handleWordHover = useCallback((time: number) => {
    setHoveredTime(time);
  }, []);

  const handleWordClick = useCallback(
    (time: number) => {
      if (onSeek) {
        onSeek(time);
      }
    },
    [onSeek],
  );

  // Group words by approximate 5-second windows for display
  const wordGroups: Array<{ words: Word[]; start: number }> = [];
  let currentGroup: Array<Word> = [];
  let lastEnd = 0;

  for (const word of words) {
    if (currentGroup.length === 0) {
      currentGroup.push(word);
      lastEnd = word.end;
    } else if (word.start - lastEnd < 5) {
      currentGroup.push(word);
      lastEnd = word.end;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- length > 0 guaranteed by else branch
      wordGroups.push({ words: currentGroup, start: currentGroup[0]!.start });
      currentGroup = [word];
      lastEnd = word.end;
    }
  }
  if (currentGroup.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by length check above
    wordGroups.push({ words: currentGroup, start: currentGroup[0]!.start });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Timestamp indicator */}
      {hoveredTime !== null && (
        <div className="sticky top-0 z-10 px-3 py-1.5 bg-gradient-mint/20 rounded-lg text-caption text-ink">
          Jump to {formatTime(hoveredTime)}
        </div>
      )}

      {/* Transcript text */}
      <div className="bg-surface-card rounded-xl p-6 border border-hairline">
        {words.length > 0 ? (
          <div className="text-body-md leading-relaxed">
            {wordGroups.map((group, groupIndex) => (
              <span key={groupIndex} className="inline">
                {group.words.map((w, wordIndex) => (
                  <button
                    type="button"
                    key={wordIndex}
                    className={cn(
                      "inline cursor-pointer transition-colors duration-150 font-inherit text-inherit",
                      "hover:text-gradient-mint hover:bg-gradient-mint/10 px-0.5 py-0.5 -mx-0.5 rounded",
                      hoveredTime !== null &&
                        Math.abs(hoveredTime - w.start) < 0.5 &&
                        "bg-gradient-mint/20",
                    )}
                    onMouseEnter={() => handleWordHover(w.start)}
                    onMouseLeave={() => setHoveredTime(null)}
                    onClick={() => handleWordClick(w.start)}
                    title={`${formatTime(w.start)} - ${formatTime(w.end)}`}
                  >
                    {w.word}{" "}
                  </button>
                ))}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-body-md leading-relaxed text-muted">{transcript}</p>
        )}
      </div>

      {/* Time navigation */}
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words
            .filter((_w, i) => i % 50 === 0)
            .slice(0, 20)
            .map((w, i) => (
              <button
                type="button"
                key={i}
                onClick={() => handleWordClick(w.start)}
                className="px-2 py-1 rounded text-caption text-muted hover:text-ink hover:bg-surface-strong transition-colors"
              >
                {formatTime(w.start)}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
