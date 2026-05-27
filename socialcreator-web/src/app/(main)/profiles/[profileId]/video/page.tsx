"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@socialcreator/utils";
import { ProgressStepper } from "@socialcreator/ui/progress-stepper";
import { VideoUpload } from "@/components/video/video-upload";
import { TranscriptViewer } from "@/components/video/transcript-viewer";
import { ClipSelector } from "@/components/video/clip-selector";
import { MuxPlayer } from "@/components/video/mux-player";
import { ClipsList } from "@/components/video/clips-list";
import { VideoTimeline } from "@/components/video/video-timeline";
import { Button } from "@socialcreator/ui/button";
import { Platform } from "@prisma/client";

interface VideoAsset {
  id: string;
  profileId: string;
  uploadUrl: string;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  transcript: string | null;
  segments: Segment[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Segment {
  start: number;
  end: number;
  reason: string;
  hook: string;
}

interface Clip {
  assetId: string;
  playbackId: string;
  streamUrl: string;
  thumbnailUrl: string;
  segment: Segment;
}

interface GeneratedContent {
  platform: Platform;
  textContent: string;
  hashtags: string[];
}

const PIPELINE_STEPS = [
  { id: "upload", label: "Upload", icon: "📤" },
  { id: "transcribe", label: "Transcription", icon: "📝" },
  { id: "segments", label: "Segments", icon: "✂️" },
  { id: "clips", label: "Clips", icon: "🎬" },
  { id: "generate", label: "Generate", icon: "✍️" },
];

export default function VideoPipelinePage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params.profileId as string;

  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isIdentifyingSegments, setIsIdentifyingSegments] = useState(false);
  const [isCreatingClips, setIsCreatingClips] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["TIKTOK", "INSTAGRAM"]);
  const [error, setError] = useState<string | null>(null);

  // Sync current step with video asset status
  useEffect(() => {
    if (!videoAsset) {
      setCurrentStep(0);
      return;
    }

    const statusToStep: Record<string, number> = {
      UPLOADING: 0,
      UPLOADED: 1,
      TRANSCRIBING: 1,
      TRANSCRIBED: 2,
      SEGMENTS_IDENTIFIED: 3,
      CLIPS_CREATED: 4,
      READY: 4,
    };

    setCurrentStep(statusToStep[videoAsset.status] ?? 0);
  }, [videoAsset?.status]);

  const handleUploadComplete = useCallback(
    (videoAssetId: string, uploadUrl: string) => {
      setVideoAsset({
        id: videoAssetId,
        profileId,
        uploadUrl,
        muxAssetId: null,
        muxPlaybackId: null,
        transcript: null,
        segments: null,
        status: "UPLOADED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setCurrentStep(1);
    },
    [profileId],
  );

  const handleTranscribe = useCallback(async () => {
    if (!videoAsset) return;

    setIsTranscribing(true);
    setError(null);

    try {
      const response = await fetch(`/api/video/${videoAsset.id}/transcribe`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const { transcript } = await response.json();

      setVideoAsset((prev) => (prev ? { ...prev, transcript, status: "TRANSCRIBED" } : null));
      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  }, [videoAsset]);

  const handleIdentifySegments = useCallback(async () => {
    if (!videoAsset) return;

    setIsIdentifyingSegments(true);
    setError(null);

    try {
      const response = await fetch(`/api/video/${videoAsset.id}/segments`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Segment identification failed");
      }

      const { segments } = await response.json();

      setVideoAsset((prev) => (prev ? { ...prev, segments, status: "SEGMENTS_IDENTIFIED" } : null));
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segment identification failed");
    } finally {
      setIsIdentifyingSegments(false);
    }
  }, [videoAsset]);

  const handleCreateClips = useCallback(
    async (selectedSegments: Segment[]) => {
      if (!videoAsset) return;

      setIsCreatingClips(true);
      setError(null);

      try {
        const response = await fetch(`/api/video/${videoAsset.id}/clips`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: selectedSegments }),
        });

        if (!response.ok) {
          throw new Error("Clip creation failed");
        }

        const { clips: newClips } = await response.json();
        setClips(newClips);

        setVideoAsset((prev) => (prev ? { ...prev, status: "CLIPS_CREATED" } : null));
        setCurrentStep(4);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Clip creation failed");
      } finally {
        setIsCreatingClips(false);
      }
    },
    [videoAsset],
  );

  const handleGenerateContent = useCallback(async () => {
    if (!videoAsset) return;

    setIsGeneratingContent(true);
    setError(null);

    try {
      const response = await fetch(`/api/video/${videoAsset.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          clipSegments: videoAsset.segments,
        }),
      });

      if (!response.ok) {
        throw new Error("Content generation failed");
      }

      const { contents } = await response.json();
      // Contents are stored in database, navigate to content list
      router.push(`/content?profileId=${profileId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Content generation failed");
    } finally {
      setIsGeneratingContent(false);
    }
  }, [videoAsset, selectedPlatforms, profileId, router]);

  const handlePlatformToggle = useCallback((platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <div className="border-b border-hairline bg-surface-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/profiles/${profileId}`}
              className="p-2 rounded-lg hover:bg-surface-strong transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </Link>
            <div>
              <h1 className="text-title-md text-ink">Video Pipeline</h1>
              <p className="text-caption text-muted">Transform long videos into social content</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="border-b border-hairline bg-surface-soft py-6">
        <div className="max-w-7xl mx-auto px-6">
          <ProgressStepper steps={PIPELINE_STEPS} currentStep={currentStep} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content area */}
          <div className="lg:col-span-2">
            {/* Step 1: Upload */}
            {currentStep === 0 && (
              <div className="bg-surface-card rounded-xl p-8 border border-hairline">
                <h2 className="text-title-md text-ink mb-6">Upload your video</h2>
                <VideoUpload profileId={profileId} onUploadComplete={handleUploadComplete} />
              </div>
            )}

            {/* Step 2: Transcription */}
            {currentStep >= 1 && videoAsset && (
              <div className="bg-surface-card rounded-xl p-8 border border-hairline">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-title-md text-ink">Transcript</h2>
                  {currentStep === 1 && videoAsset.status === "UPLOADED" && (
                    <Button
                      onClick={handleTranscribe}
                      disabled={isTranscribing}
                      icon={isTranscribing ? Loader2 : undefined}
                    >
                      {isTranscribing ? "Transcribing..." : "Start Transcription"}
                    </Button>
                  )}
                </div>

                {videoAsset.transcript ? (
                  <TranscriptViewer transcript={videoAsset.transcript} />
                ) : (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto text-muted animate-spin" />
                    <p className="text-caption text-muted mt-4">Waiting for transcription...</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Segments */}
            {currentStep >= 2 && videoAsset?.segments && (
              <div className="bg-surface-card rounded-xl p-8 border border-hairline">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-title-md text-ink">Identify Segments</h2>
                  {currentStep === 2 && videoAsset.status === "TRANSCRIBED" && (
                    <Button
                      onClick={handleIdentifySegments}
                      disabled={isIdentifyingSegments}
                      icon={isIdentifyingSegments ? Loader2 : undefined}
                    >
                      {isIdentifyingSegments ? "Identifying..." : "Identify Segments"}
                    </Button>
                  )}
                </div>

                <ClipSelector
                  segments={videoAsset.segments}
                  playbackId={videoAsset.muxPlaybackId}
                  onSelectSegments={() => {}}
                  onGenerateContent={() => handleCreateClips([])}
                  isGenerating={isCreatingClips}
                />
              </div>
            )}

            {/* Step 4-5: Clips & Generate */}
            {currentStep >= 3 && videoAsset?.segments && (
              <div className="bg-surface-card rounded-xl p-8 border border-hairline">
                <h2 className="text-title-md text-ink mb-6">Generated Clips</h2>

                <div className="mb-6">
                  <h3 className="text-body-strong text-ink mb-3">Select Platforms</h3>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        "TIKTOK",
                        "INSTAGRAM",
                        "YOUTUBE",
                        "FACEBOOK",
                        "X",
                        "LINKEDIN",
                        "THREADS",
                        "PINTEREST",
                      ] as Platform[]
                    ).map((platform) => (
                      <button
                        key={platform}
                        onClick={() => handlePlatformToggle(platform)}
                        className={cn(
                          "px-3 py-1.5 rounded-pill text-caption transition-colors",
                          selectedPlatforms.includes(platform)
                            ? "bg-gradient-mint text-ink"
                            : "bg-surface-strong text-muted hover:text-ink",
                        )}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>

                <ClipsList
                  clips={clips}
                  onPreview={(clip) => console.log("Preview", clip)}
                  onDelete={(clip) => console.log("Delete", clip)}
                />

                {currentStep === 4 && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      onClick={handleGenerateContent}
                      disabled={isGeneratingContent || clips.length === 0}
                      icon={isGeneratingContent ? Loader2 : undefined}
                    >
                      {isGeneratingContent ? "Generating..." : "Generate Content"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mt-6 p-4 rounded-lg bg-semantic-error/10 border border-semantic-error/20">
                <p className="text-semantic-error text-body-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-surface-card rounded-xl p-6 border border-hairline sticky top-6">
              <h3 className="text-title-sm text-ink mb-4">Preview</h3>

              {videoAsset?.muxPlaybackId ? (
                <div className="space-y-4">
                  <MuxPlayer
                    playbackId={videoAsset.muxPlaybackId}
                    hook={videoAsset.segments?.[0]?.hook}
                  />
                  <VideoTimeline words={[]} segments={videoAsset.segments || []} duration={120} />
                </div>
              ) : videoAsset?.uploadUrl ? (
                <div className="aspect-video bg-surface-strong rounded-lg flex items-center justify-center">
                  <video
                    src={videoAsset.uploadUrl}
                    controls
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-surface-strong rounded-lg flex items-center justify-center">
                  <p className="text-caption text-muted">Upload a video to preview</p>
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 pt-6 border-t border-hairline space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-caption text-muted">Status</span>
                  <span className="text-caption text-ink font-medium">
                    {videoAsset?.status || "Not started"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-muted">Clips</span>
                  <span className="text-caption text-ink font-medium">{clips.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption text-muted">Platforms</span>
                  <span className="text-caption text-ink font-medium">
                    {selectedPlatforms.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
