/**
 * Cryptography utilities
 * AES-256 encryption for sensitive data (OAuth tokens, API keys)
 */

import { randomBytes, createHash } from "node:crypto";
import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";
import SHA256 from "crypto-js/sha256";

const SECRET = process.env.ENCRYPTION_KEY;
if (!SECRET) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is required. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

/**
 * Derive a 256-bit AES key from the ENCRYPTION_KEY secret
 * Uses SHA-256 to get a consistent 32-byte hex key
 */
function deriveKey(): string {
  return createHash("sha256").update(SECRET).digest("hex");
}

/**
 * Encrypt a string token using AES-256
 * @param token - Plain text token to encrypt
 * @returns Encrypted string (base64 encoded)
 */
export function encryptToken(token: string): string {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token provided for encryption");
  }
  return AES.encrypt(token, deriveKey()).toString();
}

/**
 * Decrypt an encrypted token
 * @param encrypted - Encrypted token string
 * @returns Decrypted plain text token
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted || typeof encrypted !== "string") {
    throw new Error("Invalid encrypted string provided for decryption");
  }

  const bytes = AES.decrypt(encrypted, deriveKey());
  const decrypted = bytes.toString(Utf8);

  if (!decrypted) {
    throw new Error("Decryption failed - invalid key or corrupted data");
  }

  return decrypted;
}

/**
 * Encrypt an object (serializes to JSON first)
 * @param obj - Object to encrypt
 * @returns Encrypted string
 */
export function encryptObject(obj: object): string {
  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid object provided for encryption");
  }
  return AES.encrypt(JSON.stringify(obj), deriveKey()).toString();
}

/**
 * Decrypt a JSON object
 * @param encrypted - Encrypted JSON string
 * @returns Parsed object
 */
export function decryptObject<T>(encrypted: string): T {
  if (!encrypted || typeof encrypted !== "string") {
    throw new Error("Invalid encrypted string provided for decryption");
  }

  const bytes = AES.decrypt(encrypted, deriveKey());
  const decrypted = bytes.toString(Utf8);

  if (!decrypted) {
    throw new Error("Decryption failed - invalid key or corrupted data");
  }

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    throw new Error("Failed to parse decrypted JSON");
  }
}

/**
 * Generate a secure random string
 * @param length - Length of the random string
 * @returns Random string
 */
export function generateSecureToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = new Uint8Array(length);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for Node.js
    const buf = randomBytes(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = buf[i];
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}

/**
 * Hash a string using SHA-256
 * @param input - String to hash
 * @returns Hex-encoded hash
 */
export function hashString(input: string): string {
  return SHA256(input).toString();
}

/**
 * Verify if a string matches a hash
 * @param input - Plain text input
 * @param hash - Expected hash
 * @returns Boolean indicating if they match
 */
export function verifyHash(input: string, hash: string): boolean {
  return hashString(input) === hash;
}

/**
 * Mask a sensitive string for display
 * @param value - String to mask
 * @param visibleChars - Number of visible characters at start/end
 * @returns Masked string
 */
export function maskString(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return "*".repeat(value?.length || 0);
  }

  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  const middle = "*".repeat(Math.min(value.length - visibleChars * 2, 20));

  return `${start}${middle}${end}`;
}
