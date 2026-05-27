/**
 * OAuth Token Encryption Module
 * Handles encryption/decryption of OAuth tokens for secure storage
 */

import type { Platform } from "@prisma/client";
import { decryptToken, encryptToken } from "@/lib/crypto";

/**
 * Encrypted token data structure
 */
export interface EncryptedTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

/**
 * Decrypted token data structure
 */
export interface DecryptedTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

/**
 * Encrypt OAuth tokens before storage in database
 * @param accessToken - Plain text access token
 * @param refreshToken - Plain text refresh token (optional)
 * @param expiresAt - Token expiration date (optional)
 * @returns Encrypted tokens ready for storage
 */
export function encryptOAuthTokens(
  accessToken: string,
  refreshToken?: string | null,
  expiresAt?: Date | null,
): EncryptedTokens {
  return {
    accessToken: encryptToken(accessToken),
    refreshToken: refreshToken ? encryptToken(refreshToken) : null,
    expiresAt: expiresAt || null,
  };
}

/**
 * Decrypt OAuth tokens from database
 * @param encryptedAccess - Encrypted access token from DB
 * @param encryptedRefresh - Encrypted refresh token from DB (optional)
 * @param expiresAt - Token expiration date (optional)
 * @returns Decrypted tokens ready for use
 */
export function decryptOAuthTokens(
  encryptedAccess: string,
  encryptedRefresh?: string | null,
  expiresAt?: Date | null,
): DecryptedTokens {
  return {
    accessToken: decryptToken(encryptedAccess),
    refreshToken: encryptedRefresh ? decryptToken(encryptedRefresh) : null,
    expiresAt: expiresAt || null,
  };
}

/**
 * Check if a token is expired or about to expire
 * @param expiresAt - Token expiration date
 * @param bufferMinutes - Buffer time in minutes (default: 5 minutes)
 * @returns Boolean indicating if token needs refresh
 */
export function isTokenExpiring(
  expiresAt: Date | null | undefined,
  bufferMinutes: number = 5,
): boolean {
  if (!expiresAt) {
    return false; // No expiration set, assume valid
  }

  const bufferMs = bufferMinutes * 60 * 1000;
  const expiresWithBuffer = new Date(expiresAt.getTime() - bufferMs);

  return Date.now() >= expiresWithBuffer.getTime();
}

/**
 * Calculate token expiration date from expires_in seconds
 * @param expiresIn - Number of seconds until expiration
 * @returns Date object representing expiration
 */
export function calculateTokenExpiration(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Prepare account data for database storage (with encryption)
 * @param accessToken - Plain text access token
 * @param refreshToken - Plain text refresh token (optional)
 * @param expiresIn - Seconds until expiration (optional)
 * @returns Object ready for Prisma update/create
 */
export function prepareAccountForStorage(
  accessToken: string,
  refreshToken?: string | null,
  expiresIn?: number | null,
): {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
} {
  const encrypted = encryptOAuthTokens(accessToken, refreshToken || null);

  return {
    accessToken: encrypted.accessToken,
    refreshToken: encrypted.refreshToken ?? null,
    expiresAt: expiresIn ? calculateTokenExpiration(expiresIn) : null,
  };
}

/**
 * Prepare account data after retrieval from database (decrypted)
 * @param storedData - Raw data from database
 * @returns Decrypted tokens and metadata
 */
export function prepareAccountFromStorage(storedData: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}): DecryptedTokens {
  return decryptOAuthTokens(
    storedData.accessToken,
    storedData.refreshToken || null,
    storedData.expiresAt || null,
  );
}

/**
 * Format token for logging (masked)
 * @param token - Token to format
 * @returns Masked token string
 */
export function formatTokenForLog(token: string): string {
  if (!token || token.length < 8) {
    return "***";
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * Validate token format before encryption
 * @param token - Token to validate
 * @returns Boolean indicating if token appears valid
 */
export function isValidTokenFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  // Basic validation - tokens should be non-empty strings
  // Some tokens (like Facebook) can be very long, others (JWT) have specific formats
  return token.length > 0 && token.length < 10000;
}
