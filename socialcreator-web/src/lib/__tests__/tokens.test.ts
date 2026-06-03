import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, generateSecureToken, hashString, maskString } from "../crypto";

describe("crypto utilities", () => {
  describe("encryptToken", () => {
    it("should encrypt a token", () => {
      const token = "my-secret-token";
      const encrypted = encryptToken(token);

      expect(encrypted).not.toBe(token);
      expect(encrypted.length).toBeGreaterThan(token.length);
    });

    it("should produce different ciphertext for same input (due to random IV)", () => {
      const token = "test-token";
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // AES encrypt generates different IV each time, so ciphertext differs
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should throw error for empty token", () => {
      expect(() => encryptToken("")).toThrow("Invalid token");
      expect(() => encryptToken(null as any)).toThrow("Invalid token");
    });
  });

  describe("decryptToken", () => {
    it("should decrypt encrypted token back to original", () => {
      const original = "my-secret-token";
      const encrypted = encryptToken(original);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(original);
    });

    it("should throw error for invalid encrypted data", () => {
      expect(() => decryptToken("invalid-data")).toThrow();
    });
  });

  describe("round-trip encryption", () => {
    it("should handle various token formats", () => {
      const tokens = [
        "short",
        "a".repeat(100),
        "with-special-chars!@#$%",
        "123456789",
        " spaces around ",
      ];

      tokens.forEach((token) => {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });

    it("should handle long tokens", () => {
      const longToken = "x".repeat(1000);
      const encrypted = encryptToken(longToken);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(longToken);
    });
  });

  describe("hashString", () => {
    it("should produce SHA-256 hash", () => {
      const hash = hashString("test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be deterministic", () => {
      const hash1 = hashString("content");
      const hash2 = hashString("content");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different input", () => {
      const hash1 = hashString("abc");
      const hash2 = hashString("def");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = hashString("");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("maskString", () => {
    it("should mask string with default settings", () => {
      const masked = maskString("secret-token-1234");
      expect(masked).not.toBe("secret-token-1234");
      expect(masked.startsWith("secr")).toBe(true);
      expect(masked.endsWith("1234")).toBe(true);
    });

    it("should show only 4 characters at start and end by default", () => {
      const masked = maskString("1234567890");
      expect(masked).toBe("1234**7890");
    });

    it("should mask short strings completely", () => {
      const masked = maskString("abc");
      expect(masked).toBe("***");
    });

    it("should handle custom visible characters", () => {
      const masked = maskString("secret-token", 2);
      expect(masked.startsWith("se")).toBe(true);
    });
  });

  describe("generateSecureToken", () => {
    it("should generate token of specified length", () => {
      const token16 = generateSecureToken(16);
      const token32 = generateSecureToken(32);

      expect(token16.length).toBe(16);
      expect(token32.length).toBe(32);
    });

    it("should use default length of 32", () => {
      const token = generateSecureToken();
      expect(token.length).toBe(32);
    });

    it("should generate different tokens each time", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });

    it("should only contain alphanumeric characters", () => {
      const token = generateSecureToken(100);
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe("OAuth token simulation", () => {
    it("should simulate storing encrypted tokens", () => {
      const accessToken = "ya29.a0AfH6S...";
      const refreshToken = "1//0gK...";

      const encryptedAccess = encryptToken(accessToken);
      const encryptedRefresh = encryptToken(refreshToken);

      expect(encryptedAccess).not.toBe(accessToken);
      expect(encryptedRefresh).not.toBe(refreshToken);
    });

    it("should simulate retrieving and decrypting tokens", () => {
      const originalAccess = "ya29.a0AfH6SMB...";
      const encrypted = encryptToken(originalAccess);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalAccess);
    });

    it("should handle missing refresh token", () => {
      const accessToken = "token123";
      const encrypted = encryptToken(accessToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(accessToken);
    });
  });
});
