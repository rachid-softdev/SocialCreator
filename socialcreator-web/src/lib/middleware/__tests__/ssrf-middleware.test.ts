/**
 * Tests for SSRF Validation Middleware
 *
 * Tests the validateRequestUrls function:
 * - Blocks private IPs (10.x.x.x, 192.168.x.x, 127.0.0.1, 172.16-31.x.x)
 * - Blocks metadata IPs (169.254.x.x)
 * - Allows public URLs (cdn.example.com, storage.googleapis.com)
 * - Handles array fields (mediaUrls.*)
 * - Handles empty body, unknown fields
 * - Logs on blocked requests
 */

import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock validate-url functions
vi.mock("@/lib/validate-url", () => ({
  validateMediaUrl: vi.fn(),
  validateMediaUrlWithDns: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import logger from "@/lib/logger";
import { validateRequestUrls } from "@/lib/middleware/ssrf-middleware";
import { validateMediaUrl, validateMediaUrlWithDns } from "@/lib/validate-url";

describe("SSRF Middleware — validateRequestUrls", () => {
  function mockUrlValid(): void {
    (validateMediaUrl as ReturnType<typeof vi.fn>).mockReturnValue({
      valid: true,
      sanitizedUrl: "https://cdn.example.com/file.mp4",
    });
    (validateMediaUrlWithDns as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      sanitizedUrl: "https://cdn.example.com/file.mp4",
    });
  }

  function mockUrlInvalid(reason = "Private IP addresses are not allowed"): void {
    (validateMediaUrl as ReturnType<typeof vi.fn>).mockReturnValue({
      valid: false,
      error: reason,
    });
    (validateMediaUrlWithDns as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      error: reason,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUrlValid();
  });

  describe("blocking private IPs", () => {
    it("should block 10.x.x.x addresses", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      const result = await validateRequestUrls({ url: "https://10.0.0.1/video.mp4" });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
      const body = await (result as NextResponse).json();
      expect(body.error).toContain("Private IP");
    });

    it("should block 192.168.x.x addresses", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      const result = await validateRequestUrls({ url: "https://192.168.1.1/video.mp4" });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("should block 127.0.0.1 (localhost)", async () => {
      mockUrlInvalid("Localhost URLs are not allowed");
      const result = await validateRequestUrls({ url: "https://127.0.0.1/video.mp4" });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("should block 172.16-31.x.x addresses", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      const result = await validateRequestUrls({ url: "https://172.16.0.1/video.mp4" });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  describe("blocking metadata IPs", () => {
    it("should block 169.254.x.x (metadata) addresses", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      const result = await validateRequestUrls({
        url: "https://169.254.169.254/latest/meta-data/",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  describe("allowing public URLs", () => {
    it("should allow cdn.example.com URLs", async () => {
      (validateMediaUrl as ReturnType<typeof vi.fn>).mockReturnValue({
        valid: true,
        sanitizedUrl: "https://cdn.example.com/video.mp4",
      });

      const result = await validateRequestUrls({ url: "https://cdn.example.com/video.mp4" });
      expect(result).toBeNull();
    });

    it("should allow storage.googleapis.com URLs", async () => {
      (validateMediaUrl as ReturnType<typeof vi.fn>).mockReturnValue({
        valid: true,
        sanitizedUrl: "https://storage.googleapis.com/bucket/file.mp4",
      });

      const result = await validateRequestUrls({
        url: "https://storage.googleapis.com/bucket/file.mp4",
      });
      expect(result).toBeNull();
    });
  });

  describe("array fields (mediaUrls.*)", () => {
    it("should validate all URLs in mediaUrls array", async () => {
      const result = await validateRequestUrls({
        mediaUrls: ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"],
      });

      expect(result).toBeNull();
      expect(validateMediaUrlWithDns).toHaveBeenCalledTimes(2);
    });

    it("should block if any URL in mediaUrls is private", async () => {
      (validateMediaUrlWithDns as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ valid: true, sanitizedUrl: "https://cdn.example.com/img1.jpg" })
        .mockResolvedValueOnce({ valid: false, error: "Private IP addresses are not allowed" });

      const result = await validateRequestUrls({
        mediaUrls: ["https://cdn.example.com/img1.jpg", "https://10.0.0.1/img2.jpg"],
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("should handle empty mediaUrls array", async () => {
      const result = await validateRequestUrls({ mediaUrls: [] });
      expect(result).toBeNull();
    });
  });

  describe("empty body", () => {
    it("should pass through empty body", async () => {
      const result = await validateRequestUrls({});
      expect(result).toBeNull();
    });

    it("should pass through body with only non-URL fields", async () => {
      const result = await validateRequestUrls({
        name: "test",
        description: "hello world",
        count: 42,
      });
      expect(result).toBeNull();
    });
  });

  describe("unknown fields", () => {
    it("should pass through unknown URL-like fields that are not in rules", async () => {
      const result = await validateRequestUrls({
        unknownUrl: "https://10.0.0.1/evil",
      });
      // Unknown fields are not in DEFAULT_RULES, so they pass through
      expect(result).toBeNull();
    });

    it("should still validate known fields alongside unknown ones", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      const result = await validateRequestUrls({
        url: "https://10.0.0.1/evil",
        unknownField: "whatever",
      });
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  describe("logging on blocked requests", () => {
    it("should log a warning when a URL is blocked", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      await validateRequestUrls({ url: "https://10.0.0.1/evil" });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://10.0.0.1/evil",
          field: "url",
          reason: "Private IP addresses are not allowed",
        }),
        expect.stringContaining("SSRF_BLOCKED"),
      );
    });

    it("should include body snippet in log", async () => {
      mockUrlInvalid("Private IP addresses are not allowed");
      await validateRequestUrls({ url: "https://10.0.0.1/evil", name: "test-body" });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          bodySnippet: expect.stringContaining("10.0.0.1"),
        }),
        expect.any(String),
      );
    });
  });

  describe("extractUrls edge cases", () => {
    it("should handle non-string values in array fields gracefully", async () => {
      const result = await validateRequestUrls({
        mediaUrls: [1, true, null, { url: "test" }],
      });
      // Non-string values in array are skipped
      expect(result).toBeNull();
    });

    it("should handle non-array valued for wildcard fields", async () => {
      const result = await validateRequestUrls({
        mediaUrls: "not-an-array",
      });
      // mediaUrls.* should only process arrays
      expect(result).toBeNull();
    });

    it("should handle missing fields entirely", async () => {
      const result = await validateRequestUrls({
        completelyUnrelated: "value",
      });
      expect(result).toBeNull();
    });
  });

  describe("custom rules", () => {
    it("should accept custom rules for additional fields", async () => {
      const customRules = [{ field: "customUrl", checkDns: true }];

      const result = await validateRequestUrls(
        { customUrl: "https://cdn.example.com/file.mp4" },
        customRules,
      );
      expect(result).toBeNull();
      expect(validateMediaUrlWithDns).toHaveBeenCalledWith("https://cdn.example.com/file.mp4");
    });

    it("should use checkDns=false rules for skip-dns fields", async () => {
      const customRules = [{ field: "avatarUrl", checkDns: false }];

      const result = await validateRequestUrls(
        { avatarUrl: "https://cdn.example.com/avatar.jpg" },
        customRules,
      );
      expect(result).toBeNull();
      expect(validateMediaUrl).toHaveBeenCalledWith("https://cdn.example.com/avatar.jpg");
      expect(validateMediaUrlWithDns).not.toHaveBeenCalled();
    });
  });
});
