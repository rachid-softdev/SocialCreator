/**
 * ErrorBoundary + ErrorDisplay Components
 *
 * ErrorBoundary (default export):
 *   React class component that catches errors in its children tree.
 *   Usage: <ErrorBoundary><YourContent /></ErrorBoundary>
 *
 * ErrorDisplay (named export):
 *   The fallback UI rendered when an error is caught (also usable standalone).
 *
 * NotFoundError / SessionExpiredError (named exports):
 *   Specialized error UIs for 404 and session expiry.
 */

"use client";

import { Button } from "@socialcreator/ui/button";
import { AlertTriangle, Home, Lock, RefreshCw, Search as SearchIcon, WifiOff } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";

// ---------- ErrorBoundary (wrapper, default export) ----------

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: (Error & { digest?: string; statusCode?: number }) | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error: error as Error & { digest?: string; statusCode?: number } };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return <ErrorDisplay error={this.state.error} reset={() => this.setState({ error: null })} />;
    }

    return this.props.children;
  }
}

// ---------- Error Display UI (named export for standalone use) ----------

interface ErrorProps {
  error: Error & {
    digest?: string;
    statusCode?: number;
  };
  reset: () => void;
}

export function ErrorDisplay({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console in client context
    console.error("[ErrorDisplay]", error.message, {
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
    if (error.message && !error.message.startsWith("An unexpected")) return error.message;
    return "Something went wrong on our end. Try again — most issues are temporary.";
  };

  const getErrorIcon = () => {
    if (isAuthError) return <Lock className="w-12 h-12 text-muted" />;
    if (isNetworkError) return <WifiOff className="w-12 h-12 text-muted" />;
    if (isNotFound) return <SearchIcon className="w-12 h-12 text-muted" />;
    return <AlertTriangle className="w-12 h-12 text-muted" />;
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-surface-strong">
        {getErrorIcon()}
      </div>

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
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-surface-strong">
        <SearchIcon className="w-10 h-10 text-muted" />
      </div>
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
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-surface-strong">
        <Lock className="w-10 h-10 text-muted" />
      </div>
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

export default ErrorBoundary;
