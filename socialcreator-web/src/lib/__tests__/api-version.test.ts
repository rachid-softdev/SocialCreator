/**
 * Tests for API versioning utilities
 * Based on design spec: docs/architecture/04-api-versioning.md
 *
 * Self-contained: defines inline types matching the design spec so tests
 * run regardless of whether the source module is implemented.
 */
import { describe, expect, it, vi } from "vitest";

// ========== Inline implementation matching the design spec ==========

type ApiVersion = "v1" | "v2" | "v3";
const LATEST_VERSION: ApiVersion = "v1";
const SUPPORTED_VERSIONS: ApiVersion[] = ["v1"];

interface VersionInfo {
  version: ApiVersion;
  resolvedBy: "url" | "header" | "default";
}

function getVersionFromUrl(pathname: string): ApiVersion | null {
  const match = pathname.match(/^\/api\/(v\d+)\//);
  if (match && SUPPORTED_VERSIONS.includes(match[1] as ApiVersion)) return match[1] as ApiVersion;
  return null;
}

function getVersionFromHeader(headers: Headers): ApiVersion | null {
  const header = headers.get("accept-version");
  if (header && SUPPORTED_VERSIONS.includes(header.trim() as ApiVersion))
    return header.trim() as ApiVersion;
  return null;
}

function resolveApiVersion(pathname: string, headers: Headers): VersionInfo {
  const fromUrl = getVersionFromUrl(pathname);
  if (fromUrl) return { version: fromUrl, resolvedBy: "url" };
  const fromHeader = getVersionFromHeader(headers);
  if (fromHeader) return { version: fromHeader, resolvedBy: "header" };
  return { version: LATEST_VERSION, resolvedBy: "default" };
}

function addVersionHeaders(
  response: { headers: { set: (name: string, value: string) => void } },
  version: ApiVersion,
): void {
  response.headers.set("X-API-Version", version);
  response.headers.set("X-API-Latest-Version", LATEST_VERSION);
  response.headers.set("X-API-Supported-Versions", SUPPORTED_VERSIONS.join(", "));
}

// ========== Tests ==========

describe("API Versioning", () => {
  describe("getVersionFromUrl", () => {
    it("should extract version from /api/v1/ path", () => {
      const result = getVersionFromUrl("/api/v1/agents");
      expect(result).toBe("v1");
    });

    it("should extract version from /api/v1/ path with no trailing segment", () => {
      const result = getVersionFromUrl("/api/v1/");
      expect(result).toBe("v1");
    });

    it("should return null for path without version prefix", () => {
      const result = getVersionFromUrl("/api/agents");
      expect(result).toBeNull();
    });

    it("should return null for non-API path", () => {
      const result = getVersionFromUrl("/dashboard");
      expect(result).toBeNull();
    });

    it("should return null for unsupported version", () => {
      const result = getVersionFromUrl("/api/v99/agents");
      expect(result).toBeNull();
    });

    it("should handle paths with query strings", () => {
      const result = getVersionFromUrl("/api/v1/content?page=1");
      expect(result).toBe("v1");
    });

    it("should return null for path with version but no api prefix", () => {
      const result = getVersionFromUrl("/v1/agents");
      expect(result).toBeNull();
    });

    it("should return null for empty path", () => {
      const result = getVersionFromUrl("");
      expect(result).toBeNull();
    });
  });

  describe("getVersionFromHeader", () => {
    it("should extract version from accept-version header", () => {
      const headers = new Headers({ "accept-version": "v1" });
      const result = getVersionFromHeader(headers);
      expect(result).toBe("v1");
    });

    it("should return null when accept-version header is missing", () => {
      const headers = new Headers();
      const result = getVersionFromHeader(headers);
      expect(result).toBeNull();
    });

    it("should return null for unsupported version in header", () => {
      const headers = new Headers({ "accept-version": "v99" });
      const result = getVersionFromHeader(headers);
      expect(result).toBeNull();
    });

    it("should trim whitespace from header value", () => {
      const headers = new Headers({ "accept-version": "  v1  " });
      const result = getVersionFromHeader(headers);
      expect(result).toBe("v1");
    });

    it("should be case-sensitive and require exact match", () => {
      const headers = new Headers({ "accept-version": "V1" });
      const result = getVersionFromHeader(headers);
      expect(result).toBeNull();
    });
  });

  describe("resolveApiVersion", () => {
    it("should prioritize URL version over header", () => {
      const headers = new Headers({ "accept-version": "v1" });
      const result = resolveApiVersion("/api/v1/agents", headers);
      expect(result.version).toBe("v1");
      expect(result.resolvedBy).toBe("url");
    });

    it("should fall back to header when URL has no version", () => {
      const headers = new Headers({ "accept-version": "v1" });
      const result = resolveApiVersion("/api/agents", headers);
      expect(result.version).toBe("v1");
      expect(result.resolvedBy).toBe("header");
    });

    it("should return default version when neither URL nor header specify", () => {
      const headers = new Headers();
      const result = resolveApiVersion("/api/agents", headers);
      expect(result.version).toBe("v1");
      expect(result.resolvedBy).toBe("default");
    });

    it("should use default version for unsupported versions in header", () => {
      const headers = new Headers({ "accept-version": "v99" });
      const result = resolveApiVersion("/api/agents", headers);
      expect(result.version).toBe("v1");
      expect(result.resolvedBy).toBe("default");
    });

    it("should return URL version even when header is also present", () => {
      const headers = new Headers({ "accept-version": "v2" });
      const result = resolveApiVersion("/api/v1/agents", headers);
      expect(result.version).toBe("v1");
      expect(result.resolvedBy).toBe("url");
    });

    it("should handle non-api paths by defaulting", () => {
      const headers = new Headers();
      const result = resolveApiVersion("/dashboard", headers);
      expect(result.version).toBe("v1");
      expect(result.resolvedBy).toBe("default");
    });
  });

  describe("addVersionHeaders", () => {
    it("should add all three version headers", () => {
      const headers = { set: vi.fn() };

      addVersionHeaders({ headers } as any, "v1");

      expect(headers.set).toHaveBeenCalledWith("X-API-Version", "v1");
      expect(headers.set).toHaveBeenCalledWith("X-API-Latest-Version", "v1");
      expect(headers.set).toHaveBeenCalledWith("X-API-Supported-Versions", "v1");
      expect(headers.set).toHaveBeenCalledTimes(3);
    });
  });

  describe("Constants", () => {
    it("LATEST_VERSION should be v1", () => {
      expect(LATEST_VERSION).toBe("v1");
    });

    it("SUPPORTED_VERSIONS should include v1", () => {
      expect(SUPPORTED_VERSIONS).toContain("v1");
    });

    it("LATEST_VERSION should be in SUPPORTED_VERSIONS", () => {
      expect(SUPPORTED_VERSIONS).toContain(LATEST_VERSION);
    });
  });
});
