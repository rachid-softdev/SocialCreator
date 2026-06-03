"use client";

import { AlertCircle, CheckCircle, ExternalLink, Loader2, X } from "lucide-react";
import { useState } from "react";
import { PlatformBadge } from "./platform-badge";

interface PublishModalProps {
  contentId: string;
  platform: string;
  onClose: () => void;
  onConfirm: () => void;
  isPublishing: boolean;
  capStatus?: {
    count: number;
    max: number;
    allowed: boolean;
  };
  result?: {
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
  } | null;
}

export function PublishModal({
  contentId: _contentId,
  platform,
  onClose,
  onConfirm,
  isPublishing,
  capStatus,
  result,
}: PublishModalProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Show success state
  if (result?.success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-success-title"
      >
        <div className="bg-surface-card rounded-xl border border-hairline p-8 max-w-md w-full mx-4 shadow-xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-semantic-success/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-semantic-success" />
            </div>
            <h3 id="publish-success-title" className="text-title-md text-ink">
              Published successfully!
            </h3>
            {result.postUrl && (
              <a
                href={result.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-button text-primary hover:text-primary-active"
              >
                View post
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (result && !result.success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-error-title"
      >
        <div className="bg-surface-card rounded-xl border border-hairline p-8 max-w-md w-full mx-4 shadow-xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-semantic-error/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-semantic-error" />
            </div>
            <h3 id="publish-error-title" className="text-title-md text-ink">
              Publication failed
            </h3>
            <p className="text-body-sm text-muted">{result.error}</p>
            <div className="flex gap-3 justify-center pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-pill border border-hairline text-button hover:bg-surface-strong transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  // Reset result to try again
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const capPercentage = capStatus ? (capStatus.count / capStatus.max) * 100 : 0;
  const isNearCap = capPercentage >= 75;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-confirm-title"
    >
      <div className="bg-surface-card rounded-xl border border-hairline max-w-lg w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-hairline">
          <h2 id="publish-confirm-title" className="text-title-md text-ink">
            Confirm Publication
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            aria-label="Close"
            className="p-2 rounded-lg hover:bg-surface-strong transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-muted" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Platform info */}
          <div className="flex items-center gap-3 p-4 bg-surface-soft rounded-lg">
            <PlatformBadge platform={platform} />
            <div className="text-body-sm text-muted">
              This content will be published to {platform}
            </div>
          </div>

          {/* Cap warning */}
          {capStatus && isNearCap && !showWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <button
                type="button"
                onClick={() => setShowWarning(true)}
                className="w-full text-left flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-body-sm text-amber-800 font-medium">
                    You&apos;re approaching your daily limit
                  </p>
                  <p className="text-caption text-amber-700">
                    {capStatus.count}/{capStatus.max} posts published today
                  </p>
                </div>
              </button>
            </div>
          )}

          {capStatus && isNearCap && showWarning && (
            <div className="flex items-center gap-2 text-body-sm text-amber-700">
              <AlertCircle className="w-4 h-4" />
              <span>
                {capStatus.max - capStatus.count} publication
                {capStatus.max - capStatus.count !== 1 ? "s" : ""} remaining today
              </span>
            </div>
          )}

          {/* Loading state */}
          {isPublishing && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <span className="text-body-sm text-muted">Publishing...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isPublishing && (
          <div className="flex gap-3 p-6 border-t border-hairline bg-surface-soft/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-pill border border-hairline text-button hover:bg-surface-strong transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-pill bg-semantic-success text-white text-button hover:bg-semantic-success/90 transition-colors"
            >
              Publish Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
