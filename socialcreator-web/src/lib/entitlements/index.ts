/**
 * Feature Flags & Entitlements - Main Export
 * Single entry point for the entitlements system
 */

// Types
export * from "./types"

// Core Services
export { getFeatureGateService, resetFeatureGateService, FeatureGateService } from "./service"
export { createFeatureNotAvailableError, createLimitReachedError, createSubscriptionExpiredError } from "./service"

// Repository
export { getEntitlementRepository, setEntitlementRepository, resetEntitlementRepository, PrismaEntitlementRepository } from "./repository"

// Cache
export { cacheService, getEntitlementsCacheKey, getEntitlementsRedis, clearMemoryCache } from "./cache"

// Stripe Webhook
export { handleStripeWebhook } from "./stripe-webhook"

// Downgrade
export { getDowngradeService, resetDowngradeService, DowngradeService } from "./downgrade"

// Middleware
export {
  requireFeature,
  requireLimit,
  consumeFeature,
  withEntitlements,
  withFeature,
  withLimit,
  withConsume,
  expressRequireFeature,
  expressConsumeFeature,
  getOrgIdFromRequest,
} from "./middleware"
export type { MiddlewareContext, MiddlewareHandler } from "./middleware"

// Default instance
import { getFeatureGateService } from "./service"
export default getFeatureGateService