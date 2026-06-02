/**
 * Service-level OAuth utilities
 * Re-exports from the base OAuth layer for use by other services
 * (e.g., tokens.ts, which imports isTokenExpired, refreshAccessToken, etc.)
 */

export type { OAuthProvider, TokenResponse } from "@/lib/oauth";
export {
  isTokenExpired,
  refreshAccessToken,
} from "@/lib/oauth";
