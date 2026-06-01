/**
 * HTTP fetch with timeout
 * Prevents hanging requests from consuming serverless function time
 */

export interface FetchTimeoutOptions extends RequestInit {
  timeout?: number; // milliseconds, default 8000
}

/**
 * Wrapper around fetch() that adds an AbortSignal timeout.
 * Throws an AbortError if the request exceeds the timeout.
 *
 * All external HTTP calls (OAuth token exchange, social media APIs,
 * user info lookups) should use this instead of raw fetch().
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchTimeoutOptions = {},
): Promise<Response> {
  const { timeout = 8000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
