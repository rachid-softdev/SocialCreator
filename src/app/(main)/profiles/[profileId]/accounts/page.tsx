/**
 * Connected Accounts Page
 * Displays and manages connected social accounts for a profile
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Platform, ConnectedAccount as ConnectedAccountType } from "@prisma/client";
import { PageHeader } from "@/components/layout/page-header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { AccountList, getUnconnectedPlatforms, getAllPlatforms } from "@/components/connected-accounts/account-list";
import { ConnectModal } from "@/components/connected-accounts/connect-modal";
import { DisconnectModal } from "@/components/connected-accounts/disconnect-modal";
import { PlatformIcon } from "@/components/connected-accounts/platform-icon";
import { Plus, AlertCircle, CheckCircle2 } from "lucide-react";

interface ConnectedAccountResponse {
  id: string;
  platform: Platform;
  accountId: string;
  accountName: string;
  accountAvatarUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function ConnectedAccountsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const profileId = params.profileId as string;

  const [accounts, setAccounts] = useState<ConnectedAccountType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [disconnectAccount, setDisconnectAccount] = useState<ConnectedAccountType | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Check for success/error from OAuth callback
  const connected = searchParams.get("connected");
  const errorParam = searchParams.get("error");

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/connected-accounts?profileId=${profileId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const data: ConnectedAccountResponse[] = await response.json();

      // Convert to ConnectedAccountType format
      setAccounts(
        data.map((acc) => ({
          id: acc.id,
          profileId,
          platform: acc.platform,
          accessToken: "",
          refreshToken: null,
          expiresAt: acc.expiresAt ? new Date(acc.expiresAt) : null,
          accountId: acc.accountId,
          accountName: acc.accountName,
          accountAvatarUrl: acc.accountAvatarUrl,
          isActive: acc.isActive,
          createdAt: new Date(acc.createdAt),
          updatedAt: new Date(acc.createdAt),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Initial load
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Show success/error toasts (could be replaced with proper toast component)
  useEffect(() => {
    if (connected === "success") {
      // Clear the URL params
      router.replace(`/profiles/${profileId}/accounts`);
    }
    if (errorParam) {
      // Show error (could be a toast)
      console.error("OAuth error:", errorParam);
      router.replace(`/profiles/${profileId}/accounts`);
    }
  }, [connected, errorParam, router, profileId]);

  // Handle disconnect
  const handleDisconnect = async (accountId: string) => {
    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/connected-accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect account");
      }

      // Refresh the list
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setIsDisconnecting(false);
      setDisconnectAccount(null);
    }
  };

  // Handle refresh token
  const handleRefresh = async (accountId: string) => {
    try {
      const response = await fetch(`/api/connected-accounts/${accountId}/refresh`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }

      // Refresh the list
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to refresh token:", err);
    }
  };

  const unconnectedPlatforms = getUnconnectedPlatforms(
    accounts as { platform: Platform }[]
  );

  const breadcrumbItems = [
    { label: "Profils", href: "/profiles" },
    { label: "Comptes connectés", href: `/profiles/${profileId}/accounts` },
  ];

  return (
    <div className="container max-w-4xl py-8">
      <Breadcrumb items={breadcrumbItems} />

      <PageHeader
        title="Comptes connectés"
        description="Gérez vos comptes sociaux connectés pour la publication automatique"
        actions={
          unconnectedPlatforms.length > 0 && (
            <Button
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-2"
            >
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
          <p className="text-muted-foreground">
            Tous les comptes sociaux sont connectés !
          </p>
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