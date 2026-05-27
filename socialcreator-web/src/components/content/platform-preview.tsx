"use client";

import { useState } from "react";
import { cn } from "@socialcreator/utils";
import { PLATFORMS } from "@socialcreator/types/profile";
import type { Platform } from "@prisma/client";
import { PLATFORM_CONSTRAINTS } from "@socialcreator/types/agent";
import { Instagram, Twitter, Linkedin, Youtube, Facebook, MessageCircle, Pin } from "lucide-react";

interface PlatformPreviewProps {
  platform: Platform;
  content: string;
  hashtags: string[];
}

const PLATFORM_ICONS: Record<Platform, typeof Instagram> = {
  INSTAGRAM: Instagram,
  X: Twitter,
  LINKEDIN: Linkedin,
  YOUTUBE: Youtube,
  FACEBOOK: Facebook,
  TIKTOK: MessageCircle,
  THREADS: MessageCircle,
  PINTEREST: Pin,
};

export function PlatformPreview({ platform, content, hashtags }: PlatformPreviewProps) {
  const Icon = PLATFORM_ICONS[platform];
  const platformInfo = PLATFORMS.find((p) => p.value === platform);
  const constraints = PLATFORM_CONSTRAINTS[platform];
  const isOverLimit = content.length > constraints.maxChars;

  const renderPreview = () => {
    switch (platform) {
      case "INSTAGRAM":
        return (
          <div className="space-y-3">
            <div className="aspect-square bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg flex items-center justify-center">
              <span className="text-white text-6xl">{platformInfo?.icon}</span>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{content}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {hashtags.map((tag) => (
                  <span key={tag} className="text-blue-600 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

      case "X":
        return (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div>
                <p className="font-bold text-sm">Username</p>
                <p className="text-gray-500 text-xs">@handle</p>
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{content}</p>
            <div className="flex gap-4 mt-3 text-gray-500">
              <span className="text-xs">{hashtags.length} hashtags</span>
            </div>
          </div>
        );

      case "LINKEDIN":
        return (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Linkedin className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-sm">User Name</p>
                <p className="text-gray-500 text-xs">Title · 1h</p>
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
            {hashtags.length > 0 && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                {hashtags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-blue-600 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case "TIKTOK":
        return (
          <div className="bg-black rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl">🎵</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">@{platformInfo?.label.toLowerCase()}</p>
                <p className="text-white/90 text-sm mt-1 whitespace-pre-wrap">{content}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {hashtags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-white/80 text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{content}</p>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {hashtags.map((tag) => (
                  <span key={tag} className="text-gray-500 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Platform Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted" />
          <span className="text-body-sm text-ink">{platformInfo?.label}</span>
        </div>
        <span className={cn("text-caption", isOverLimit ? "text-semantic-error" : "text-muted")}>
          {content.length}/{constraints.maxChars}
        </span>
      </div>

      {/* Preview */}
      <div className="max-w-sm mx-auto">{renderPreview()}</div>

      {/* Warning */}
      {isOverLimit && (
        <p className="text-caption text-semantic-error text-center">
          Exceeds character limit by {content.length - constraints.maxChars}
        </p>
      )}
    </div>
  );
}

interface MultiPlatformPreviewProps {
  content: string;
  hashtags: string[];
  platforms: Platform[];
}

export function MultiPlatformPreview({ content, hashtags, platforms }: MultiPlatformPreviewProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(platforms[0] || "INSTAGRAM");

  if (platforms.length === 0) {
    return <div className="text-center py-8 text-muted">Select platforms to preview content</div>;
  }

  return (
    <div className="space-y-4">
      {/* Platform Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {platforms.map((platform) => {
          const platformInfo = PLATFORMS.find((p) => p.value === platform);
          return (
            <button
              key={platform}
              onClick={() => setSelectedPlatform(platform)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-caption whitespace-nowrap transition-colors",
                selectedPlatform === platform
                  ? "bg-primary text-on-primary"
                  : "bg-surface-strong text-muted hover:text-ink",
              )}
            >
              <span>{platformInfo?.icon}</span>
              {platformInfo?.label}
            </button>
          );
        })}
      </div>

      {/* Preview */}
      <PlatformPreview platform={selectedPlatform} content={content} hashtags={hashtags} />
    </div>
  );
}
