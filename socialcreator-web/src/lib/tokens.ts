/**
 * Token management utilities - handles token decryption, validation, and refresh
 */

import type { ConnectedAccount, Platform } from "@prisma/client";
import { decryptToken, encryptToken } from "./crypto";
import {
  isTokenExpired,
  type OAuthProvider,
  refreshAccessToken,
  type TokenResponse,
} from "./oauth";
import { prisma } from "./prisma";

/**
 * Get a valid access token for a connected account
 * Automatically refreshes the token if it's expired or about to expire
 * Returns the decrypted access token or null if refresh fails
 */
export async function getValidAccessToken(accountId: string): Promise<string | null> {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return null;
  }

  // Decrypt the access token
  let accessToken: string;
  try {
    accessToken = decryptToken(account.accessToken);
  } catch (error) {
    console.error("Failed to decrypt access token:", error);
    return null;
  }

  // Check if token needs refresh
  if (account.expiresAt && isTokenExpired(account.expiresAt)) {
    // Token is expired or about to expire, try to refresh
    if (account.refreshToken) {
      try {
        const refreshToken = decryptToken(account.refreshToken);
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
        console.error("Failed to refresh token:", error);
        // Token refresh failed, return the current token (might still work)
        return accessToken;
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
  const updateData: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  } = { accessToken: encryptToken(accessToken) };

  if (refreshToken) {
    updateData.refreshToken = encryptToken(refreshToken);
  }

  if (expiresIn) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    updateData.expiresAt = expiresAt;
  }

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: updateData,
  });
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
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  return await prisma.connectedAccount.create({
    data: {
      profileId,
      platform: platform as Platform,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt,
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName,
      accountAvatarUrl: accountInfo.accountAvatarUrl,
      isActive: true,
    },
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

  return await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      accessToken: encryptToken(tokens.access_token),
      refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
      expiresAt,
      accountId: accountInfo.accountId,
      accountName: accountInfo.accountName,
      accountAvatarUrl: accountInfo.accountAvatarUrl,
    },
  });
}

/**
 * Check if a connected account is active and has a valid token
 */
export async function isAccountValid(accountId: string): Promise<boolean> {
  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account?.isActive) {
    return false;
  }

  // Check if token is expired
  if (account.expiresAt && account.expiresAt < new Date()) {
    // Token is expired, try to refresh
    if (account.refreshToken) {
      try {
        const refreshToken = decryptToken(account.refreshToken);
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
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  });
}

/**
 * Reactivate a connected account
 */
export async function reactivateConnectedAccount(accountId: string): Promise<void> {
  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: { isActive: true },
  });
}
