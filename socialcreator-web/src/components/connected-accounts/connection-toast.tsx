/**
 * Connection Toast Helpers
 * Convenience functions for OAuth connect/disconnect notifications
 * Uses the existing sonner toast system via the useToast hook
 */

"use client";

import { toast } from "sonner";

/**
 * Show success toast after connecting a social account
 */
export function showConnectionSuccess(platformName: string): void {
  toast.success(`${platformName} account connected successfully!`, {
    description: "Your account has been linked and is ready to use.",
    duration: 5000,
  });
}

/**
 * Show error toast after failing to connect a social account
 */
export function showConnectionError(platformName: string, errorMessage?: string): void {
  toast.error(`Failed to connect ${platformName}`, {
    description:
      errorMessage || "An error occurred while connecting your account. Please try again.",
    duration: 5000,
  });
}

/**
 * Show success toast after disconnecting a social account
 */
export function showDisconnectSuccess(platformName: string): void {
  toast.success(`${platformName} account disconnected`, {
    description: "The account has been disconnected successfully.",
    duration: 5000,
  });
}

/**
 * Show error toast after failing to disconnect a social account
 */
export function showDisconnectError(platformName: string): void {
  toast.error(`Failed to disconnect ${platformName}`, {
    description: "An error occurred while disconnecting your account. Please try again.",
    duration: 5000,
  });
}
