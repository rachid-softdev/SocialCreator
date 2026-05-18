"use client";

import { useCallback, useState } from "react";
import { cn } from "@socialcreator/utils";
import { Upload, X, Loader2 } from "lucide-react";

interface VideoUploadProps {
  profileId: string;
  onUploadComplete: (videoAssetId: string, uploadUrl: string) => void;
  className?: string;
}

type UploadState = "idle" | "uploading" | "processing" | "uploaded" | "error";

export function VideoUpload({ profileId, onUploadComplete, className }: VideoUploadProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file type
    const validTypes = ["video/mp4", "video/quicktime", "video/webm"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload MP4, MOV, or WebM.");
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 500MB.");
      return;
    }

    setState("uploading");
    setError(null);
    setProgress(0);

    try {
      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      // Get presigned URL from backend
      const response = await fetch("/api/video/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadUrl: presignedUrl, videoAssetId: assetId } = await response.json();
      setVideoAssetId(assetId);

      // Upload to UploadThing
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      clearInterval(progressInterval);
      setProgress(100);

      setState("processing");
      setUploadUrl(presignedUrl);
      setThumbnailUrl(presignedUrl);

      // Notify parent
      onUploadComplete(assetId, presignedUrl);

      // Small delay for processing state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setState("uploaded");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, [profileId, onUploadComplete]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200",
          state === "idle" && "border-hairline-strong hover:bg-surface-strong cursor-pointer",
          state === "uploading" && "border-gradient-mint bg-gradient-mint/5",
          state === "processing" && "border-gradient-lavender bg-gradient-lavender/5",
          state === "uploaded" && "border-gradient-mint bg-gradient-mint/5",
          state === "error" && "border-semantic-error bg-semantic-error/5"
        )}
      >
        {state === "idle" && (
          <label className="flex flex-col items-center gap-4 cursor-pointer">
            <div className="w-16 h-16 rounded-full bg-surface-strong flex items-center justify-center">
              <Upload className="w-8 h-8 text-muted" />
            </div>
            <div className="text-center">
              <p className="text-body-strong text-ink">Drop your video here</p>
              <p className="text-caption text-muted mt-1">or click to browse</p>
              <p className="text-caption text-muted-soft mt-2">MP4, MOV, WebM • Max 500MB</p>
            </div>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleInputChange}
              className="hidden"
            />
          </label>
        )}

        {state === "uploading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-gradient-mint animate-spin" />
            <div className="text-center">
              <p className="text-body-strong text-ink">Uploading...</p>
              <p className="text-caption text-muted mt-1">{Math.round(progress)}%</p>
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-xs h-1 bg-surface-strong rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-mint transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state === "processing" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-gradient-lavender animate-spin" />
            <div className="text-center">
              <p className="text-body-strong text-ink">Processing...</p>
              <p className="text-caption text-muted mt-1">Preparing video</p>
            </div>
          </div>
        )}

        {state === "uploaded" && thumbnailUrl && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden bg-surface-strong">
              <video
                src={uploadUrl || undefined}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            </div>
            <div className="text-center">
              <p className="text-body-strong text-ink">Video uploaded</p>
              <p className="text-caption text-muted mt-1">Ready to transcribe</p>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-semantic-error/10 flex items-center justify-center">
              <X className="w-8 h-8 text-semantic-error" />
            </div>
            <div className="text-center">
              <p className="text-body-strong text-semantic-error">Upload failed</p>
              <p className="text-caption text-muted mt-1">{error}</p>
            </div>
            <button
              onClick={() => setState("idle")}
              className="mt-2 px-4 py-2 rounded-pill border border-hairline-strong text-ink hover:bg-surface-strong transition-colors text-button"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
