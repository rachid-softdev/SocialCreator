/**
 * OAuth token revocation - revokes access tokens on platforms that support it
 */

import { getProviderCredentials, type OAuthProvider } from "./providers";

/**
 * Revoke an access token on the respective platform
 * Not all platforms support token revocation
 */
export async function revokeToken(platform: OAuthProvider, accessToken: string): Promise<boolean> {
  try {
    const p = platform as string;
    switch (p) {
      case "INSTAGRAM":
      case "FACEBOOK":
      case "THREADS":
        return await revokeMetaToken(accessToken);
      case "GOOGLE":
      case "YOUTUBE":
        return await revokeGoogleToken(accessToken);
      case "X":
        return await revokeTwitterToken(accessToken);
      case "LINKEDIN":
        return await revokeLinkedInToken(accessToken);
      case "PINTEREST":
        return await revokePinterestToken(accessToken);
      case "TIKTOK":
        // TikTok doesn't have a public revocation endpoint
        return false;
      default:
        return false;
    }
  } catch (error) {
    console.error(`Failed to revoke token for ${platform}:`, error);
    return false;
  }
}

/**
 * Revoke Meta (Facebook/Instagram/Threads) token
 */
async function revokeMetaToken(accessToken: string): Promise<boolean> {
  const response = await fetch("https://graph.facebook.com/v18.0/me/permissions", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.ok;
}

/**
 * Revoke Google token
 */
async function revokeGoogleToken(accessToken: string): Promise<boolean> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `token=${accessToken}`,
  });

  return response.ok || response.status === 400; // 400 means already revoked
}

/**
 * Revoke Twitter/X token
 */
async function revokeTwitterToken(accessToken: string): Promise<boolean> {
  const credentials = getProviderCredentials("X");

  if (!credentials.clientId) {
    return false;
  }

  const response = await fetch("https://api.twitter.com/2/oauth2/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${credentials.clientId}:${credentials.clientSecret}`,
      ).toString("base64")}`,
    },
    body: `token=${accessToken}`,
  });

  return response.ok;
}

/**
 * Revoke LinkedIn token
 */
async function revokeLinkedInToken(accessToken: string): Promise<boolean> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `token=${accessToken}`,
  });

  return response.ok;
}

/**
 * Revoke Pinterest token
 */
async function revokePinterestToken(accessToken: string): Promise<boolean> {
  // Pinterest doesn't have a public revocation API
  // We simply return false indicating we couldn't revoke
  return false;
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(
  platform: OAuthProvider,
  refreshToken: string,
): Promise<boolean> {
  // Most platforms don't have a separate refresh token revocation
  // The access token revocation should suffice
  return revokeToken(platform, refreshToken);
}
