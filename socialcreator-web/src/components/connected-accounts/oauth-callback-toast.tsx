/**
 * OAuth Callback Toast Component
 * Displays success/error notifications after OAuth redirect
 * Reads URL params on mount and shows appropriate sonner toast
 */

"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_error: "An OAuth error occurred. Please try again.",
  missing_params: "Missing authentication parameters. Please try again.",
  invalid_state: "Security verification failed. Please try again.",
  profile_not_found: "Profile not found. Please create a profile first.",
  access_denied: "Access was denied. Please grant the required permissions.",
  token_exchange_failed: "Failed to exchange authorization code. Please try again.",
  callback_failed: "Authentication callback failed. Please try again.",
};

const DEFAULT_ERROR_MESSAGE = "An unexpected error occurred during authentication.";

export function OAuthCallbackToast() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected === "success") {
      toast.success("Account connected successfully!", {
        description: "Your social account has been linked and is ready to use.",
        duration: 5000,
      });
    } else if (error) {
      const message = ERROR_MESSAGES[error] ?? DEFAULT_ERROR_MESSAGE;
      toast.error("Connection failed", {
        description: message,
        duration: 6000,
      });
    }

    // Clean URL params if there were any callback params
    if (connected || error) {
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}
