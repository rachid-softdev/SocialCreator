/**
 * Feature Flags & Entitlements - Main Export
 * Single entry point for the entitlements system
 */

// Cache
export {
  cacheService,
  clearMemoryCache,
  getEntitlementsCacheKey,
  getEntitlementsRedis,
} from "./cache";
// Downgrade
export { DowngradeService, getDowngradeService, resetDowngradeService } from "./downgrade";
export type { MiddlewareContext, MiddlewareHandler } from "./middleware";
// Middleware
export {
  consumeFeature,
  expressConsumeFeature,
  expressRequireFeature,
  getOrgIdFromRequest,
  requireFeature,
  requireLimit,
  withConsume,
  withEntitlements,
  withFeature,
  withLimit,
} from "./middleware";
// Repository
export {
  getEntitlementRepository,
  PrismaEntitlementRepository,
  resetEntitlementRepository,
  setEntitlementRepository,
} from "./repository";
// Core Services
export {
  createFeatureNotAvailableError,
  createLimitReachedError,
  createSubscriptionExpiredError,
  FeatureGateService,
  getFeatureGateService,
  resetFeatureGateService,
} from "./service";
// Stripe Webhook
export { handleStripeWebhook } from "./stripe-webhook";
// Types
export * from "./types";

// Default instance
import { getFeatureGateService } from "./service";
export default getFeatureGateService;
