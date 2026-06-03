/**
 * Toast Hook
 * Easy-to-use toast notifications throughout the application
 *
 * Usage:
 * import { useToast } from "@/hooks/use-toast";
 * const { success, error, info, warning } = useToast();
 *
 * success("Profile created successfully!");
 * error("Failed to save changes");
 */

"use client";

import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  description?: string;
  duration?: number;
}

interface ToastMethods {
  success: (title: string, options?: ToastOptions) => void;
  error: (title: string, options?: ToastOptions) => void;
  info: (title: string, options?: ToastOptions) => void;
  warning: (title: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

/**
 * Hook for displaying toast notifications
 */
export function useToast(): ToastMethods {
  const success = (title: string, options?: ToastOptions) => {
    sonnerToast.success(title, {
      description: options?.description,
      duration: options?.duration || 5000,
    });
  };

  const error = (title: string, options?: ToastOptions) => {
    sonnerToast.error(title, {
      description: options?.description,
      duration: options?.duration || 7000,
    });
  };

  const info = (title: string, options?: ToastOptions) => {
    sonnerToast.info(title, {
      description: options?.description,
      duration: options?.duration || 5000,
    });
  };

  const warning = (title: string, options?: ToastOptions) => {
    sonnerToast.warning(title, {
      description: options?.description,
      duration: options?.duration || 6000,
    });
  };

  const dismiss = () => {
    sonnerToast.dismiss();
  };

  return {
    success,
    error,
    info,
    warning,
    dismiss,
  };
}

/**
 * Promise-based toast for async operations
 * Shows loading state until promise resolves
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  },
): Promise<T> {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  }) as unknown as Promise<T>;
}

/**
 * API Error handler - converts API errors to user-friendly toasts
 */
export function handleApiError(error: unknown, fallbackMessage = "An error occurred"): void {
  let message = fallbackMessage;

  if (error instanceof Response) {
    // Try to parse error response
    error
      .json()
      .then((data: { error?: string; message?: string }) => {
        message = data.error || data.message || fallbackMessage;
        sonnerToast.error("Error", { description: message });
      })
      .catch(() => {
        sonnerToast.error("Error", { description: message });
      });
  } else if (error instanceof Error) {
    message = error.message || fallbackMessage;
    sonnerToast.error("Error", { description: message });
  } else {
    sonnerToast.error("Error", { description: message });
  }
}

/**
 * API Success handler - shows success toast
 */
export function handleApiSuccess(message: string, description?: string): void {
  sonnerToast.success(message, { description });
}

export { sonnerToast as toast };
