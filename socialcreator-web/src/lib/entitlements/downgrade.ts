/**
 * Feature Flags & Entitlements - Downgrade Service
 * Handles plan downgrades with configurable strategies
 */

import { getEntitlementRepository } from "./repository";
import type { DowngradeStrategy } from "./types";

// Note: PlanFeatureWithStrategy was removed — defined but never used.

export interface DowngradeImpact {
  featureKey: string;
  currentEnabled: boolean;
  currentLimit: number | null;
  newEnabled: boolean;
  newLimit: number | null;
  affected: boolean;
  strategy: DowngradeStrategy;
  reason: string;
}

/**
 * DowngradeService - handles plan downgrade scenarios
 */
export class DowngradeService {
  private repo = getEntitlementRepository();

  /**
   * Preview what features will be affected by a downgrade
   * Returns list of features that will change
   */
  async previewDowngrade(orgId: string, targetPlanKey: string): Promise<DowngradeImpact[]> {
    const impacts: DowngradeImpact[] = [];

    // Get current subscription
    const subscription = await this.repo.getSubscription(orgId);
    if (!subscription) {
      return impacts;
    }

    const currentPlanKey = subscription.planKey;

    // Get features for both plans
    const currentPlanFeatures = await this.repo.getPlanFeatures(currentPlanKey);
    const targetPlanFeatures = await this.repo.getPlanFeatures(targetPlanKey);

    // Get all features to check
    const allFeatures = await this.repo.getAllFeatures();

    for (const feature of allFeatures) {
      const currentFeature = currentPlanFeatures.get(feature.key);
      const targetFeature = targetPlanFeatures.get(feature.key);

      // Determine current state (consider overrides)
      const currentEnabled = currentFeature?.enabled ?? false;
      const currentLimit = currentFeature?.limitValue ?? (feature.type === "LIMIT" ? 0 : null);

      // Determine target state
      const newEnabled = targetFeature?.enabled ?? false;
      const newLimit = targetFeature?.limitValue ?? (feature.type === "LIMIT" ? 0 : null);

      // Get strategy from target plan
      const strategy = (targetFeature?.configJson as any)?.downgradeStrategy || "immediate";

      // Check if will be affected
      let affected = false;

      if (feature.type === "BOOLEAN") {
        affected = currentEnabled && !newEnabled;
      } else if (feature.type === "LIMIT") {
        affected = currentLimit === null || (newLimit !== null && currentLimit > newLimit);
      }

      if (affected) {
        let reason = "";

        switch (strategy) {
          case "graceful": {
            const periodEnd = subscription.currentPeriodEnd;
            if (periodEnd && periodEnd > new Date()) {
              reason = `Access retained until ${periodEnd.toISOString().split("T")[0]}`;
            } else {
              reason = "Access will be removed immediately (period ended)";
            }
            break;
          }

          case "immediate":
            reason = "Access removed immediately";
            break;

          case "freeze":
            reason = "Existing data retained, no new consumption allowed";
            break;
        }

        impacts.push({
          featureKey: feature.key,
          currentEnabled,
          currentLimit,
          newEnabled,
          newLimit,
          affected: true,
          strategy,
          reason,
        });
      }
    }

    return impacts;
  }

  /**
   * Apply downgrade strategy
   * This is called after Stripe confirms the downgrade
   */
  async applyDowngrade(
    orgId: string,
    targetPlanKey: string,
    strategyOverride?: DowngradeStrategy,
  ): Promise<void> {
    const impacts = await this.previewDowngrade(orgId, targetPlanKey);

    const subscription = await this.repo.getSubscription(orgId);
    const periodEnd = subscription?.currentPeriodEnd;
    const now = new Date();
    const isWithinPeriod = periodEnd && periodEnd > now;

    for (const impact of impacts) {
      const strategy = strategyOverride || impact.strategy;

      switch (strategy) {
        case "graceful":
          // For graceful, we create an override that expires at period end
          if (isWithinPeriod) {
            await this.repo.createOverride({
              scope: "ORG",
              scopeId: orgId,
              featureKey: impact.featureKey,
              enabled: true, // Keep access until period end
              limitValue: impact.currentLimit,
              expiresAt: periodEnd!,
              reason: `Graceful downgrade - access until ${periodEnd?.toISOString()}`,
            });
          }
          // If period ended, fall through to immediate
          break;

        case "immediate":
          // No action needed - plan features will naturally apply
          // But we should invalidate cache to ensure fresh data
          break;

        case "freeze":
          // For freeze, we keep existing data but create an override
          // that prevents new consumption while preserving limit
          await this.repo.createOverride({
            scope: "ORG",
            scopeId: orgId,
            featureKey: impact.featureKey,
            enabled: impact.currentEnabled, // Keep enabled
            limitValue: impact.currentLimit, // Keep current limit (don't reduce)
            // No expiration - permanent freeze until upgrade
            reason: "Freeze - existing data preserved, new consumption blocked",
          });
          break;
      }
    }

    // Invalidate cache after downgrade
    const { cacheService } = await import("./cache");
    const { getEntitlementsCacheKey } = await import("./cache");
    await cacheService.invalidate(getEntitlementsCacheKey(orgId));
  }

  /**
   * Check if org has features that would be affected by downgrade to target plan
   * Useful for pre-downgrade validation
   */
  async wouldBeAffected(orgId: string, targetPlanKey: string): Promise<boolean> {
    const impacts = await this.previewDowngrade(orgId, targetPlanKey);
    return impacts.some((i) => i.affected);
  }

  /**
   * Get count of features that will be lost in downgrade
   */
  async getAffectedFeatureCount(orgId: string, targetPlanKey: string): Promise<number> {
    const impacts = await this.previewDowngrade(orgId, targetPlanKey);
    return impacts.filter((i) => i.affected).length;
  }
}

// ============================================
// Singleton
// ============================================

let downgradeServiceInstance: DowngradeService | null = null;

export function getDowngradeService(): DowngradeService {
  if (!downgradeServiceInstance) {
    downgradeServiceInstance = new DowngradeService();
  }
  return downgradeServiceInstance;
}

export function resetDowngradeService(): void {
  downgradeServiceInstance = null;
}

export default getDowngradeService;
