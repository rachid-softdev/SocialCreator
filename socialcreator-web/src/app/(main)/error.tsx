"use client";

import { AlertCircle } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-semantic-error/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-semantic-error" />
        </div>
        <h1 className="text-title-lg text-ink">Something went wrong</h1>
        <p className="text-body-md text-muted">An unexpected error occurred. Please try again.</p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-pill bg-primary text-on-primary text-button hover:bg-primary-active transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-pill border border-hairline text-button hover:bg-surface-strong transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-4 text-left text-xs text-muted bg-surface-card p-4 rounded-lg overflow-auto max-h-48">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}
