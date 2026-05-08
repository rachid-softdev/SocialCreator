/**
 * OAuth utilities - exports all OAuth-related functions
 */

// Providers configuration
export {
  OAUTH_PROVIDERS,
  getAuthBaseUrl,
  getRedirectUri,
  getProviderCredentials,
  isProviderConfigured,
} from "./providers";
export type { OAuthProvider } from "./providers";

// Auth URL builder
export {
  generateState,
  parseState,
  buildAuthUrl,
  buildAuthUrlWithParams,
} from "./auth-url";

// Token exchange
export {
  exchangeCodeForToken,
  refreshAccessToken,
  isTokenExpired,
  calculateExpiresAt,
} from "./token-exchange";
export type { TokenResponse } from "./token-exchange";

// User info
export {
  getUserInfo,
  getInstagramAccountId,
} from "./user-info";
export type { UserInfo } from "./user-info";

// Token revocation
export { revokeToken, revokeRefreshToken } from "./revoke";