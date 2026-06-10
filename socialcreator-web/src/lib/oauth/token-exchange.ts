/**
 * OAuth token exchange - exchanges authorization codes for access tokens
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { EXTERNAL_TIMEOUTS } from "@/lib/infrastructure/timeouts";
import { parseState } from "./auth-url";
import { getProviderCredentials, OAUTH_PROVIDERS, type OAuthProvider } from "./providers";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

function buildAuthHeaders(
  platform: OAuthProvider,
  clientId: string,
  clientSecret: string,
): { headers: Record<string, string> } {
  const config = OAUTH_PROVIDERS[platform];
  const commonHeaders: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (config.authMethod === "basic") {
    const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    return {
      headers: {
        ...commonHeaders,
        Authorization: `Basic ${encoded}`,
      },
    };
  }

  return { headers: commonHeaders };
}

/**
 * Exchange an authorization code for an access token
 * Each platform has its own token endpoint and response format
 */
export async function exchangeCodeForToken(
  platform: OAuthProvider,
  code: string,
  redirectUri: string,
  state?: string,
): Promise<TokenResponse> {
  const credentials = getProviderCredentials(platform);

  if (!credentials.clientId || !credentials.clientSecret) {
    throw new Error(`OAuth credentials not configured for ${platform}`);
  }

  const { headers } = buildAuthHeaders(platform, credentials.clientId, credentials.clientSecret);

  const formData = new URLSearchParams();

  // For body auth, include credentials in the form body
  if (OAUTH_PROVIDERS[platform].authMethod === "body") {
    formData.append("client_id", credentials.clientId);
    formData.append("client_secret", credentials.clientSecret);
  }

  formData.append("code", code);
  formData.append("redirect_uri", redirectUri);
  formData.append("grant_type", "authorization_code");

  // Platform-specific token request adjustments
  if (platform === "X") {
    // Twitter OAuth 2.0 requires PKCE code_verifier
    const codeVerifier = extractCodeVerifierFromState(state);
    if (!codeVerifier) {
      throw new Error("Missing code_verifier in state for X platform");
    }
    formData.append("code_verifier", codeVerifier);
  }

  const response = await fetchWithTimeout(getTokenUrl(platform), {
    method: "POST",
    timeout: EXTERNAL_TIMEOUTS.OAUTH_TOKEN_EXCHANGE,
    headers,
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

  const { headers } = buildAuthHeaders(platform, credentials.clientId, credentials.clientSecret);

  const formData = new URLSearchParams();

  // For body auth, include credentials in the form body
  if (OAUTH_PROVIDERS[platform].authMethod === "body") {
    formData.append("client_id", credentials.clientId);
    formData.append("client_secret", credentials.clientSecret);
  }

  formData.append("refresh_token", refreshToken);
  formData.append("grant_type", "refresh_token");

  const response = await fetchWithTimeout(getTokenUrl(platform), {
    method: "POST",
    timeout: EXTERNAL_TIMEOUTS.OAUTH_TOKEN_EXCHANGE,
    headers,
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
  if (!data.access_token) {
    throw new Error(`No access token in response for ${platform}`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || undefined,
    expires_in: data.expires_in || undefined,
    token_type: data.token_type || "Bearer",
    scope: data.scope || undefined,
  };
}

/**
 * Extract code_verifier from the OAuth state parameter
 * Uses parseState which handles AES-256-GCM decryption.
 */
function extractCodeVerifierFromState(state?: string): string | null {
  if (!state) return null;
  try {
    const decoded = parseState(state);
    return decoded?.codeVerifier || null;
  } catch {
    return null;
  }
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
