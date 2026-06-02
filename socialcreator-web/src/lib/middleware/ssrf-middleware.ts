/**
 * SSRF (Server-Side Request Forgery) Validation Middleware
 *
 * Validates user-supplied URLs in request bodies against private/loopback networks
 * to prevent SSRF attacks. Uses the existing validate-url.ts utility under the hood.
 *
 * Usage:
 *   const ssrfError = await validateRequestUrls(body);
 *   if (ssrfError) return ssrfError;
 */

import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { validateMediaUrl, validateMediaUrlWithDns } from "@/lib/validate-url";

export interface SsrfRule {
  /** JSON path to the URL field (e.g., "url" or "mediaUrls.*") */
  field: string;
  /** Whether to perform DNS resolution check (slower but more secure) */
  checkDns: boolean;
}

const DEFAULT_RULES: SsrfRule[] = [
  { field: "url", checkDns: true },
  { field: "uploadUrl", checkDns: true },
  { field: "mediaUrls.*", checkDns: true },
  { field: "avatarUrl", checkDns: false },
  { field: "imageUrl", checkDns: true },
];

/**
 * Validate all URL fields in a request body against SSRF rules.
 * Returns a 400 response if any URL is invalid, otherwise null.
 *
 * @param body - Parsed JSON request body
 * @param rules - SSRF validation rules (defaults to sensible defaults)
 * @returns NextResponse with 400 error or null if valid
 */
export async function validateRequestUrls(
  body: Record<string, unknown>,
  rules: SsrfRule[] = DEFAULT_RULES,
): Promise<NextResponse | null> {
  for (const rule of rules) {
    const urls = extractUrls(body, rule.field);

    for (const url of urls) {
      const result = rule.checkDns ? await validateMediaUrlWithDns(url) : validateMediaUrl(url);

      if (!result.valid) {
        logger.warn(
          {
            url,
            field: rule.field,
            reason: result.error,
            bodySnippet: JSON.stringify(body).slice(0, 200),
          },
          "SSRF_BLOCKED — validation blocked request",
        );

        return NextResponse.json(
          { error: `Invalid URL in field '${rule.field}': ${result.error}` },
          { status: 400 },
        );
      }
    }
  }

  return null;
}

/**
 * Extract URL values from a request body using dot-notation field paths.
 * Supports "field.*" for array fields (e.g., "mediaUrls.*" extracts all items).
 */
function extractUrls(body: Record<string, unknown>, fieldPath: string): string[] {
  const urls: string[] = [];

  if (fieldPath.endsWith(".*")) {
    const key = fieldPath.slice(0, -2);
    const arr = body[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === "string") urls.push(item);
      }
    }
  } else {
    const val = body[fieldPath];
    if (typeof val === "string") urls.push(val);
  }

  return urls;
}
