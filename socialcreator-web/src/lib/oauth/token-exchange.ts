/**
 * OAuth token exchange - exchanges authorization codes for access tokens
 */

import { OAuthProvider, getProviderCredentials } from "./providers";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Exchange an authorization code for an access token
 * Each platform has its own token endpoint and response format
 */
export async function exchangeCodeForToken(
  platform: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const credentials = getProviderCredentials(platform);

  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error(`OAuth credentials not configured for ${platform}`);
  }

  const formData = new URLSearchParams();
  formData.append("client_id", credentials.clientId);
  formData.append("client_secret", credentials.clientSecret);
  formData.append("code", code);
  formData.append("redirect_uri", redirectUri);
  formData.append("grant_type", "authorization_code");

  // Platform-specific token request adjustments
  if (platform === "X") {
    // Twitter OAuth 2.0
    formData.append("code_verifier", "challenge");
  }

  const response = await fetch(getTokenUrl(platform), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed for ${platform}: ${error}`);
  }

  const data = await response.json();

  // Normalize the response to our TokenResponse interface
  return normalizeTokenResponse(platform, data);
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  platform: OAuthProvider,
  refreshToken: string,
): Promise<TokenResponse> {
  const credentials = getProviderCredentials(platform);

  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error(`OAuth credentials not configured for ${platform}`);
  }

  const formData = new URLSearchParams();
  formData.append("client_id", credentials.clientId);
  formData.append("client_secret", credentials.clientSecret);
  formData.append("refresh_token", refreshToken);
  formData.append("grant_type", "refresh_token");

  // Platform-specific adjustments
  if (platform === "X") {
    formData.append("grant_type", "refresh_token");
  }

  const response = await fetch(getTokenUrl(platform), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed for ${platform}: ${error}`);
  }

  const data = await response.json();
  return normalizeTokenResponse(platform, data);
}

/**
 * Get the token URL for a platform
 */
function getTokenUrl(platform: OAuthProvider): string {
  const urls: Record<OAuthProvider, string> = {
    INSTAGRAM: "https://graph.facebook.com/v18.0/oauth/access_token",
    TIKTOK: "https://open.tiktokapis.com/v2/oauth/access_token/",
    LINKEDIN: "https://www.linkedin.com/oauth/v2/accessToken",
    X: "https://api.twitter.com/2/oauth2/token",
    YOUTUBE: "https://oauth2.googleapis.com/token",
    FACEBOOK: "https://graph.facebook.com/v18.0/oauth/access_token",
    PINTEREST: "https://api.pinterest.com/v5/oauth/access_token",
    THREADS: "https://graph.facebook.com/v18.0/oauth/access_token",
  };
  return urls[platform];
}

/**
 * Normalize the token response from different platforms
 * Each platform may return the token in slightly different formats
 */
function normalizeTokenResponse(platform: OAuthProvider, data: any): TokenResponse {
  // Different platforms use different field names
  const accessToken =
    data.access_token || data.accessToken || data.access_token_response?.access_token;

  if (!accessToken) {
    throw new Error(`No access token in response for ${platform}`);
  }

  return {
    access_token: accessToken,
    refresh_token: data.refresh_token || data.refreshToken || undefined,
    expires_in: data.expires_in || data.expiresIn || undefined,
    token_type: data.token_type || data.tokenType || "Bearer",
    scope: data.scope || undefined,
  };
}

/**
 * Check if a token needs refresh based on its expiration time
 * Returns true if the token expires within the next 5 minutes
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return false; // No expiration set, assume valid
  }
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return expiresAt < fiveMinutesFromNow;
}

/**
 * Calculate the expiration date from expires_in seconds
 */
export function calculateExpiresAt(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}
