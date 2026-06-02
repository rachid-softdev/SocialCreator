/**
 * Reusable test utilities for v1 API route tests
 */

import { NextRequest } from "next/server";

/**
 * Creates a mock NextRequest for v1 API testing
 */
export function createV1MockRequest(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): NextRequest {
  const url = `http://localhost:3000/api/v1${path}`;
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;

  return new NextRequest(url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body,
  });
}
