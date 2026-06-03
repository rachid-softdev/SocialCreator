/**
 * Connected Accounts Page Client Component
 * Handles all client-side interactivity: modals, disconnect, refresh, OAuth toast
 */

"use client";

import { Button } from "@socialcreator/ui/button";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { AccountList, getUnconnectedPlatforms } from "@/components/connected-accounts/account-list";
import { ConnectModal } from "@/components/connected-accounts/connect-modal";
import { DisconnectModal } from "@/components/connected-accounts/disconnect-modal";
import { OAuthCallbackToast } from "@/components/connected-accounts/oauth-callback-toast";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageHeader } from "@/components/layout/page-header";
import logger from "@/lib/logger";

/**
 * Serialized ConnectedAccount type for the client.
 * Date fields are strings after JSON serialization across the server boundary.
 */
interface SerializedConnectedAccount {
  id: string;
  profileId: string;
  platform: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  isActive: boolean;
  accountId: string;
  accountName: string;
  accountAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountsPageClientProps {
  initialAccounts: SerializedConnectedAccount[];
  profileId: string;
}

export function AccountsPageClient({ initialAccounts, profileId }: AccountsPageClientProps) {
  const _router = useRouter();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<SerializedConnectedAccount[]>(initialAccounts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [disconnectAccount, setDisconnectAccount] = useState<SerializedConnectedAccount | null>(
    null,
  );
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check for success/error from OAuth callback
  const connected = searchParams.get("connected");
  const _errorParam = searchParams.get("error");

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/connected-accounts?profileId=${profileId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const data = await response.json();
      setAccounts(data.accounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Handle disconnect
  const handleDisconnect = async (accountId: string) => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/v1/connected-accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect account");
      }

      // Refresh the list
      await fetchAccounts();
    } catch (err) {
      logger.error({ err }, "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
      setDisconnectAccount(null);
    }
  };

  // Handle refresh token
  const handleRefresh = async (accountId: string) => {
    try {
      const response = await fetch(`/api/v1/connected-accounts/${accountId}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }

      // Refresh the list
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh token");
    }
  };

  const unconnectedPlatforms = getUnconnectedPlatforms(accounts);

  const breadcrumbItems = [
    { label: "Profils", href: "/profiles" },
    { label: "Comptes connectés", href: `/profiles/${profileId}/accounts` },
  ];

  return (
    <div className="container max-w-4xl py-8">
      {/* OAuth callback toast handler */}
      <OAuthCallbackToast />

      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        title="Comptes connectés"
        description="Gérez vos comptes sociaux connectés pour la publication automatique"
        actions={
          unconnectedPlatforms.length > 0 && (
            <Button onClick={() => setIsConnectModalOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Connecter un compte
            </Button>
          )
        }
      />

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Success State */}
      {connected === "success" && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p>Compte connecté avec succès !</p>
        </div>
      )}

      {/* Connected Accounts List */}
      <div className="mt-8">
        <AccountList
          accounts={accounts}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          onDisconnect={(accountId) => {
            const account = accounts.find((a) => a.id === accountId);
            if (account) {
              setDisconnectAccount(account);
            }
          }}
        />
      </div>

      {/* Empty State - All platforms connected */}
      {!isLoading && accounts.length > 0 && unconnectedPlatforms.length === 0 && (
        <div className="mt-8 text-center py-8">
          <p className="text-muted-foreground">Tous les comptes sociaux sont connectés !</p>
        </div>
      )}

      {/* Connect Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        accounts={accounts}
        profileId={profileId}
        onConnected={fetchAccounts}
      />

      {/* Disconnect Modal */}
      <DisconnectModal
        isOpen={!!disconnectAccount}
        onClose={() => setDisconnectAccount(null)}
        onConfirm={() =>
          disconnectAccount ? handleDisconnect(disconnectAccount.id) : Promise.resolve()
        }
        platform={disconnectAccount?.platform || "INSTAGRAM"}
        accountName={disconnectAccount?.accountName || ""}
        isLoading={isDisconnecting}
      />
    </div>
  );
}
