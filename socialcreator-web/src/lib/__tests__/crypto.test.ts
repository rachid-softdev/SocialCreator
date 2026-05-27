import { vi } from "vitest";
import { encryptToken, decryptToken } from "../crypto";

describe("crypto", () => {
  const TEST_SECRET = "test-encryption-key-for-testing";

  beforeEach(() => {
    // Override the encryption key for testing
    vi.stubEnv("ENCRYPTION_KEY", TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("encryptToken", () => {
    it("should encrypt a token string", () => {
      const token = "test_token_123";
      const encrypted = encryptToken(token);

      expect(encrypted).not.toBe(token);
      expect(encrypted.length).toBeGreaterThan(token.length);
    });

    it("should produce different encryptions for same token with different keys", () => {
      const token = "same_token";

      // Temporarily change the key
      vi.stubEnv("ENCRYPTION_KEY", "key1");
      const encrypted1 = encryptToken(token);

      vi.stubEnv("ENCRYPTION_KEY", "key2");
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

    it("should handle empty strings", () => {
      const encrypted = encryptToken("");
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe("");
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
