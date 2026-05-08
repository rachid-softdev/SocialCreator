/**
 * Connect Account Modal
 * Shows available platforms to connect via OAuth popup
 */

"use client";

import { useState, useCallback } from "react";
import { Platform } from "@prisma/client";
import { PlatformIcon, getPlatformName } from "./platform-icon";
import { getAllPlatforms, getUnconnectedPlatforms } from "./account-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { platform: Platform }[];
  profileId: string;
  onConnected?: () => void;
}

export function ConnectModal({
  isOpen,
  onClose,
  accounts,
  profileId,
  onConnected,
}: ConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState<Platform | null>(null);

  const unconnectedPlatforms = getUnconnectedPlatforms(
    accounts as { platform: Platform }[]
  );

  const handleConnect = useCallback(
    async (platform: Platform) => {
      setIsConnecting(platform);

      try {
        // Get the OAuth redirect URL from our API
        const response = await fetch(
          `/api/connected-accounts/redirect/${platform.toLowerCase()}?profileId=${profileId}`
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to get OAuth URL");
        }

        const { redirectUrl } = await response.json();

        // Open OAuth in a popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          redirectUrl,
          `oauth-${platform}`,
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
        );

        // Listen for the popup to close and check for success
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnecting(null);
            // Notify parent to refresh the list
            onConnected?.();
            // Optionally close the modal
            onClose();
          }
        }, 500);

        // Close our modal while the OAuth is in progress
        onClose();
      } catch (error) {
        console.error("Failed to connect account:", error);
        setIsConnecting(null);
        // You could show a toast error here
        alert(
          error instanceof Error
            ? error.message
            : "Failed to connect account. Please try again."
        );
      }
    },
    [profileId, onConnected, onClose]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connecter un compte</DialogTitle>
          <DialogDescription>
            Sélectionnez une plateforme pour connecter votre compte social
          </DialogDescription>
        </DialogHeader>

        {unconnectedPlatforms.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              Tous les comptes sont déjà connectés !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {unconnectedPlatforms.map((platform) => (
              <Button
                key={platform}
                variant="outline"
                className="flex items-center gap-3 h-auto py-4 px-4 hover:bg-muted/50 hover:border-primary/50 transition-colors"
                onClick={() => handleConnect(platform)}
                disabled={isConnecting !== null}
              >
                <PlatformIcon platform={platform} size="md" />
                <span className="font-medium">{getPlatformName(platform)}</span>
                {isConnecting === platform && (
                  <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                )}
              </Button>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            Vous serez redirigé vers la plateforme pour autoriser la connexion.
            Assurez-vous deallow popups pour le processus d&apos;authentification.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}