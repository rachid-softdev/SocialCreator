/**
 * Feature Flags & Entitlements - FeatureGateService
 * Central service - the ONLY source of truth for entitlements
 * No if(plan === "PRO") in endpoints - everything goes through here
 */

import type {
  EntitlementValue,
  DebugTrace,
  ConsumeResult,
  EntitlementMap,
  EntitlementError,
  FeatureType,
  ResolutionSource,
  ExperimentConfig,
  SubscriptionStatus,
} from "./types"
import { getEntitlementRepository } from "./repository"
import { cacheService, getEntitlementsCacheKey } from "./cache"
import { getStripe } from "@/lib/stripe"

// Simple hash function for A/B testing (murmurhash-like)
function murmurhash(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(31, h) + key.charCodeAt(i) | 0
  }
  return h
}

function getExperimentBucket(seed: string, userId: string, percentage: number): number {
  const bucket = murmurhash(`${seed}:${userId}`) % 100
  return bucket
}

// ============================================
// FeatureGateService
// ============================================

export class FeatureGateService {
  private repo = getEntitlementRepository()

  /**
   * Check if a feature is enabled for an org
   * Uses cache-first strategy
   */
  async hasFeature(orgId: string, featureKey: string): Promise<boolean> {
    const value = await this.resolveEntitlement(orgId, featureKey)
    return value.enabled
  }

  /**
   * Get the limit for a feature (null = unlimited)
   */
  async getLimit(orgId: string, limitKey: string): Promise<number | null> {
    const value = await this.resolveEntitlement(orgId, limitKey)
    return value.limit
  }

  /**
   * Assert that a feature is available - throws 403 if not
   */
  async assertFeature(orgId: string, featureKey: string): Promise<void> {
    const hasIt = await this.hasFeature(orgId, featureKey)
    if (!hasIt) {
      const trace = await this.getDebugTrace(orgId, featureKey)
      throw createFeatureNotAvailableError(featureKey, trace.planKey || "free")
    }
  }

  /**
   * Check if org can consume n units of a feature
   */
  async canConsume(orgId: string, featureKey: string, n: number = 1): Promise<boolean> {
    const value = await this.resolveEntitlement(orgId, featureKey)
    const limit = value.limit

    // Unlimited
    if (limit === null) return true

    // Get current usage
    const usage = await this.repo.getCurrentPeriodUsage(orgId, featureKey)

    return usage.used + n <= limit
  }

  /**
   * Consume n units of a feature (atomically)
   * Returns result with updated usage
   */
  async consume(orgId: string, featureKey: string, n: number = 1): Promise<ConsumeResult> {
    const value = await this.resolveEntitlement(orgId, featureKey)
    const limit = value.limit

    // Get current period info
    const periodInfo = await this.repo.getCurrentPeriodUsage(orgId, featureKey)

    // Check if limit allows consumption
    if (limit !== null && periodInfo.used + n > limit) {
      return {
        success: false,
        used: periodInfo.used,
        limit,
        resetAt: periodInfo.periodEnd,
        error: "LIMIT_REACHED",
        feature: featureKey,
      }
    }

    // Atomically consume
    const consumed = await this.repo.consumeUsage(
      orgId,
      featureKey,
      n,
      periodInfo.periodStart,
      periodInfo.periodEnd
    )

    if (!consumed) {
      return {
        success: false,
        used: periodInfo.used,
        limit,
        resetAt: periodInfo.periodEnd,
        error: "LIMIT_REACHED",
        feature: featureKey,
      }
    }

    // Get updated usage
    const updatedUsage = await this.repo.getCurrentPeriodUsage(orgId, featureKey)

    return {
      success: true,
      used: updatedUsage.used,
      limit,
      resetAt: periodInfo.periodEnd,
    }
  }

  /**
   * Get all entitlements for an org (cached)
   */
  async getAllEntitlements(orgId: string): Promise<EntitlementMap> {
    // Check cache first
    const cached = await cacheService.get<EntitlementMap>(getEntitlementsCacheKey(orgId))
    if (cached) {
      return cached
    }

    // Build from scratch
    const entitlements = await this.buildEntitlementMap(orgId)

    // Cache the result
    await cacheService.set(getEntitlementsCacheKey(orgId), entitlements)

    return entitlements
  }

  /**
   * Get debug trace for a feature - shows how value was resolved
   */
  async getDebugTrace(orgId: string, featureKey: string): Promise<DebugTrace> {
    const feature = await this.repo.getFeature(featureKey)
    const userOverrides = await this.getUserOverridesForOrg(orgId)
    const value = await this.resolveEntitlement(orgId, featureKey, userOverrides)

    // Determine resolution source
    let resolvedVia: ResolutionSource = "fallback"

    // Check user override (would need userId - simplified here)
    // For now, check org override first
    const orgOverride = await this.repo.getOrgOverride(orgId, featureKey)
    if (orgOverride) {
      resolvedVia = "org_override"
    }

    // Check subscription
    const subscription = await this.repo.getSubscription(orgId)
    if (subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING")) {
      if (resolvedVia === "fallback") {
        resolvedVia = "plan"
      }
    }

    return {
      resolvedVia,
      value: value.enabled ? value.enabled : value.limit,
      planKey: subscription?.planKey,
      expiresAt: orgOverride?.limit !== undefined ? undefined : undefined,
      featureConfig: feature?.defaultConfig,
    }
  }

  /**
   * Invalidate cache for an org
   */
  async invalidateCache(orgId: string): Promise<void> {
    await cacheService.invalidate(getEntitlementsCacheKey(orgId))
    await cacheService.publishInvalidation(orgId)
  }

  /**
   * Check if user is in an experiment
   */
  isInExperiment(userId: string, experimentKey: string, experimentConfig: ExperimentConfig): boolean {
    const bucket = getExperimentBucket(
      experimentConfig.seed,
      userId,
      experimentConfig.percentage
    )
    return bucket < experimentConfig.percentage
  }

  /**
   * Get experiment bucket for a user
   */
  getExperimentVariant(userId: string, experimentKey: string, experimentConfig: ExperimentConfig) {
    const bucket = getExperimentBucket(experimentConfig.seed, userId, 100)
    const variantNames = experimentConfig.variantNames || ["control", "variant"]

    return {
      bucket,
      inExperiment: bucket < experimentConfig.percentage,
      variant: variantNames[bucket % variantNames.length],
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Resolve entitlement value using priority system:
   * 1. User override (not implemented in this version - needs userId)
   * 2. Org override
   * 3. Plan feature
   * 4. Fallback (feature disabled, limit = 0)
   */
  private async resolveEntitlement(
    orgId: string,
    featureKey: string,
    _userOverrides?: Map<string, EntitlementValue>
  ): Promise<EntitlementValue> {
    const feature = await this.repo.getFeature(featureKey)
    if (!feature) {
      return { enabled: false, limit: 0 }
    }

    // 1. Check user override (if we had userId)
    // For now, skip - would need userId parameter

    // 2. Check org override
    const orgOverride = await this.repo.getOrgOverride(orgId, featureKey)
    if (orgOverride) {
      return orgOverride
    }

    // 3. Check subscription/plan
    const subscription = await this.repo.getSubscription(orgId)
    if (subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING")) {
      const planFeatures = await this.repo.getPlanFeatures(subscription.planKey)
      const planFeature = planFeatures.get(featureKey)

      if (planFeature) {
        // Handle downgrade strategy for graceful
        if (subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
          const strategy = (planFeature.configJson as any)?.downgradeStrategy
          if (strategy === "graceful") {
            // Still valid until period end
            const now = new Date()
            if (subscription.currentPeriodEnd > now) {
              return {
                enabled: planFeature.enabled,
                limit: planFeature.limitValue,
                config: planFeature.configJson,
              }
            }
            // Fall through to fallback
          } else if (strategy === "immediate") {
            // Already handled - fall through to fallback
          }
          // "freeze" - keep existing values, handled at consume time
        }

        return {
          enabled: planFeature.enabled,
          limit: planFeature.limitValue,
          config: planFeature.configJson,
        }
      }
    }

    // 4. Fallback - check if feature is defined but no plan covers it
    // Default to disabled, limit based on feature type
    if (feature.type === "LIMIT") {
      return { enabled: false, limit: feature.defaultConfig.defaultLimit || 0 }
    }

    return { enabled: false, limit: null }
  }

  /**
   * Build full entitlement map for an org
   */
  private async buildEntitlementMap(orgId: string): Promise<EntitlementMap> {
    const allFeatures = await this.repo.getAllFeatures()
    const subscription = await this.repo.getSubscription(orgId)

    const features: Record<string, boolean> = {}
    const limits: Record<string, number | null> = {}
    const usage: Record<string, number> = {}
    const resetAt: Record<string, Date> = {}
    const config: Record<string, any> = {}

    for (const feature of allFeatures) {
      const value = await this.resolveEntitlement(orgId, feature.key)
      features[feature.key] = value.enabled
      limits[feature.key] = value.limit
      config[feature.key] = value.config || feature.defaultConfig

      const usageInfo = await this.repo.getCurrentPeriodUsage(orgId, feature.key)
      usage[feature.key] = usageInfo.used
      resetAt[feature.key] = usageInfo.periodEnd
    }

    return {
      plan: subscription?.planKey || null,
      status: subscription?.status || null,
      features,
      limits,
      usage,
      resetAt,
      config,
    }
  }

  /**
   * Get user overrides for org (helper for experiments)
   */
  private async getUserOverridesForOrg(_orgId: string): Promise<Map<string, EntitlementValue>> {
    // Placeholder - would need user-level overrides
    return new Map()
  }
}

// ============================================
// Error Factory Functions
// ============================================

export function createFeatureNotAvailableError(feature: string, currentPlan: string): EntitlementError {
  return {
    error: "FEATURE_NOT_AVAILABLE",
    feature,
    planRequired: "PRO", // This should be dynamic based on feature requirements
    currentPlan,
    upgradeUrl: "/settings/billing?upgrade=true",
  }
}

export function createLimitReachedError(
  feature: string,
  limit: number,
  used: number,
  resetAt: Date
): EntitlementError {
  return {
    error: "LIMIT_REACHED",
    feature,
    limit,
    used,
    resetAt: resetAt.toISOString(),
    upgradeUrl: "/settings/billing?upgrade=true",
  }
}

export function createSubscriptionExpiredError(): EntitlementError {
  return {
    error: "SUBSCRIPTION_EXPIRED",
    renewUrl: "/settings/billing",
  }
}

// ============================================
// Singleton Instance
// ============================================

let serviceInstance: FeatureGateService | null = null

/**
 * Get FeatureGateService instance (singleton)
 */
export function getFeatureGateService(): FeatureGateService {
  if (!serviceInstance) {
    serviceInstance = new FeatureGateService()
  }
  return serviceInstance
}

/**
 * Reset service instance (for testing)
 */
export function resetFeatureGateService(): void {
  serviceInstance = null
}

export default getFeatureGateService