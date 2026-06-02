/**
 * API Versioning utilities
 * URL prefix and header-based version resolution
 */

import type { NextResponse } from "next/server";

export type ApiVersion = "v1" | "v2" | "v3";
export const LATEST_VERSION: ApiVersion = "v1";
export const SUPPORTED_VERSIONS: ApiVersion[] = ["v1"];

export interface VersionInfo {
  version: ApiVersion;
  resolvedBy: "url" | "header" | "default";
}

/**
 * Extract version from URL pathname like /api/v1/content
 */
export function getVersionFromUrl(pathname: string): ApiVersion | null {
  const match = pathname.match(/^\/api\/(v\d+)\//);
  if (match && SUPPORTED_VERSIONS.includes(match[1] as ApiVersion)) {
    return match[1] as ApiVersion;
  }
  return null;
}

/**
 * Extract version from Accept-version header
 */
export function getVersionFromHeader(headers: Headers): ApiVersion | null {
  const header = headers.get("accept-version");
  if (header && SUPPORTED_VERSIONS.includes(header.trim() as ApiVersion)) {
    return header.trim() as ApiVersion;
  }
  return null;
}

/**
 * Resolve the API version from URL first, then header, then default
 */
export function resolveApiVersion(pathname: string, headers: Headers): VersionInfo {
  const fromUrl = getVersionFromUrl(pathname);
  if (fromUrl) return { version: fromUrl, resolvedBy: "url" };

  const fromHeader = getVersionFromHeader(headers);
  if (fromHeader) return { version: fromHeader, resolvedBy: "header" };

  return { version: LATEST_VERSION, resolvedBy: "default" };
}

/**
 * Add API version headers to a response
 */
export function addVersionHeaders(response: NextResponse, version: ApiVersion): void {
  response.headers.set("X-API-Version", version);
  response.headers.set("X-API-Latest-Version", LATEST_VERSION);
  response.headers.set("X-API-Supported-Versions", SUPPORTED_VERSIONS.join(", "));
}
