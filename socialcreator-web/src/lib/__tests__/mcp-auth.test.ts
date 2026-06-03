/**
 * Tests for MCP authentication
 * - hashApiKey() produces correct SHA-256 hex output
 * - authenticateMcpRequest() uses hashed value in Prisma query
 * - getApiKeyPrefix() works correctly
 */

import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies before importing the module
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { headers } from "next/headers";
import { authenticateMcpRequest, getApiKeyPrefix, hashApiKey } from "@/app/api/mcp/auth";
import { prisma } from "@/lib/prisma";

describe("MCP Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashApiKey", () => {
    it("should produce a SHA-256 hex string", () => {
      const key = "test-api-key-12345";
      const hashed = hashApiKey(key);
      expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be deterministic for same input", () => {
      const key = "same-key-value";
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it("should produce different hashes for different keys", () => {
      expect(hashApiKey("key-one")).not.toBe(hashApiKey("key-two"));
    });

    it("should match Node.js crypto SHA-256 output", () => {
      const key = "validation-key";
      expect(hashApiKey(key)).toBe(crypto.createHash("sha256").update(key).digest("hex"));
    });

    it("should handle empty string", () => {
      expect(hashApiKey("")).toBe(crypto.createHash("sha256").update("").digest("hex"));
    });

    it("should handle special characters", () => {
      const key = "key!@#$%^&*()_+-=[]{}|;':\",./<>?🎉";
      expect(hashApiKey(key)).toMatch(/^[a-f0-9]{64}$/);
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });
  });

  describe("authenticateMcpRequest", () => {
    it("should return null when no authorization header is present", async () => {
      vi.mocked(headers).mockResolvedValue(new Map() as any);
      const result = await authenticateMcpRequest();
      expect(result).toBeNull();
    });

    it("should return null when authorization header does not start with Bearer", async () => {
      const headersMap = new Map<string, string>();
      headersMap.set("authorization", "Basic dGVzdDp0ZXN0");
      vi.mocked(headers).mockResolvedValue(headersMap as any);
      const result = await authenticateMcpRequest();
      expect(result).toBeNull();
    });

    it("should return null when token is empty after Bearer prefix", async () => {
      const headersMap = new Map<string, string>();
      headersMap.set("authorization", "Bearer ");
      vi.mocked(headers).mockResolvedValue(headersMap as any);
      const result = await authenticateMcpRequest();
      expect(result).toBeNull();
    });

    it("should query prisma with hashed token value", async () => {
      const token = "valid-api-key-12345";
      const expectedHash = hashApiKey(token);

      const headersMap = new Map<string, string>();
      headersMap.set("authorization", `Bearer ${token}`);
      vi.mocked(headers).mockResolvedValue(headersMap as any);
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
        id: "key-id-1",
        userId: "user-id-1",
      } as any);
      vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

      const result = await authenticateMcpRequest();

      // Verify prisma was called with the HASHED value, not the raw token
      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
        where: {
          keyHash: expectedHash,
          revokedAt: null,
        },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
        },
      });

      expect(result).toEqual({
        userId: "user-id-1",
        apiKeyId: "key-id-1",
      });
    });

    it("should return null when no matching API key is found", async () => {
      const headersMap = new Map<string, string>();
      headersMap.set("authorization", "Bearer nonexistent-key");
      vi.mocked(headers).mockResolvedValue(headersMap as any);
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

      const result = await authenticateMcpRequest();
      expect(result).toBeNull();
    });

    it("should update lastUsed timestamp on successful auth", async () => {
      const headersMap = new Map<string, string>();
      headersMap.set("authorization", "Bearer valid-key");
      vi.mocked(headers).mockResolvedValue(headersMap as any);
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
        id: "key-id-1",
        userId: "user-id-1",
      } as any);
      vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

      await authenticateMcpRequest();

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: "key-id-1" },
        data: { lastUsed: expect.any(Date) },
      });
    });
  });

  describe("getApiKeyPrefix", () => {
    it("should return first 8 characters followed by ellipsis", () => {
      expect(getApiKeyPrefix("sk_abc12345xyz")).toBe("sk_abc12...");
    });

    it("should handle keys shorter than 8 characters", () => {
      expect(getApiKeyPrefix("short")).toBe("short...");
    });
  });
});
