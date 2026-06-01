import { randomUUID } from "node:crypto";

/**
 * Request ID utilities for distributed tracing
 *
 * Generates a unique request ID and provides header names
 * for propagating across services.
 *
 * S2.2 — IMPLEMENTATION_PLAN.md
 */

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Generate a unique request ID (UUID v4)
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Extract request ID from headers or generate new one
 */
export function getOrCreateRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing) return existing;
  return generateRequestId();
}
