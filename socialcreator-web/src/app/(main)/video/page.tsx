"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Filter, Grid, List } from "lucide-react";
import { cn } from "@socialcreator/utils";
import { VideoCard } from "@socialcreator/ui/video-card";
import { Button } from "@socialcreator/ui/button";

interface VideoAsset {
  id: string;
  profileId: string;
  uploadUrl: string;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  transcript: string | null;
  segments: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Profile {
  id: string;
  name: string;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "UPLOADED", label: "Uploaded" },
  { value: "TRANSCRIBED", label: "Transcribed" },
  { value: "SEGMENTS_IDENTIFIED", label: "Segments Ready" },
  { value: "CLIPS_CREATED", label: "Clips Ready" },
  { value: "READY", label: "Ready" },
  { value: "ERROR", label: "Error" },
];

export default function AllVideosPage() {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Fetch profiles with AbortController to avoid memory leaks
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchProfiles = async () => {
      try {
        const response = await fetch("/api/profiles", { signal });
        // Ignore if request was aborted
        if (signal.aborted) return;

        if (response.ok) {
          const { profiles } = await response.json();
          setProfiles(profiles);
        }
      } catch (error) {
        // Ignore abort errors - they are expected when component unmounts
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch profiles:", error);
      }
    };

    fetchProfiles();

    // Cleanup: abort fetch if component unmounts
    return () => controller.abort();
  }, []);

  // Fetch videos with AbortController
  const fetchVideos = useCallback(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    setIsLoading(true);

    const fetchVideosAsync = async () => {
      try {
        // Fetch videos from all profiles (in a real app, you'd have a dedicated endpoint)
        const videosPromises = profiles.map(async (profile) => {
          if (signal.aborted) return [];
          // This would be a dedicated endpoint in production
          return [];
        });

        const results = await Promise.all(videosPromises);

        if (!signal.aborted) {
          const allVideos = results.flat();
          setVideos(allVideos);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch videos:", error);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchVideosAsync();

    // Cleanup
    return () => controller.abort();
  }, [profiles]);

  useEffect(() => {
    if (profiles.length > 0) {
      fetchVideos();
    }
  }, [profiles, fetchVideos]);

  const filteredVideos = videos.filter((video) => {
    if (selectedProfile !== "all" && video.profileId !== selectedProfile) {
      return false;
    }
    if (statusFilter !== "all" && video.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <div className="border-b border-hairline bg-surface-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-title-md text-ink">All Videos</h1>
              <p className="text-caption text-muted mt-0.5">Manage your video library</p>
            </div>
            <Button href="/profiles">
              <Plus className="w-4 h-4" />
              New Video
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-hairline bg-surface-soft">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Profile filter */}
            <div className="flex items-center gap-2">
              <label className="text-caption text-muted">Profile:</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-surface-card border border-hairline text-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Profiles</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted" />
              <div className="flex gap-1">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-pill text-caption transition-colors",
                      statusFilter === filter.value
                        ? "bg-gradient-mint text-ink"
                        : "text-muted hover:text-ink hover:bg-surface-strong",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View mode toggle */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  viewMode === "grid" ? "bg-surface-strong text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Grid className="w-4 h-4" />
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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-video bg-surface-strong rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-muted"
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
            <h3 className="text-title-sm text-ink mb-2">No videos yet</h3>
            <p className="text-caption text-muted mb-6">
              Upload a video to start creating social content
            </p>
            <Button href="/profiles">
              <Plus className="w-4 h-4" />
              Upload Video
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                playbackId={video.muxPlaybackId}
                status={video.status}
                createdAt={video.createdAt}
                onClick={() =>
                  (window.location.href = `/profiles/${video.profileId}/video?id=${video.id}`)
                }
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredVideos.map((video) => {
              const profile = profiles.find((p) => p.id === video.profileId);
              return (
                <Link
                  key={video.id}
                  href={`/profiles/${video.profileId}/video?id=${video.id}`}
                  className="flex items-center gap-4 p-4 bg-surface-card rounded-xl border border-hairline hover:shadow-soft transition-all"
                >
                  <div className="w-32 h-18 bg-surface-strong rounded-lg overflow-hidden">
                    {video.muxPlaybackId ? (
                      <Image
                        src={`https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg`}
                        alt="Video thumbnail"
                        width={128}
                        height={72}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-muted-soft"
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
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-strong text-ink truncate">
                      {profile?.name || "Unknown Profile"}
                    </p>
                    <p className="text-caption text-muted">
                      {new Date(video.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "px-2 py-1 rounded-pill text-caption-uppercase text-xs font-semibold",
                      STATUS_COLORS[video.status] || STATUS_COLORS.UPLOADING,
                    )}
                  >
                    {STATUS_LABELS[video.status] || video.status}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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
