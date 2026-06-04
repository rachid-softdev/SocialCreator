"use client";

import type { Platform, Profile } from "@prisma/client";
import { PLATFORMS } from "@socialcreator/types/profile";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface ProfileCardProps {
  profile: Profile & {
    _count?: {
      agents: number;
      generatedContents: number;
      connectedAccounts: number;
    };
  };
  onDelete?: (id: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getPlatformBadges(platforms: Platform[]) {
  return platforms.slice(0, 3).map((platform) => {
    const platformInfo = PLATFORMS.find((p) => p.value === platform);
    return (
      <span
        key={platform}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-strong text-caption text-ink"
      >
        <span>{platformInfo?.icon}</span>
      </span>
    );
  });
}

export function ProfileCard({ profile, onDelete }: ProfileCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="group relative bg-surface-card border border-hairline rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all">
      <Link href={`/profiles/${profile.id}`} className="block">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-surface-strong flex items-center justify-center text-body-strong text-ink overflow-hidden">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(profile.name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-body-strong text-ink truncate">{profile.name}</h3>
            {profile._count && (
              <p className="text-caption text-muted">
                {profile._count.agents} agents · {profile._count.generatedContents} contents
              </p>
            )}
          </div>
        </div>

        {/* Platforms */}
        {profile.platforms.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {getPlatformBadges(profile.platforms)}
            {profile.platforms.length > 3 && (
              <span className="px-2 py-0.5 rounded bg-surface-strong text-caption text-muted">
                +{profile.platforms.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Brand voice preview */}
        {profile.brandVoice && (
          <p className="text-caption text-muted line-clamp-2">
            {profile.brandVoice.substring(0, 100)}
            {profile.brandVoice.length > 100 && "..."}
          </p>
        )}
      </Link>

      {/* Actions dropdown */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowDropdown(!showDropdown);
          }}
          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-surface-strong transition-all"
        >
          <MoreVertical className="w-4 h-4 text-muted" />
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-8 w-40 bg-surface-card border border-hairline rounded-lg shadow-card z-10">
            <Link
              href={`/profiles/${profile.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 text-body-sm text-ink hover:bg-surface-strong rounded-t-lg"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (confirm("Are you sure you want to delete this profile?")) {
                  onDelete?.(profile.id);
                }
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-body-sm text-semantic-error hover:bg-surface-strong rounded-b-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Active indicator */}
      {!profile.isActive && (
        <div className="absolute top-4 left-4">
          <span className="px-2 py-0.5 rounded bg-semantic-error/10 text-caption text-semantic-error">
            Inactive
          </span>
        </div>
      )}
    </div>
  );
}
