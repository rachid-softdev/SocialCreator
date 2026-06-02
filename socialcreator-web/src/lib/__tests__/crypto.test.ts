import { vi } from "vitest";
import { decryptToken, encryptToken, hashString, verifyHash } from "../crypto";

// NOTE: crypto.ts loads SECRET from process.env.ENCRYPTION_KEY at import time.
// vitest.setup.ts sets ENCRYPTION_KEY="test-encryption-key" before all tests.
// The module-level SECRET is captured at import time with that value.
// vi.stubEnv in beforeEach does NOT retroactively change the imported module's SECRET.

describe("crypto", () => {
  /**
   * Generate a fake "legacy" encrypted token string (crypto-js was removed
   * from dependencies; legacy format is no longer supported).
   * We construct a base64 string that looks like a legacy crypto-js token
   * but is actually random garbage — the test only cares that decryptToken
   * throws for non-GCM-format strings.
   */
  function createLegacyEncryptedToken(_plaintext: string): string {
    // Produce a non-empty base64 string that will fail GCM decryption
    return Buffer.from(`legacy-mock:${_plaintext}`).toString("base64");
  }

  describe("encryptToken", () => {
    it("should encrypt a token string", () => {
      const token = "test_token_123";
      const encrypted = encryptToken(token);

      expect(encrypted).not.toBe(token);
      expect(encrypted.length).toBeGreaterThan(token.length);
    });

    it("should produce different encryptions for same token (due to random IV)", () => {
      const token = "same_token";
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("decryptToken", () => {
    it("should decrypt an encrypted token back to original", () => {
      const token = "my_secret_token";
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it("should throw error for empty strings", () => {
      expect(() => encryptToken("")).toThrow("Invalid token provided for encryption");
    });

    it("should handle special characters", () => {
      const token = "token!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });

    it("should handle unicode characters", () => {
      const token = "token_émojis_🎉_日本語";
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(token);
    });
  });

  describe("legacy format (crypto-js)", () => {
    // decryptToken has been refactored to use AES-256-GCM (node:crypto) only.
    // Legacy crypto-js format tokens are no longer supported and will throw.
    it("should throw for legacy-format tokens (no longer supported)", () => {
      const token = "old-token-format";
      const legacyEncrypted = createLegacyEncryptedToken(token);

      expect(() => decryptToken(legacyEncrypted)).toThrow("Invalid encrypted format");
    });

    it("should throw for special characters in legacy format", () => {
      const token = "token!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const legacyEncrypted = createLegacyEncryptedToken(token);
      expect(() => decryptToken(legacyEncrypted)).toThrow("Invalid encrypted format");
    });

    it("should throw for unicode characters in legacy format", () => {
      const token = "token_émojis_🎉_日本語";
      const legacyEncrypted = createLegacyEncryptedToken(token);
      expect(() => decryptToken(legacyEncrypted)).toThrow("Invalid encrypted format");
    });

    it("should not emit console.warn when trying legacy format (detection removed)", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const token = "legacy-token-test";
      const legacyEncrypted = createLegacyEncryptedToken(token);

      try {
        decryptToken(legacyEncrypted);
      } catch {
        // expected
      }

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe("new format (node:crypto)", () => {
    it("should NOT emit console.warn when decrypting new format", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const token = "new-format-token";
      const encrypted = encryptToken(token);
      decryptToken(encrypted);

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe("round-trip", () => {
    it("should handle various token formats", () => {
      const tokens = [
        "short",
        "a".repeat(100),
        "with-dashes",
        "with_underscores",
        "with.dots",
        "CamelCase",
        "UPPERCASE",
        "1234567890",
      ];

      tokens.forEach((token) => {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      });
    });
  });

  describe("verifyHash (timing-safe)", () => {
    it("should return true for matching input and hash", () => {
      const hash = hashString("correct-password");
      expect(verifyHash("correct-password", hash)).toBe(true);
    });

    it("should return false for non-matching input", () => {
      const hash = hashString("correct-password");
      expect(verifyHash("wrong-password", hash)).toBe(false);
    });

    it("should handle empty strings", () => {
      const hash = hashString("");
      expect(verifyHash("", hash)).toBe(true);
      expect(verifyHash("x", hash)).toBe(false);
    });

    it("should handle different hash lengths gracefully (no crash)", () => {
      // hashString returns 64 hex chars; a shorter string should not crash
      expect(() => verifyHash("test", "tooshort")).not.toThrow();
      expect(verifyHash("test", "tooshort")).toBe(false);
    });

    it("should be constant-time (not crash on any input)", () => {
      // This should never throw regardless of input
      expect(() => verifyHash("anything", "anything")).not.toThrow();
      expect(() => verifyHash("", "")).not.toThrow();
      expect(() => verifyHash("a", "b")).not.toThrow();
    });
  });
});
