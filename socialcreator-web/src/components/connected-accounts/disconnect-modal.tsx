/**
 * Disconnect Confirmation Modal
 * Warns user before disconnecting a social account
 */

"use client";

import type { Platform } from "@prisma/client";
import { Button } from "@socialcreator/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@socialcreator/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { getPlatformName, PlatformIcon } from "./platform-icon";

interface DisconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  platform: Platform;
  accountName: string;
  isLoading?: boolean;
}

export function DisconnectModal({
  isOpen,
  onClose,
  onConfirm,
  platform,
  accountName,
  isLoading = false,
}: DisconnectModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            Déconnecter le compte
          </DialogTitle>
          <DialogDescription className="mt-2">
            Êtes-vous sûr de vouloir déconnecter ce compte ?
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg mt-4">
          <PlatformIcon platform={platform} size="md" />
          <div>
            <p className="font-medium text-foreground">{accountName}</p>
            <p className="text-sm text-muted-foreground">{getPlatformName(platform)}</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Attention :</strong> Cela arrêtera toute publication sur ce compte. Vous devrez
            reconnecter le compte pour reprendre la publication automatique.
          </p>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading || isConfirming}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || isConfirming}
            className="gap-2"
          >
            {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
            Déconnecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
