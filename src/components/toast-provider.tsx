/**
 * Toast Notification Provider
 * Wraps the application with Sonner for toast notifications
 * 
 * Usage: Add <ToastProvider /> to your root layout
 */

"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const toastOptions: ToasterProps = {
  position: "bottom-right",
  richColors: true,
  duration: 5000,
  closeButton: true,
  style: {
    background: "var(--colors-surface-card, #fff)",
    border: "1px solid var(--colors-hairline, #e7e5e4)",
    borderRadius: "12px",
    padding: "16px",
  },
  toastOptions: {
    style: {
      background: "var(--colors-surface-card, #fff)",
      border: "1px solid var(--colors-hairline, #e7e5e4)",
      borderRadius: "8px",
      padding: "12px 16px",
    },
    success: {
      style: {
        borderLeft: "4px solid var(--colors-semantic-success, #16a34a)",
      },
    },
    error: {
      style: {
        borderLeft: "4px solid var(--colors-semantic-error, #dc2626)",
      },
    },
    warning: {
      style: {
        borderLeft: "4px solid #f59e0b",
      },
    },
    info: {
      style: {
        borderLeft: "4px solid #3b82f6",
      },
    },
  },
};

export function ToastProvider() {
  return <Sonner {...toastOptions} />;
}

export { toastOptions };