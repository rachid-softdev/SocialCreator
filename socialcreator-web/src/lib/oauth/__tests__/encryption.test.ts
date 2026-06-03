/**
 * Tests for OAuth Token Encryption module
 * Tests the encryption/decryption wrapper, expiration helpers, and formatting utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateTokenExpiration,
  decryptOAuthTokens,
  encryptOAuthTokens,
  formatTokenForLog,
  isTokenExpiring,
  isValidTokenFormat,
  prepareAccountForStorage,
  prepareAccountFromStorage,
} from "../encryption";

describe("OAuth Token Encryption", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin to a fixed date: 2025-06-01T12:00:00.000Z
    vi.setSystemTime(new Date("2025-06-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("encryptOAuthTokens / decryptOAuthTokens", () => {
    it("should encrypt and decrypt a token correctly", () => {
      const accessToken = "my-secret-access-token-12345";
      const encrypted = encryptOAuthTokens(accessToken);
      expect(encrypted.accessToken).not.toBe(accessToken);
      expect(encrypted.accessToken).toContain(":");
      expect(encrypted.refreshToken).toBeNull();
      expect(encrypted.expiresAt).toBeNull();

      const decrypted = decryptOAuthTokens(encrypted.accessToken);
      expect(decrypted.accessToken).toBe(accessToken);
    });

    it("should produce different ciphertexts each time (IV randomization)", () => {
      const token = "constant-token";
      const e1 = encryptOAuthTokens(token);
      const e2 = encryptOAuthTokens(token);
      expect(e1.accessToken).not.toBe(e2.accessToken);
    });

    it("should handle refresh token encryption", () => {
      const accessToken = "access-123";
      const refreshToken = "refresh-456";
      const encrypted = encryptOAuthTokens(accessToken, refreshToken);
      expect(encrypted.refreshToken).not.toBe(refreshToken);
      expect(encrypted.refreshToken).toContain(":");

      const decrypted = decryptOAuthTokens(encrypted.accessToken, encrypted.refreshToken);
      expect(decrypted.accessToken).toBe(accessToken);
      expect(decrypted.refreshToken).toBe(refreshToken);
    });

    it("should handle null refresh token", () => {
      const accessToken = "access-123";
      const encrypted = encryptOAuthTokens(accessToken, null);
      expect(encrypted.refreshToken).toBeNull();

      const decrypted = decryptOAuthTokens(encrypted.accessToken, null);
      expect(decrypted.refreshToken).toBeNull();
    });

    it("should handle expiresAt timestamp", () => {
      const accessToken = "access-123";
      const expiresAt = new Date("2025-07-01T12:00:00.000Z");
      const encrypted = encryptOAuthTokens(accessToken, null, expiresAt);
      expect(encrypted.expiresAt).toEqual(expiresAt);

      const decrypted = decryptOAuthTokens(encrypted.accessToken, null, expiresAt);
      expect(decrypted.expiresAt).toEqual(expiresAt);
    });

    it("should handle tokens with special characters", () => {
      const token = "ya29.a0AfH6SMD:token+with/special!chars@123";
      const encrypted = encryptOAuthTokens(token);
      const decrypted = decryptOAuthTokens(encrypted.accessToken);
      expect(decrypted.accessToken).toBe(token);
    });

    it("should handle unicode characters in tokens", () => {
      const token = "token_émojis_🎉_日本語";
      const encrypted = encryptOAuthTokens(token);
      const decrypted = decryptOAuthTokens(encrypted.accessToken);
      expect(decrypted.accessToken).toBe(token);
    });

    it("should throw on invalid ciphertext", () => {
      expect(() => decryptOAuthTokens("invalid:format")).toThrow();
      expect(() => decryptOAuthTokens("tooshort")).toThrow();
    });
  });

  describe("isTokenExpiring", () => {
    it("should return false when no expiration is set", () => {
      expect(isTokenExpiring(null)).toBe(false);
      expect(isTokenExpiring(undefined)).toBe(false);
    });

    it("should return false when token is not expiring soon (default 5 min buffer)", () => {
      const future = new Date("2025-06-01T13:00:00.000Z"); // 1 hour from now
      expect(isTokenExpiring(future)).toBe(false);
    });

    it("should return true when token is expired", () => {
      const past = new Date("2025-05-01T12:00:00.000Z"); // 1 month ago
      expect(isTokenExpiring(past)).toBe(true);
    });

    it("should return true when token expires within buffer window", () => {
      // Current: 2025-06-01T12:00:00.000Z, buffer 5 min
      const expiresIn4Min = new Date("2025-06-01T12:04:00.000Z");
      expect(isTokenExpiring(expiresIn4Min)).toBe(true);
    });

    it("should return false when token expires just outside buffer window", () => {
      const expiresIn6Min = new Date("2025-06-01T12:06:00.000Z");
      expect(isTokenExpiring(expiresIn6Min)).toBe(false);
    });

    it("should respect custom buffer minutes", () => {
      const expiresIn10Min = new Date("2025-06-01T12:10:00.000Z");
      expect(isTokenExpiring(expiresIn10Min, 15)).toBe(true);
      expect(isTokenExpiring(expiresIn10Min, 5)).toBe(false);
    });
  });

  describe("calculateTokenExpiration", () => {
    it("should calculate expiration from expires_in seconds", () => {
      const expiresAt = calculateTokenExpiration(3600);
      expect(expiresAt.getTime()).toBe(new Date("2025-06-01T13:00:00.000Z").getTime());
    });

    it("should handle 0 seconds", () => {
      const expiresAt = calculateTokenExpiration(0);
      expect(expiresAt.getTime()).toBe(new Date("2025-06-01T12:00:00.000Z").getTime());
    });

    it("should handle large values (e.g., 1 year)", () => {
      const expiresAt = calculateTokenExpiration(31536000);
      expect(expiresAt.getTime()).toBe(new Date("2026-06-01T12:00:00.000Z").getTime());
    });
  });

  describe("prepareAccountForStorage / prepareAccountFromStorage", () => {
    it("should prepare account for storage with encryption", () => {
      const result = prepareAccountForStorage("access-token", "refresh-token", 3600);
      expect(result.accessToken).toContain(":");
      expect(result.accessToken).not.toBe("access-token");
      expect(result.refreshToken).toContain(":");
      expect(result.refreshToken).not.toBe("refresh-token");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("should round-trip through storage prepare", () => {
      const stored = prepareAccountForStorage("my-access", "my-refresh", 7200);

      const fromDb = prepareAccountFromStorage({
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        expiresAt: stored.expiresAt,
      });

      expect(fromDb.accessToken).toBe("my-access");
      expect(fromDb.refreshToken).toBe("my-refresh");
      expect(fromDb.expiresAt).toBeInstanceOf(Date);
    });

    it("should handle null expiresIn (no expiration)", () => {
      const stored = prepareAccountForStorage("access", "refresh", null);
      expect(stored.expiresAt).toBeNull();
    });

    it("should handle missing refresh token", () => {
      const stored = prepareAccountForStorage("access", null);
      expect(stored.refreshToken).toBeNull();

      const fromDb = prepareAccountFromStorage({
        accessToken: stored.accessToken,
        refreshToken: null,
      });
      expect(fromDb.accessToken).toBe("access");
      expect(fromDb.refreshToken).toBeNull();
    });
  });

  describe("formatTokenForLog", () => {
    it("should mask token showing first and last 4 characters", () => {
      const token = "abcdefghijklmnop";
      const formatted = formatTokenForLog(token);
      expect(formatted).toBe("abcd...mnop");
    });

    it("should return *** for tokens shorter than 8 chars", () => {
      expect(formatTokenForLog("abc")).toBe("***");
      expect(formatTokenForLog("")).toBe("***");
    });

    it("should handle exact 8 character token", () => {
      expect(formatTokenForLog("12345678")).toBe("1234...5678");
    });

    it("should handle empty strings", () => {
      expect(formatTokenForLog("")).toBe("***");
    });
  });

  describe("isValidTokenFormat", () => {
    it("should return true for valid non-empty tokens", () => {
      expect(isValidTokenFormat("valid-token")).toBe(true);
    });

    it("should return false for null, undefined, or empty string", () => {
      expect(isValidTokenFormat(null)).toBe(false);
      expect(isValidTokenFormat(undefined)).toBe(false);
      expect(isValidTokenFormat("")).toBe(false);
    });

    it("should return false for tokens exceeding 10000 characters", () => {
      const longToken = "a".repeat(10001);
      expect(isValidTokenFormat(longToken)).toBe(false);
    });

    it("should return true for tokens at 9999 characters (just under limit)", () => {
      const token = "a".repeat(9999);
      expect(isValidTokenFormat(token)).toBe(true);
    });

    it("should return false for tokens at exactly 10000 characters (exclusive bound)", () => {
      const exactToken = "a".repeat(10000);
      expect(isValidTokenFormat(exactToken)).toBe(false);
    });
  });
});
