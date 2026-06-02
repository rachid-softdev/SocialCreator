/**
 * Token management utilities - handles token decryption, validation, and refresh
 *
 * @note This is the SINGLE source of truth for token operations.
 * All OAuth token access should go through this module.
 * Do NOT create alternative token-handling functions elsewhere.
 */

import type { ConnectedAccount, Platform } from "@prisma/client";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";
import {
  isTokenExpired,
  type OAuthProvider,
  refreshAccessToken,
  type TokenResponse,
} from "./oauth";

/**
 * Get a valid access token for a connected account
 * Uses accountId (UUID) to look up the stored account.
 * Automatically refreshes the token if it's expired or about to expire.
 * Returns the decrypted access token or null if refresh fails.
 *
 * For profileId + platform lookup, use getValidAccessTokenByAccount()
 */
export async function getValidAccessToken(accountId: string): Promise<string | null> {
  const connectedAccountRepo = getRepositories().connectedAccount;
  const account = await connectedAccountRepo.findById(accountId);

  if (!account) {
    return null;
  }

  // Token is already decrypted by the repository
  const accessToken = account.accessToken;

  // Check if token needs refresh
  if (account.expiresAt && isTokenExpired(account.expiresAt)) {
    // Token is expired or about to expire, try to refresh
    if (account.refreshToken) {
      try {
        const refreshToken = account.refreshToken;
        const newTokens = await refreshAccessToken(account.platform as OAuthProvider, refreshToken);

        // Update the account with new tokens
        await updateAccountToken(
          accountId,
          newTokens.access_token,
          newTokens.refresh_token,
          newTokens.expires_in,
        );

        return newTokens.access_token;
      } catch (error) {
        logger.error({ err: error, accountId }, "Failed to refresh token — deactivating account");
        // Token refresh failed — deactivate the account and return null
        // Returning the expired token would cause confusing auth failures on the platform side
        await deactivateConnectedAccount(accountId).catch((e) =>
          logger.error({ err: e, accountId }, "Failed to deactivate account after refresh failure"),
        );
        return null;
      }
    }
  }

  return accessToken;
}

/**
 * Update a connected account with new token information
 * Encrypts both access and refresh tokens before storing
 */
export async function updateAccountToken(
  accountId: string,
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number,
): Promise<void> {
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

  // Repository handles encryption automatically
  const connectedAccountRepo = getRepositories().connectedAccount;
  await connectedAccountRepo.update(accountId, {
    accessToken,
    refreshToken: refreshToken ?? null,
    expiresAt,
  } as any);
}

/**
 * Create a new connected account with encrypted tokens
 */
export async function createConnectedAccount(
  profileId: string,
  platform: string,
  tokens: TokenResponse,
  accountInfo: {
    accountId: string;
    accountName: string;
    accountAvatarUrl: string | null;
  },
): Promise<ConnectedAccount> {
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined;

  // Repository handles encryption automatically
  const connectedAccountRepo = getRepositories().connectedAccount;
  return await connectedAccountRepo.create({
    profileId,
    platform: platform as Platform,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    accountId: accountInfo.accountId,
    accountName: accountInfo.accountName,
    accountAvatarUrl: accountInfo.accountAvatarUrl ?? undefined,
  });
}

/**
 * Update an existing connected account
 */
export async function updateConnectedAccount(
  accountId: string,
  tokens: TokenResponse,
  accountInfo: {
    accountId: string;
    accountName: string;
    accountAvatarUrl: string | null;
  },
): Promise<ConnectedAccount> {
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined;

  // Repository handles encryption automatically
  const connectedAccountRepo = getRepositories().connectedAccount;
  return await connectedAccountRepo.update(accountId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt,
    accountId: accountInfo.accountId,
    accountName: accountInfo.accountName,
    accountAvatarUrl: accountInfo.accountAvatarUrl ?? undefined,
  } as any);
}

/**
 * Check if a connected account is active and has a valid token
 */
export async function isAccountValid(accountId: string): Promise<boolean> {
  const connectedAccountRepo = getRepositories().connectedAccount;
  const account = await connectedAccountRepo.findById(accountId);

  if (!account?.isActive) {
    return false;
  }

  // Check if token is expired
  if (account.expiresAt && account.expiresAt < new Date()) {
    // Token is expired, try to refresh
    if (account.refreshToken) {
      try {
        const refreshToken = account.refreshToken;
        const newTokens = await refreshAccessToken(account.platform as OAuthProvider, refreshToken);
        await updateAccountToken(
          accountId,
          newTokens.access_token,
          newTokens.refresh_token,
          newTokens.expires_in,
        );
        return true;
      } catch {
        // Refresh failed, account is invalid
        return false;
      }
    }
    return false;
  }

  return true;
}

/**
 * Deactivate a connected account (without deleting it)
 */
export async function deactivateConnectedAccount(accountId: string): Promise<void> {
  const connectedAccountRepo = getRepositories().connectedAccount;
  await connectedAccountRepo.update(accountId, { isActive: false } as any);
}

/**
 * Reactivate a connected account
 */
export async function reactivateConnectedAccount(accountId: string): Promise<void> {
  const connectedAccountRepo = getRepositories().connectedAccount;
  await connectedAccountRepo.update(accountId, { isActive: true } as any);
}

/**
 * Get a valid access token by profileId + platform lookup
 * Convenience wrapper that resolves the accountId first, then calls getValidAccessToken()
 * This replaces the old oauth/middleware.ts getValidAccessToken(profileId, platform) function
 */
export async function getValidAccessTokenByAccount(
  profileId: string,
  platform: Platform,
): Promise<string | null> {
  const connectedAccountRepo = getRepositories().connectedAccount;
  const account = await connectedAccountRepo.findByProfileAndPlatform(profileId, platform);
  if (!account) return null;
  return getValidAccessToken(account.id);
}
