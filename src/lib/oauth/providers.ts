/**
 * OAuth provider configurations for each social platform
 * Each platform has its own OAuth credentials and endpoints
 */

export const OAUTH_PROVIDERS = {
  INSTAGRAM: {
    name: "Instagram",
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: "instagram_basic instagram_content_publish pages_read_engagement",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,picture",
    color: "#E1306C",
  },
  TIKTOK: {
    name: "TikTok",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    authUrl: "https://www.tiktok.com/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/access_token/",
    scopes: "user.info.basic post.video",
    userInfoUrl: "https://open.tiktokapis.com/v2/user/info/",
    color: "#000000",
  },
  LINKEDIN: {
    name: "LinkedIn",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: "openid profile email w_member_social",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    color: "#0A66C2",
  },
  X: {
    name: "X",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: "tweet.read users.write offline.access",
    userInfoUrl: "https://api.twitter.com/2/users/me",
    color: "#000000",
  },
  YOUTUBE: {
    name: "YouTube",
    // Via Google OAuth
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/youtube.force-ssl",
    userInfoUrl: "https://www.googleapis.com/youtube/v3/channels",
    color: "#FF0000",
  },
  FACEBOOK: {
    name: "Facebook",
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: "pages_read_engagement publish_to_groups",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,picture",
    color: "#1877F2",
  },
  PINTEREST: {
    name: "Pinterest",
    clientIdEnv: "PINTEREST_CLIENT_ID",
    clientSecretEnv: "PINTEREST_CLIENT_SECRET",
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/access_token",
    scopes: "boards:read boards:write pins:read pins:write",
    userInfoUrl: "https://api.pinterest.com/v5/user_account",
    color: "#E60023",
  },
  THREADS: {
    name: "Threads",
    // Via Meta OAuth (same as Instagram)
    clientIdEnv: "META_CLIENT_ID",
    clientSecretEnv: "META_CLIENT_SECRET",
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: "threads_basic_exposure threads_content_publish",
    userInfoUrl: "https://graph.facebook.com/me",
    color: "#000000",
  },
} as const;

export type OAuthProvider = keyof typeof OAUTH_PROVIDERS;

/**
 * Get the base URL for OAuth callbacks
 * Uses environment variable or defaults to localhost in development
 */
export function getAuthBaseUrl(): string {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL;
  }
  // Development fallback
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  // Production - should be set in environment
  return process.env.NEXT_PUBLIC_APP_URL || "https://socialcreator.app";
}

/**
 * Get the redirect URI for a specific platform
 */
export function getRedirectUri(platform: OAuthProvider): string {
  const baseUrl = getAuthBaseUrl();
  return `${baseUrl}/api/connected-accounts/callback/${platform.toLowerCase()}`;
}

/**
 * Get credentials for a provider
 */
export function getProviderCredentials(provider: OAuthProvider) {
  const config = OAUTH_PROVIDERS[provider];
  return {
    clientId: process.env[config.clientIdEnv],
    clientSecret: process.env[config.clientSecretEnv],
  };
}

/**
 * Check if a provider has valid credentials configured
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const { clientId, clientSecret } = getProviderCredentials(provider);
  return !!(clientId && clientSecret);
}