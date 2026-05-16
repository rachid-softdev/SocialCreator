/**
 * Connected Account Card Component
 * Displays a single connected account with actions
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import { Platform, ConnectedAccount as ConnectedAccountType } from "@prisma/client";
import { PlatformIcon, getPlatformColor, getPlatformName } from "./platform-icon";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2, MoreVertical } from "lucide-react";

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

  const isExpired = account.expiresAt && new Date(account.expiresAt) < new Date();

  return (
    <div className="bg-card rounded-xl shadow-card p-6 border border-border/50">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Platform Icon */}
          <PlatformIcon platform={account.platform} size="lg" />

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {account.accountName}
              </h3>
              {/* Status Badge */}
              <Badge
                variant={account.isActive ? "default" : "secondary"}
                className={account.isActive ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}
              >
                {account.isActive ? "Actif" : "Inactif"}
              </Badge>
              {isExpired && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                  Expiré
                </Badge>
              )}
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
    <div className="bg-card rounded-xl shadow-card p-6 border border-border/50 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        </div>
        <div className="w-8 h-8 bg-muted rounded" />
      </div>
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="h-3 w-40 bg-muted rounded" />
      </div>
    </div>
  );
}