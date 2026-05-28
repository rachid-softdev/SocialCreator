/**
 * Cryptography utilities
 * AES-256 encryption for sensitive data (OAuth tokens, API keys)
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

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
 * Uses AES-256-GCM with format: base64(iv):base64(tag):base64(ciphertext)
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted || typeof encrypted !== "string") {
    throw new Error("Invalid encrypted string provided for decryption");
  }

  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format — expected iv:tag:ciphertext (AES-256-GCM)");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, deriveKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
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
 * Generate a secure random string using crypto.randomInt for unbiased selection
 * @param length - Length of the random string
 * @returns Random string
 */
export function generateSecureToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    // randomInt is unbiased (uses rejection sampling internally)
    result += chars[randomInt(chars.length)];
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
  const inputHash = hashString(input);
  const inputBuffer = Buffer.from(inputHash);
  const hashBuffer = Buffer.from(hash);

  if (inputBuffer.length !== hashBuffer.length) {
    // Masquer la différence de longueur avec une comparaison factice
    timingSafeEqual(inputBuffer, inputBuffer);
    return false;
  }

  return timingSafeEqual(inputBuffer, hashBuffer);
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
