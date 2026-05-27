/**
 * Cryptography utilities
 * AES-256 encryption for sensitive data (OAuth tokens, API keys)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

const SECRET = process.env.ENCRYPTION_KEY;
if (!SECRET) {
  throw new Error(
    "ENCRYPTION_KEY environment variable is required. " +
      "Generate one with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\"",
  );
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Derive a 256-bit AES key from the ENCRYPTION_KEY secret
 * Uses SHA-256 to get a consistent 32-byte hex key
 */
function deriveKey(): Buffer {
  return createHash("sha256").update(SECRET).digest();
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
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt an encrypted token
 * Supports both legacy (crypto-js AES, single base64 string) and new
 * (node:crypto AES-256-GCM, iv:tag:ciphertext) formats.
 * All NEW encryptions use AES-256-GCM via node:crypto.
 * Old crypto-js format falls back on decrypt only — migration strategy.
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted || typeof encrypted !== "string") {
    throw new Error("Invalid encrypted string provided for decryption");
  }

  const parts = encrypted.split(":");

  // New format (node:crypto AES-256-GCM): iv:tag:ciphertext
  if (parts.length === 3) {
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  }

  // Legacy format (crypto-js AES): single base64 string with embedded salt/IV
  // Used for all tokens encrypted before migration to node:crypto
  try {
    const legacyKey = createHash("sha256").update(SECRET).digest("hex");
    const bytes = AES.decrypt(encrypted, legacyKey);
    const decrypted = bytes.toString(Utf8);
    if (!decrypted) {
      throw new Error("Failed to decrypt with legacy crypto-js format");
    }
    return decrypted;
  } catch (_err) {
    throw new Error("Decryption failed - token may be corrupted or encryption key has changed");
  }
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
  return encryptToken(JSON.stringify(obj));
}

/**
 * Decrypt a JSON object
 * @param encrypted - Encrypted JSON string
 * @returns Parsed object
 */
export function decryptObject<T>(encrypted: string): T {
  const decrypted = decryptToken(encrypted);
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
  return createHash("sha256").update(input).digest("hex");
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
