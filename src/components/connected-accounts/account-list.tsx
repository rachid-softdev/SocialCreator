/**
 * Connected Account List Component
 * Displays a list of connected accounts grouped by connection status
 */

"use client";

import { Platform, ConnectedAccount as ConnectedAccountType } from "@prisma/client";
import { AccountCard, AccountCardSkeleton } from "./account-card";
import { PlatformIcon } from "./platform-icon";

interface AccountListProps {
  accounts: ConnectedAccountType[];
  isLoading?: boolean;
  onRefresh?: (accountId: string) => Promise<void>;
  onDisconnect?: (accountId: string) => void;
}

export function AccountList({
  accounts,
  isLoading = false,
  onRefresh,
  onDisconnect,
}: AccountListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <AccountCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground">Aucun compte connecté</h3>
        <p className="text-muted-foreground mt-1">
          Connectez vos comptes sociaux pour commencer à publier
        </p>
      </div>
    );
  }

  // Sort accounts: connected first, then by creation date
  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sortedAccounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onRefresh={onRefresh}
          onDisconnect={onDisconnect}
        />
      ))}
    </div>
  );
}

/**
 * Platform Badge Component
 * Shows platform icon and name in a compact format
 */
export function PlatformBadge({ platform }: { platform: Platform }) {
  const platformNames: Record<Platform, string> = {
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
    LINKEDIN: "LinkedIn",
    X: "X",
    YOUTUBE: "YouTube",
    FACEBOOK: "Facebook",
    PINTEREST: "Pinterest",
    THREADS: "Threads",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
      <PlatformIcon platform={platform} size="sm" />
      <span className="text-sm font-medium">{platformNames[platform]}</span>
    </div>
  );
}

/**
 * Get all available platforms
 */
export function getAllPlatforms(): Platform[] {
  return [
    "INSTAGRAM",
    "TIKTOK",
    "LINKEDIN",
    "X",
    "YOUTUBE",
    "FACEBOOK",
    "PINTEREST",
    "THREADS",
  ];
}

/**
 * Get platforms that are not yet connected
 */
export function getUnconnectedPlatforms(
  accounts: ConnectedAccountType[]
): Platform[] {
  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  return getAllPlatforms().filter((p) => !connectedPlatforms.has(p));
}