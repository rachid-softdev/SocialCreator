"use client";

import { cn } from "@socialcreator/utils";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { PublishModal } from "./publish-modal";

interface PublishButtonProps {
  contentId: string;
  profileId: string;
  platform: string;
  initialCapStatus?: {
    count: number;
    max: number;
    allowed: boolean;
  };
}

export function PublishButton({
  contentId,
  profileId,
  platform,
  initialCapStatus,
}: PublishButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [capStatus, setCapStatus] = useState(initialCapStatus);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
  } | null>(null);

  // Fetch cap status on mount
  useState(() => {
    if (!capStatus) {
      fetchCapStatus();
    }
  });

  const fetchCapStatus = async () => {
    try {
      const response = await fetch(
        `/api/content/${contentId}/cap-status?profileId=${profileId}&platform=${platform}`,
      );
      if (response.ok) {
        const data = await response.json();
        setCapStatus(data);
      }
    } catch {
      // Silently fail, use initial status
    }
  };

  const handlePublish = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}/publish`, {
        method: "POST",
      });

      const data = await response.json();
      setPublishResult(data);

      if (response.ok && data.success) {
        // Refresh cap status
        await fetchCapStatus();
        // Close modal on success
        setTimeout(() => {
          setShowModal(false);
          window.location.reload();
        }, 2000);
      }
    } catch (_error) {
      setPublishResult({
        success: false,
        error: "Network error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const capPercentage = capStatus ? (capStatus.count / capStatus.max) * 100 : 0;
  const _isNearCap = capPercentage >= 75;
  const isAtCap = capStatus && !capStatus.allowed;

  // If at cap, show disabled state
  if (isAtCap) {
    return (
      <div className="inline-flex items-center gap-2 px-6 py-2 rounded-pill bg-surface-strong text-muted text-button cursor-not-allowed">
        <AlertCircle className="w-4 h-4" />
        Cap atteint
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center gap-2 px-6 py-2 rounded-pill text-button transition-colors",
          "bg-semantic-success text-white hover:bg-semantic-success/90",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-semantic-success",
          isLoading && "opacity-50 cursor-wait",
        )}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Publish Now
        {capStatus && (
          <span className="text-xs opacity-80">
            {capStatus.count}/{capStatus.max}
          </span>
        )}
      </button>

      {showModal && (
        <PublishModal
          contentId={contentId}
          platform={platform}
          onClose={() => {
            setShowModal(false);
            setPublishResult(null);
          }}
          onConfirm={handlePublish}
          isPublishing={isLoading}
          capStatus={capStatus}
          result={publishResult}
        />
      )}
    </>
  );
}
