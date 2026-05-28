import { createHash } from "node:crypto";
import AES from "crypto-js/aes";
import { vi } from "vitest";
import { decryptToken, encryptToken } from "../crypto";

// NOTE: crypto.ts loads SECRET from process.env.ENCRYPTION_KEY at import time.
// vitest.setup.ts sets ENCRYPTION_KEY="test-encryption-key" before all tests.
// The module-level SECRET is captured at import time with that value.
// vi.stubEnv in beforeEach does NOT retroactively change the imported module's SECRET.

describe("crypto", () => {
  const TEST_SECRET = "test-encryption-key";

  /**
   * Helper to generate a legacy-format encrypted token (crypto-js AES)
   * Must use the same SECRET value that the crypto module loaded at import time
   * (i.e., the pre-stub value from vitest.setup.ts: "test-encryption-key")
   */
  function createLegacyEncryptedToken(plaintext: string): string {
    const key = createHash("sha256").update(TEST_SECRET).digest("hex");
    return AES.encrypt(plaintext, key).toString();
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
    it("should decrypt legacy-format tokens correctly", () => {
      const token = "old-token-format";
      const legacyEncrypted = createLegacyEncryptedToken(token);

      const decrypted = decryptToken(legacyEncrypted);
      expect(decrypted).toBe(token);
    });

    it("should handle special characters in legacy format", () => {
      const token = "token!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const legacyEncrypted = createLegacyEncryptedToken(token);
      const decrypted = decryptToken(legacyEncrypted);
      expect(decrypted).toBe(token);
    });

    it("should handle unicode characters in legacy format", () => {
      const token = "token_émojis_🎉_日本語";
      const legacyEncrypted = createLegacyEncryptedToken(token);
      const decrypted = decryptToken(legacyEncrypted);
      expect(decrypted).toBe(token);
    });

    it("should emit console.warn when decrypting legacy format", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const token = "legacy-token-test";
      const legacyEncrypted = createLegacyEncryptedToken(token);

      decryptToken(legacyEncrypted);

      expect(warnSpy).toHaveBeenCalledWith(
        "Legacy crypto-js token detected. Please reconnect your account to upgrade encryption.",
      );

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
});
