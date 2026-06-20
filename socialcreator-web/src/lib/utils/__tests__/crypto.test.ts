/**
 * Tests for crypto utilities
 * AES-256-GCM encryption/decryption, hashing, token generation, masking
 *
 * NOTE: ENCRYPTION_KEY is set in vitest.setup.ts before any test file loads,
 * so the module-level `SECRET` is available at import time. We also assert
 * it in beforeAll as a secondary safety net (though module-level code runs
 * before beforeAll hooks).
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  decryptObject,
  decryptToken,
  encryptObject,
  encryptToken,
  generateSecureToken,
  hashString,
  maskString,
  verifyHash,
} from "../crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-that-is-32-bytes-long!!";
});

// ---------------------------------------------------------------------------
// encryptToken / decryptToken (round-trip)
// ---------------------------------------------------------------------------
describe("encryptToken / decryptToken — round-trip", () => {
  it("should round-trip a normal string token", () => {
    const token = "my_secret_token_123";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it("should round-trip a long token (1000+ characters)", () => {
    const token = "a".repeat(1500);
    const encrypted = encryptToken(token);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it("should round-trip a short token (1 character)", () => {
    const token = "x";
    const encrypted = encryptToken(token);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it("should round-trip tokens with special characters, unicode, emoji, and newlines", () => {
    const token = "Hello\nWorld\t\r\n🎉🔥日本語中文한국어`~!@#$%^&*()_+-=[]{}|;':\",./<>?\n";
    const encrypted = encryptToken(token);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it("should produce different ciphertext for the same plaintext (random IV)", () => {
    const token = "consistent-value";
    const a = encryptToken(token);
    const b = encryptToken(token);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// encryptToken — validation
// ---------------------------------------------------------------------------
describe("encryptToken — validation", () => {
  it("should throw for empty string", () => {
    expect(() => encryptToken("")).toThrow("Invalid token provided for encryption");
  });

  it("should throw for non-string input (number)", () => {
    expect(() => encryptToken(123 as unknown as string)).toThrow(
      "Invalid token provided for encryption",
    );
  });

  it("should throw for null input", () => {
    expect(() => encryptToken(null as unknown as string)).toThrow(
      "Invalid token provided for encryption",
    );
  });

  it("should throw for undefined input", () => {
    expect(() => encryptToken(undefined as unknown as string)).toThrow(
      "Invalid token provided for encryption",
    );
  });
});

// ---------------------------------------------------------------------------
// decryptToken — validation
// ---------------------------------------------------------------------------
describe("decryptToken — validation", () => {
  it("should throw for empty string", () => {
    expect(() => decryptToken("")).toThrow("Invalid encrypted string provided for decryption");
  });

  it("should throw for non-string input", () => {
    expect(() => decryptToken(null as unknown as string)).toThrow(
      "Invalid encrypted string provided for decryption",
    );
  });

  it("should throw for invalid format — 2 parts (1 colon)", () => {
    expect(() => decryptToken("part1:part2")).toThrow("Invalid encrypted format");
  });

  it("should throw for invalid format — 4 parts (3 colons)", () => {
    expect(() => decryptToken("a:b:c:d")).toThrow("Invalid encrypted format");
  });

  it("should throw for invalid format — single part (no colon)", () => {
    // The source fn expects exactly 3 parts; 1 part fails
    expect(() => decryptToken("justonerandomstring")).toThrow("Invalid encrypted format");
  });

  it("should throw for tampered ciphertext (GCM auth tag mismatch)", () => {
    const encrypted = encryptToken("original-value");
    const parts = encrypted.split(":");
    // Replace the ciphertext portion with garbage base64
    const tampered = `${parts[0]}:${parts[1]}:dGFtcGVyZWQ=`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("should throw for tampered IV", () => {
    const encrypted = encryptToken("test");
    const parts = encrypted.split(":");
    const tampered = `AAAAAAAAAAAAAAAAAAAAAA==:${parts[1]}:${parts[2]}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// encryptObject / decryptObject
// ---------------------------------------------------------------------------
describe("encryptObject / decryptObject", () => {
  it("should round-trip a simple object", () => {
    const obj = { key: "value", num: 42 };
    const encrypted = encryptObject(obj);
    expect(typeof encrypted).toBe("string");
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decryptObject<typeof obj>(encrypted);
    expect(decrypted).toEqual(obj);
  });

  it("should round-trip an empty object", () => {
    const obj = {};
    const encrypted = encryptObject(obj);
    const decrypted = decryptObject<typeof obj>(encrypted);
    expect(decrypted).toEqual({});
  });

  it("should round-trip a nested object", () => {
    const obj = { user: { id: "456", profile: { email: "test@example.com" } } };
    const encrypted = encryptObject(obj);
    const decrypted = decryptObject<typeof obj>(encrypted);
    expect(decrypted).toEqual(obj);
  });

  it("should round-trip an object with arrays", () => {
    const obj = { tags: ["a", "b", "c"], scores: [1, 2, 3] };
    const encrypted = encryptObject(obj);
    const decrypted = decryptObject<typeof obj>(encrypted);
    expect(decrypted).toEqual(obj);
  });

  it("should produce different ciphertext for the same object (random IV)", () => {
    const obj = { key: "value" };
    expect(encryptObject(obj)).not.toBe(encryptObject(obj));
  });

  // --- validation ---
  it("should throw for null input", () => {
    expect(() => encryptObject(null as unknown as object)).toThrow(
      "Invalid object provided for encryption",
    );
  });

  it("should throw for non-object input (string)", () => {
    expect(() => encryptObject("some-string" as unknown as object)).toThrow(
      "Invalid object provided for encryption",
    );
  });

  it("should throw for non-object input (number)", () => {
    expect(() => encryptObject(42 as unknown as object)).toThrow(
      "Invalid object provided for encryption",
    );
  });

  it("should throw when decrypting non-JSON content", () => {
    // encryptToken produces valid GCM ciphertext that decrypts to non-JSON text
    const encrypted = encryptToken("this-is-not-json");
    expect(() => decryptObject(encrypted)).toThrow("Failed to parse decrypted JSON");
  });
});

// ---------------------------------------------------------------------------
// generateSecureToken
// ---------------------------------------------------------------------------
describe("generateSecureToken", () => {
  it("should generate a token of default length 32", () => {
    expect(generateSecureToken()).toHaveLength(32);
  });

  it("should generate a token of custom length (16)", () => {
    expect(generateSecureToken(16)).toHaveLength(16);
  });

  it("should generate a token of custom length (64)", () => {
    expect(generateSecureToken(64)).toHaveLength(64);
  });

  it("should generate an empty string for length 0", () => {
    expect(generateSecureToken(0)).toBe("");
  });

  it("should contain only alphanumeric characters", () => {
    const token = generateSecureToken(1000);
    expect(token).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("should produce different tokens on successive calls (randomness)", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateSecureToken()));
    // With 10 tokens of length 32, all should be unique
    expect(tokens.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------
describe("hashString", () => {
  it("should produce a 64-character hex string (SHA-256)", () => {
    const hash = hashString("test-input");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce the same hash for the same input (deterministic)", () => {
    const input = "Hello World!";
    expect(hashString(input)).toBe(hashString(input));
  });

  it("should produce different hashes for different inputs", () => {
    expect(hashString("abc")).not.toBe(hashString("xyz"));
  });

  it("should handle an empty string", () => {
    const hash = hashString("");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle unicode characters", () => {
    const hash = hashString("日本語🎉🔥");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// verifyHash
// ---------------------------------------------------------------------------
describe("verifyHash", () => {
  it("should return true when input matches the hash", () => {
    const hash = hashString("mypassword");
    expect(verifyHash("mypassword", hash)).toBe(true);
  });

  it("should return false when input does not match the hash", () => {
    const hash = hashString("correct");
    expect(verifyHash("wrong", hash)).toBe(false);
  });

  it("should return false when buffers have different lengths (and not throw)", () => {
    expect(() => verifyHash("test", "tooshort")).not.toThrow();
    expect(verifyHash("test", "tooshort")).toBe(false);
  });

  it("should return false for a longer-than-expected hash string (and not throw)", () => {
    const longHash = "a".repeat(128);
    expect(() => verifyHash("test", longHash)).not.toThrow();
    expect(verifyHash("test", longHash)).toBe(false);
  });

  it("should handle empty strings (both empty)", () => {
    const hash = hashString("");
    expect(verifyHash("", hash)).toBe(true);
  });

  it("should handle empty hash against non-empty input", () => {
    expect(verifyHash("x", "")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// maskString
// ---------------------------------------------------------------------------
describe("maskString", () => {
  it("should show first and last 4 characters, masking the middle", () => {
    const result = maskString("abcdefghijklmnop");
    // "abcdefghijklmnop" length 16, visible 4+4=8, middle = min(8, 20) = 8
    expect(result).toBe("abcd********mnop");
  });

  it("should handle custom visibleChars count", () => {
    const result = maskString("abcdefghij", 1);
    expect(result).toBe("a********j");
  });

  it("should fully mask a short string (length <= 2 * visibleChars)", () => {
    // Length 6, visibleChars=4 → 6 <= 8 → fully masked
    expect(maskString("abcdef", 4)).toBe("******");
  });

  it("should fully mask a string of exactly 2 * visibleChars", () => {
    // Length 8, visibleChars=4 → 8 <= 8 → fully masked
    expect(maskString("12345678", 4)).toBe("********");
  });

  it("should mask a single character", () => {
    expect(maskString("a")).toBe("*");
  });

  it("should mask only two characters", () => {
    expect(maskString("ab")).toBe("**");
  });

  it("should cap middle asterisks at 20", () => {
    const long = "a".repeat(50);
    const result = maskString(long, 4);
    // 4 + min(42, 20) + 4 = 4 + 20 + 4 = 28
    expect(result).toHaveLength(28);
    expect(result.startsWith("aaaa")).toBe(true);
    expect(result.endsWith("aaaa")).toBe(true);
    expect(result).toMatch(/^aaaa\*+aaaa$/);
  });

  it("should return empty string for empty input", () => {
    expect(maskString("")).toBe("");
  });

  it("should return empty string for null", () => {
    expect(maskString(null as unknown as string)).toBe("");
  });

  it("should return empty string for undefined", () => {
    expect(maskString(undefined as unknown as string)).toBe("");
  });
});
