/**
 * Global Error Boundary Component
 * Catches React errors and displays a user-friendly error page
 *
 * Usage: Place in src/app/(main)/layout.tsx as:
 * <ErrorBoundary>
 *   <Component />
 * </ErrorBoundary>
 */

"use client";

import { Button } from "@socialcreator/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & {
    digest?: string;
    statusCode?: number;
  };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      statusCode: error.statusCode,
    });
  }, [error]);

  const isAuthError = error.message?.includes("Unauthorized") || error.statusCode === 401;
  const isNetworkError = error.message?.includes("fetch") || error.message?.includes("network");
  const isNotFound = error.message?.includes("not found") || error.statusCode === 404;

  const getErrorTitle = () => {
    if (isAuthError) return "Session Expired";
    if (isNetworkError) return "Connection Error";
    if (isNotFound) return "Not Found";
    return "Something went wrong";
  };

  const getErrorMessage = () => {
    if (isAuthError) return "Your session has expired. Please sign in again.";
    if (isNetworkError) return "Unable to connect to the server. Please check your connection.";
    if (isNotFound) return "The requested resource could not be found.";
    return error.message || "An unexpected error occurred. Please try again.";
  };

  const getErrorIcon = () => {
    if (isAuthError) return "🔐";
    if (isNetworkError) return "📡";
    if (isNotFound) return "🔍";
    return "⚠️";
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="text-6xl">{getErrorIcon()}</div>

      <div className="text-center space-y-2">
        <h2 className="font-display text-display-md text-ink">{getErrorTitle()}</h2>
        <p className="text-body-md text-body max-w-md">{getErrorMessage()}</p>
        {error.digest && <p className="text-caption text-muted">Error ID: {error.digest}</p>}
      </div>

      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="primary" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>

        <Button
          onClick={() => (window.location.href = "/dashboard")}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Go to Dashboard
        </Button>
      </div>

      {/* Error details for development */}
      {process.env.NODE_ENV === "development" && error.stack && (
        <details className="mt-8 w-full max-w-2xl">
          <summary className="cursor-pointer text-caption text-muted hover:text-body">
            Show error details
          </summary>
          <pre className="mt-4 overflow-auto rounded-lg bg-surface-dark p-4 text-body-sm text-on-dark">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Global Not Found Error Boundary (404)
 */
export function NotFoundError() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="text-6xl">🔍</div>
      <div className="text-center space-y-2">
        <h2 className="font-display text-display-md text-ink">Page Not Found</h2>
        <p className="text-body-md text-body max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button
        onClick={() => (window.location.href = "/dashboard")}
        variant="primary"
        className="flex items-center gap-2"
      >
        <Home className="h-4 w-4" />
        Go to Dashboard
      </Button>
    </div>
  );
}

/**
 * Session Expired Error Boundary
 */
export function SessionExpiredError() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="text-6xl">🔐</div>
      <div className="text-center space-y-2">
        <h2 className="font-display text-display-md text-ink">Session Expired</h2>
        <p className="text-body-md text-body max-w-md">
          Your session has expired. Please sign in again to continue.
        </p>
      </div>
      <div className="flex gap-4">
        <Button onClick={() => (window.location.href = "/login")} variant="primary">
          Sign In
        </Button>
        <Button onClick={() => (window.location.href = "/register")} variant="outline">
          Create Account
        </Button>
      </div>
    </div>
  );
}
