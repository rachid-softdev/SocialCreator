"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getMuxStreamUrl } from "@/lib/mux";

interface MuxPlayerProps {
  playbackId: string;
  startTime?: number;
  endTime?: number;
  hook?: string;
  className?: string;
  autoPlay?: boolean;
}

export function MuxPlayer({
  playbackId,
  startTime = 0,
  endTime,
  hook,
  className,
  autoPlay = false,
}: MuxPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);

  const streamUrl = getMuxStreamUrl(playbackId);

  useEffect(() => {
    // Dynamic import HLS.js for better compatibility
    const loadHls = async () => {
      if (typeof window === "undefined" || !containerRef.current) return;

      // Load HLS.js dynamically
      const Hls = (await import("hls.js")).default;

      if (Hls.isSupported()) {
        const hls = new Hls({
          startPosition: startTime,
          endPosition: endTime,
        });

        hlsRef.current = hls;

        if (videoRef.current) {
          hls.loadSource(streamUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (autoPlay && videoRef.current) {
              videoRef.current.play().catch(() => {
                // Autoplay blocked - user interaction required
              });
            }
          });

          // Loop if endTime is set
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.error("HLS fatal error:", data);
            }
          });
        }
      } else if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        videoRef.current.src = streamUrl;
        if (autoPlay) {
          videoRef.current.play().catch(() => {});
        }
      }
    };

    loadHls();

    return () => {
      if (hlsRef.current) {
        (hlsRef.current as { destroy: () => void }).destroy();
      }
    };
  }, [streamUrl, startTime, endTime, autoPlay]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && startTime > 0) {
      videoRef.current.currentTime = startTime;
    }
  }, [startTime]);

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-surface-dark", className)}>
      {/* Hook overlay */}
      {hook && (
        <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 bg-gradient-to-r from-gradient-mint/90 to-transparent">
          <p className="text-body-sm text-ink font-medium line-clamp-1">{hook}</p>
        </div>
      )}

      {/* Video container */}
      <div ref={containerRef} className="aspect-video">
        <video
          ref={videoRef}
          controls
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Mux branding (required by Mux) */}
      <div className="absolute bottom-2 right-2 opacity-50">
        <svg width="48" height="12" viewBox="0 0 48 12" fill="none">
          <path
            d="M0 0h2.4v9.6H0V0zm4.8 0H8l2.4 6 2.4-6h3.2L12 12 7.2 0zM16 0h2.4v9.6H16V0zm7.2 0h2.4v9.6h-2.4V0zm4.8 0h2.4l1.2 4.8 1.2-4.8h2.4L32.4 12l-2.4-9.6h-2.4L26 12 24 0z"
            fill="white"
          />
        </svg>
      </div>
    </div>
  );
}
