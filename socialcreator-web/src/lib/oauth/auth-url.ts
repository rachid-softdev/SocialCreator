/**
 * OAuth URL builder - generates authorization URLs with proper state handling
 */

import { createHash, randomBytes } from "node:crypto";
import { getRedirectUri, OAUTH_PROVIDERS, type OAuthProvider } from "./providers";

interface AuthState {
  platform: string;
  profileId: string;
  timestamp: number;
  codeVerifier?: string;
}

/**
 * Generate a state parameter for CSRF protection
 * The state is a base64-encoded JSON object containing platform, profileId, and timestamp
 */
export function generateState(platform: string, profileId: string, codeVerifier?: string): string {
  const state: AuthState = {
    platform,
    profileId,
    timestamp: Date.now(),
    ...(codeVerifier ? { codeVerifier } : {}),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

/**
 * Generate a PKCE code verifier (64 bytes of random data, base64url encoded)
 */
export function generatePKCEVerifier(): string {
  return randomBytes(64)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate a PKCE code challenge (S256 = SHA-256 hash of verifier, base64url encoded)
 */
export function generatePKCEChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Parse and validate a state parameter
 * Returns null if the state is invalid or expired (older than 10 minutes)
 */
export function parseState(state: string): AuthState | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    const isExpired = Date.now() - decoded.timestamp > 10 * 60 * 1000; // 10 minutes

    if (isExpired) {
      return null;
    }

    return decoded as AuthState;
  } catch {
    return null;
  }
}

/**
 * Build the OAuth authorization URL for a given platform and profile
 * Includes all required parameters: client_id, redirect_uri, scope, response_type, state
 */
export function buildAuthUrl(platform: OAuthProvider, profileId: string): string {
  const config = OAUTH_PROVIDERS[platform];
  const redirectUri = getRedirectUri(platform);

  // Build query parameters
  const params = new URLSearchParams({
    client_id: process.env[config.clientIdEnv] || "",
    redirect_uri: redirectUri,
    scope: config.scopes,
    response_type: "code",
    state: generateState(platform, profileId),
  });

  // Platform-specific additional parameters
  if (platform === "X") {
    // X (Twitter) OAuth 2.0 requires PKCE
    const verifier = generatePKCEVerifier();
    const challenge = generatePKCEChallenge(verifier);
    params.set("code_challenge", challenge);
    params.set("code_challenge_method", "S256");
    // Embed the code_verifier in state for use during token exchange
    params.set("state", generateState(platform, profileId, verifier));
  }

  if (platform === "LINKEDIN") {
    // LinkedIn requires specific redirect URI format
    params.set("redirect_uri", redirectUri);
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Build auth URL with optional additional parameters
 */
export function buildAuthUrlWithParams(
  platform: OAuthProvider,
  profileId: string,
  additionalParams?: Record<string, string>,
): string {
  let url = buildAuthUrl(platform, profileId);

  if (additionalParams) {
    const params = new URLSearchParams(additionalParams);
    url += `&${params.toString()}`;
  }

  return url;
}
