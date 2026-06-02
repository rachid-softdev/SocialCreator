/**
 * Connected Account Card Component
 * Displays a single connected account with actions
 */

"use client";

import type { ConnectedAccount as ConnectedAccountType } from "@prisma/client";
import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import { Skeleton } from "@socialcreator/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { RefreshCw, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { getPlatformName, PlatformIcon } from "./platform-icon";

interface AccountCardProps {
  account: ConnectedAccountType;
  onRefresh?: (accountId: string) => Promise<void>;
  onDisconnect?: (accountId: string) => void;
  isLoading?: boolean;
}

export function AccountCard({
  account,
  onRefresh,
  onDisconnect,
  isLoading = false,
}: AccountCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh(account.id);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  /**
   * Compute expiry badge based on days remaining
   */
  const ExpiryBadge = () => {
    if (!account.expiresAt) return null;

    const now = new Date();
    const expiry = new Date(account.expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }

    if (diffDays <= 7) {
      return (
        <Badge variant="destructive">
          Expires in {diffDays} day{diffDays === 1 ? "" : "s"}
        </Badge>
      );
    }

    if (diffDays <= 30) {
      return <Badge className="bg-yellow-500/10 text-yellow-500">Expires in {diffDays} days</Badge>;
    }

    return <Badge variant="success">Expires in {diffDays} days</Badge>;
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-6 border border-border/50">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Platform Icon */}
          <PlatformIcon platform={account.platform} size="lg" />

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">{account.accountName}</h3>
              {/* Status Badge */}
              <Badge
                variant={account.isActive ? "default" : "secondary"}
                className={
                  account.isActive
                    ? "bg-green-500/10 text-green-500"
                    : "bg-muted text-muted-foreground"
                }
              >
                {account.isActive ? "Actif" : "Inactif"}
              </Badge>
              {/* Expiry Badge */}
              <ExpiryBadge />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {getPlatformName(account.platform)}
            </p>
            {account.accountAvatarUrl && (
              <div className="mt-2">
                <Image
                  src={account.accountAvatarUrl}
                  alt={account.accountName}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          )}

          {/* Disconnect Button */}
          {onDisconnect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect(account.id)}
              disabled={isLoading}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Meta Info */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Connecté{" "}
            {formatDistanceToNow(account.createdAt, {
              addSuffix: true,
              locale: fr,
            })}
          </span>
          {account.expiresAt && (
            <span className="text-muted-foreground">
              Expire{" "}
              {formatDistanceToNow(new Date(account.expiresAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for account card
 */
export function AccountCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-8" />
      </div>
      <div className="mt-4 pt-4 border-t border-border/50">
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}
