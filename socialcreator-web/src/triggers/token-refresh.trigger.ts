/**
 * OAuth Token Refresh worker
 * Refreshes expired or soon-to-expire OAuth tokens for connected accounts
 */

import { decryptToken, encryptToken } from "@/lib/crypto";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Run the token refresh for a given account
 */
export async function runTokenRefresh(accountId: string): Promise<{
  accountId: string;
  platform: string;
  refreshed: boolean;
  expiresAt?: string;
}> {
  logger.info({ accountId }, "Starting token refresh");

  const account = await prisma.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Connected account not found: ${accountId}`);
  }

  if (!account.refreshToken) {
    logger.warn({ accountId, platform: account.platform }, "No refresh token available");
    return { accountId, platform: account.platform, refreshed: false };
  }

  const decryptedRefreshToken = decryptToken(account.refreshToken);

  const newTokens = await refreshOAuthToken(account.platform, decryptedRefreshToken);

  if (!newTokens) {
    logger.warn({ accountId, platform: account.platform }, "Token refresh returned no tokens");
    return { accountId, platform: account.platform, refreshed: false };
  }

  await prisma.connectedAccount.update({
    where: { id: accountId },
    data: {
      accessToken: encryptToken(newTokens.accessToken),
      refreshToken: newTokens.refreshToken
        ? encryptToken(newTokens.refreshToken)
        : account.refreshToken,
      expiresAt: newTokens.expiresAt ?? null,
    },
  });

  logger.info({ accountId, platform: account.platform }, "Token refreshed successfully");

  return {
    accountId,
    platform: account.platform,
    refreshed: true,
    expiresAt: newTokens.expiresAt?.toISOString(),
  };
}

async function refreshOAuthToken(
  platform: string,
  refreshToken: string,
): Promise<TokenResponse | null> {
  const now = new Date();

  switch (platform) {
    case "INSTAGRAM":
    case "FACEBOOK": {
      const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      url.searchParams.set("grant_type", "fb_exchange_token");
      url.searchParams.set("client_id", process.env.META_CLIENT_ID!);
      url.searchParams.set("client_secret", process.env.META_CLIENT_SECRET!);
      url.searchParams.set("fb_exchange_token", refreshToken);

      const response = await fetchWithTimeout(url.toString(), { timeout: 10000 });
      if (!response.ok) return null;

      const data = await response.json();
      return {
        accessToken: data.access_token,
        expiresAt: new Date(now.getTime() + (data.expires_in || 5184000) * 1000),
      };
    }

    case "YOUTUBE": {
      const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        timeout: 10000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      });
      if (!response.ok) return null;

      const data = await response.json();
      return {
        accessToken: data.access_token,
        expiresAt: new Date(now.getTime() + data.expires_in * 1000),
      };
    }

    case "LINKEDIN": {
      const response = await fetchWithTimeout("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        timeout: 10000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      });
      if (!response.ok) return null;

      const data = await response.json();
      return {
        accessToken: data.access_token,
        expiresAt: new Date(now.getTime() + data.expires_in * 1000),
      };
    }

    default:
      return null;
  }
}
