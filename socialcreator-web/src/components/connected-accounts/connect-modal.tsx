/**
 * Connect Account Modal
 * Shows available platforms to connect via OAuth popup
 */

"use client";

import type { Platform } from "@prisma/client";
import { Button } from "@socialcreator/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@socialcreator/ui/dialog";
import { AlertTriangle, Check, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import logger from "@/lib/logger";
import { getUnconnectedPlatforms } from "./account-list";
import { getPlatformName, PlatformIcon } from "./platform-icon";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { platform: Platform }[];
  profileId: string;
  onConnected?: () => void;
}

type ConnectionStatus = "idle" | "connecting" | "success";

export function ConnectModal({
  isOpen,
  onClose,
  accounts,
  profileId,
  onConnected,
}: ConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState<Platform | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unconnectedPlatforms = getUnconnectedPlatforms(accounts as any[]);

  // Cleanup intervals and timeouts on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const resetState = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setError(null);
    setPopupBlocked(false);
    setConnectionStatus("idle");
    setIsConnecting(null);
  }, []);

  const handleConnect = useCallback(
    async (platform: Platform) => {
      // Reset previous state
      setError(null);
      setPopupBlocked(false);
      setConnectionStatus("connecting");
      setIsConnecting(platform);

      try {
        // Get the OAuth redirect URL from our API
        const response = await fetch(
          `/api/connected-accounts/redirect/${platform.toLowerCase()}?profileId=${profileId}`,
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to get OAuth URL");
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
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`,
        );

        // Detect popup blocker
        if (!popup) {
          setPopupBlocked(true);
          setConnectionStatus("idle");
          setIsConnecting(null);
          return;
        }

        // Clear any existing interval before starting a new one
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Poll for popup to close
        intervalRef.current = setInterval(() => {
          if (popup.closed) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setConnectionStatus("success");
            // Show success state briefly, then close and refresh
            timeoutRef.current = setTimeout(() => {
              timeoutRef.current = null;
              setIsConnecting(null);
              onConnected?.();
              onClose();
            }, 1500);
          }
        }, 500);
      } catch (err) {
        logger.error({ err }, "Failed to connect account");
        setError(
          err instanceof Error ? err.message : "Failed to connect account. Please try again.",
        );
        setConnectionStatus("idle");
        setIsConnecting(null);
      }
    },
    [profileId, onConnected, onClose],
  );

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connecter un compte</DialogTitle>
          <DialogDescription>
            Sélectionnez une plateforme pour connecter votre compte social
          </DialogDescription>
        </DialogHeader>

        {/* Success State */}
        {connectionStatus === "success" && (
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium text-green-500">Connected successfully!</p>
              <p className="text-sm text-green-500/70">Your account has been linked.</p>
            </div>
          </div>
        )}

        {/* Inline Error State */}
        {error && connectionStatus !== "success" && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg mt-2">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Popup Blocked Warning */}
        {popupBlocked && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500 text-sm">
                Pop-up blocked. Please allow pop-ups for this site in your browser settings.
              </p>
              <p className="text-xs text-amber-500/70 mt-1">
                <ExternalLink className="w-3 h-3 inline-block mr-1" />
                You can also try opening the link manually.
              </p>
            </div>
          </div>
        )}

        {/* Platform Selection (hidden during success) */}
        {connectionStatus !== "success" && (
          <>
            {unconnectedPlatforms.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">Tous les comptes sont déjà connectés !</p>
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
                Vous serez redirigé vers la plateforme pour autoriser la connexion. Assurez-vous de
                permettre les pop-ups pour le processus d&apos;authentification.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
