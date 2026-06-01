/**
 * Retry with exponential backoff + jitter
 * Usage: await withRetry(() => claude.messages.create({...}))
 *
 * S2.1 — IMPLEMENTATION_PLAN.md
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryOn?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
  retryOn: (error: Error) => {
    // Retry on rate limits (429) and server errors (5xx)
    const status = (error as any).status || (error as any).statusCode;
    if (status === 429 || (status >= 500 && status < 600)) return true;
    if (error.message?.includes("timeout") || error.message?.includes("rate limit")) return true;
    return false;
  },
};

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) break;
      if (!opts.retryOn(lastError)) throw lastError;

      // Exponential backoff with jitter
      const delay = Math.min(opts.baseDelayMs * 2 ** (attempt - 1), opts.maxDelayMs);
      const jitter = opts.jitter ? delay * 0.1 * Math.random() : 0;

      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
