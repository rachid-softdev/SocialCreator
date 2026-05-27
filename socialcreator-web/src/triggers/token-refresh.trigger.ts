// OAuth Token Refresh Trigger Job
// Refreshes expired or soon-to-expire OAuth tokens for connected accounts

import { client } from "@/lib/trigger";

// Mock triggerHttpPayload - will be replaced with actual implementation
const triggerHttpPayload = (config: any) => config;
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

export const tokenRefreshJob = client.defineJob({
  id: "token-refresh",
  name: "OAuth Token Refresh",
  version: "0.1.0",
  trigger: triggerHttpPayload({
    schema: z.object({
      accountId: z.string(),
    }),
  }),
  output: z.object({
    accountId: z.string(),
    platform: z.string(),
    refreshed: z.boolean(),
    expiresAt: z.string().optional(),
  }),
  retries: {
    maxAttempts: 3,
    backoff: { type: "exponential", seconds: [10, 30, 60] },
  },
  run: async (payload: any, io: any) => {
    const { accountId } = payload;

    await io.logger.info("Starting token refresh", { accountId });

    const account = await prisma.connectedAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Connected account not found: ${accountId}`);
    }

    if (!account.refreshToken) {
      await io.logger.warn("No refresh token available", {
        accountId,
        platform: account.platform,
      });
      return { accountId, platform: account.platform, refreshed: false };
    }

    const decryptedRefreshToken = decryptToken(account.refreshToken);

    const newTokens = await refreshOAuthToken(account.platform, decryptedRefreshToken);

    if (!newTokens) {
      await io.logger.warn("Token refresh returned no tokens", {
        accountId,
        platform: account.platform,
      });
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

    await io.logger.info("Token refreshed successfully", {
      accountId,
      platform: account.platform,
    });

    return {
      accountId,
      platform: account.platform,
      refreshed: true,
      expiresAt: newTokens.expiresAt?.toISOString(),
    };
  },
});

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
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

      const response = await fetch(url.toString());
      if (!response.ok) return null;

      const data = await response.json();
      return {
        accessToken: data.access_token,
        expiresAt: new Date(now.getTime() + (data.expires_in || 5184000) * 1000),
      };
    }

    case "YOUTUBE": {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
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
      const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
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
