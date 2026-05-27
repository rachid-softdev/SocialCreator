/**
 * Feature Flags & Entitlements - Repository
 * Interface + Prisma Implementation
 */

import { prisma } from "@/lib/prisma"
import type {
  IEntitlementRepository,
  FeatureDefinition,
  PlanFeatureConfig,
  EntitlementValue,
  OverrideInput,
  SubscriptionStatus,
  ExperimentConfig,
  FeatureConfig,
} from "./types"
import { cacheService, getEntitlementsCacheKey } from "./cache"

// ============================================
// Utility Functions
// ============================================

function getCurrentPeriodStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function getCurrentPeriodEnd(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
}

// ============================================
// Prisma Repository Implementation
// ============================================

export class PrismaEntitlementRepository implements IEntitlementRepository {
  /**
   * Get all plan features for a plan
   */
  async getPlanFeatures(planKey: string): Promise<Map<string, PlanFeatureConfig>> {
    const plan = await prisma.plan.findUnique({
      where: { key: planKey },
      include: {
        planFeatures: {
          include: {
            feature: true,
          },
        },
      },
    })

    const featureMap = new Map<string, PlanFeatureConfig>()

    if (plan) {
      for (const pf of plan.planFeatures) {
        featureMap.set(pf.feature.key, {
          enabled: pf.enabled,
          limitValue: pf.limitValue,
          configJson: pf.configJson as FeatureConfig || {},
          downgradeStrategy: (pf.configJson as any)?.downgradeStrategy,
        })
      }
    }

    return featureMap
  }

  /**
   * Get plan by key
   */
  async getPlan(planKey: string): Promise<{ key: string; name: string; isActive: boolean } | null> {
    const plan = await prisma.plan.findUnique({
      where: { key: planKey },
      select: { key: true, name: true, isActive: true },
    })

    return plan
  }

  /**
   * Get feature definition
   */
  async getFeature(featureKey: string): Promise<FeatureDefinition | null> {
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey },
    })

    if (!feature) return null

    return {
      key: feature.key,
      name: feature.name,
      description: feature.description || undefined,
      type: feature.type as any,
      defaultConfig: feature.defaultConfig as FeatureConfig,
      isActive: feature.isActive,
    }
  }

  /**
   * Get all active features
   */
  async getAllFeatures(): Promise<FeatureDefinition[]> {
    const features = await prisma.feature.findMany({
      where: { isActive: true },
    })

    return features.map((f) => ({
      key: f.key,
      name: f.name,
      description: f.description || undefined,
      type: f.type as any,
      defaultConfig: f.defaultConfig as FeatureConfig,
      isActive: f.isActive,
    }))
  }

  /**
   * Get user override (non-expired)
   * Note: user overrides use scopeId as the user identifier
   */
  async getUserOverride(userId: string, featureKey: string): Promise<EntitlementValue | null> {
    const now = new Date()

    const override = await prisma.entitlementOverride.findFirst({
      where: {
        scope: "USER",
        scopeId: userId,
        featureKey,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: "desc" },
    })

    if (!override) return null

    return {
      enabled: override.enabled,
      limit: override.limitValue,
    }
  }

  /**
   * Get org override (non-expired)
   */
  async getOrgOverride(orgId: string, featureKey: string): Promise<EntitlementValue | null> {
    const now = new Date()

    const override = await prisma.entitlementOverride.findFirst({
      where: {
        scope: "ORG",
        scopeId: orgId,
        featureKey,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: "desc" },
    })

    if (!override) return null

    return {
      enabled: override.enabled,
      limit: override.limitValue,
    }
  }

  /**
   * Create override
   */
  async createOverride(input: OverrideInput): Promise<void> {
    await prisma.entitlementOverride.create({
      data: {
        scope: input.scope,
        scopeId: input.scopeId,
        featureKey: input.featureKey,
        enabled: input.enabled,
        limitValue: input.limitValue ?? undefined,
        expiresAt: input.expiresAt ?? undefined,
        reason: input.reason,
        orgId: input.scope === "ORG" ? input.scopeId : undefined,
      },
    })

    // Invalidate cache if org-level override
    if (input.scope === "ORG") {
      await cacheService.invalidate(getEntitlementsCacheKey(input.scopeId))
      await cacheService.publishInvalidation(input.scopeId)
    }
  }

  /**
   * Delete override
   */
  async deleteOverride(overrideId: string): Promise<void> {
    const override = await prisma.entitlementOverride.findUnique({
      where: { id: overrideId },
    })

    await prisma.entitlementOverride.delete({
      where: { id: overrideId },
    })

    // Invalidate cache if org-level override
    if (override?.scope === "ORG" && override.orgId) {
      await cacheService.invalidate(getEntitlementsCacheKey(override.orgId))
      await cacheService.publishInvalidation(override.orgId)
    }
  }

  /**
   * Get subscription for org
   */
  async getSubscription(orgId: string): Promise<{
    planKey: string
    status: SubscriptionStatus
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
  } | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { orgId },
    })

    if (!subscription) return null

    return {
      planKey: subscription.planKey,
      status: subscription.status as SubscriptionStatus,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    }
  }

  /**
   * Get usage for a specific period
   */
  async getUsage(orgId: string, featureKey: string, periodStart: Date): Promise<number> {
    const tracking = await prisma.usageTracking.findUnique({
      where: {
        orgId_featureKey_periodStart: {
          orgId,
          featureKey,
          periodStart,
        },
      },
    })

    return tracking?.usageCount || 0
  }

  /**
   * Get current period usage
   */
  async getCurrentPeriodUsage(orgId: string, featureKey: string): Promise<{
    used: number
    periodStart: Date
    periodEnd: Date
  }> {
    const periodStart = getCurrentPeriodStart()
    const periodEnd = getCurrentPeriodEnd()

    // Check if period has changed, if so create new tracking
    const tracking = await prisma.usageTracking.findUnique({
      where: {
        orgId_featureKey_periodStart: {
          orgId,
          featureKey,
          periodStart,
        },
      },
    })

    return {
      used: tracking?.usageCount || 0,
      periodStart,
      periodEnd,
    }
  }

  /**
   * Atomically consume usage (for race-condition safety)
   */
  async consumeUsage(
    orgId: string,
    featureKey: string,
    amount: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<boolean> {
    // First, get current limit to check if we can consume
    // This is handled at the service level with the limit value

    try {
      // Try to create if not exists, then update atomically
      const result = await prisma.usageTracking.upsert({
        where: {
          orgId_featureKey_periodStart: {
            orgId,
            featureKey,
            periodStart,
          },
        },
        create: {
          orgId,
          featureKey,
          usageCount: amount,
          periodStart,
          periodEnd,
        },
        update: {
          usageCount: {
            increment: amount,
          },
        },
      })

      return true
    } catch (error) {
      console.error("[Entitlements] Failed to consume usage:", error)
      return false
    }
  }

  /**
   * Get experiment config
   */
  async getExperiment(experimentKey: string): Promise<ExperimentConfig | null> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
    })

    if (!experiment) return null

    return experiment.config as unknown as ExperimentConfig
  }
}

// ============================================
// Singleton Instance
// ============================================

let repositoryInstance: IEntitlementRepository | null = null

/**
 * Get repository instance (singleton)
 * Allows mocking in tests
 */
export function getEntitlementRepository(): IEntitlementRepository {
  if (!repositoryInstance) {
    repositoryInstance = new PrismaEntitlementRepository()
  }
  return repositoryInstance
}

/**
 * Set repository instance (for testing)
 */
export function setEntitlementRepository(repo: IEntitlementRepository): void {
  repositoryInstance = repo
}

/**
 * Reset repository (for testing)
 */
export function resetEntitlementRepository(): void {
  repositoryInstance = null
}

export default getEntitlementRepository