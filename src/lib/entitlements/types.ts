/**
 * Feature Flags & Entitlements System - Types
 * Tech-agnostic, framework-independent types
 */

// ============================================
// Feature Types
// ============================================

export type FeatureType = "BOOLEAN" | "LIMIT" | "EXPERIMENT"

export interface FeatureConfig {
  // For EXPERIMENT type
  percentage?: number
  seed?: string
  variantNames?: string[]
  // For LIMIT type (default limit if not set in plan)
  defaultLimit?: number
}

export interface FeatureDefinition {
  key: string
  name: string
  description?: string
  type: FeatureType
  defaultConfig: FeatureConfig
  isActive: boolean
}

export interface PlanFeatureConfig {
  enabled: boolean
  limitValue: number | null // null = unlimited
  configJson: FeatureConfig
  downgradeStrategy?: DowngradeStrategy
}

export type DowngradeStrategy = "graceful" | "immediate" | "freeze"

// ============================================
// Entitlement Resolution
// ============================================

export type ResolutionSource = "user_override" | "org_override" | "plan" | "fallback"

export interface EntitlementValue {
  enabled: boolean
  limit: number | null // null = unlimited
  config?: FeatureConfig
}

export interface DebugTrace {
  resolvedVia: ResolutionSource
  value: boolean | number | null
  overrideId?: string
  expiresAt?: Date
  planKey?: string
  featureConfig?: FeatureConfig
  reason?: string
}

// ============================================
// Usage & Quotas
// ============================================

export interface UsageInfo {
  used: number
  limit: number | null
  resetAt: Date
}

export interface ConsumeResult {
  success: boolean
  used: number
  limit: number | null
  resetAt: Date
  error?: "LIMIT_REACHED"
  feature?: string
}

export interface CanConsumeResult {
  canConsume: boolean
  available: number
  limit: number | null
  used: number
}

// ============================================
// Full Entitlements Map
// ============================================

export interface EntitlementMap {
  plan: string | null
  status: SubscriptionStatus | null
  features: Record<string, boolean>
  limits: Record<string, number | null>
  usage: Record<string, number>
  resetAt: Record<string, Date>
  config: Record<string, FeatureConfig>
}

export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "UNPAID"

// ============================================
// Error Types
// ============================================

export interface FeatureNotAvailableError {
  error: "FEATURE_NOT_AVAILABLE"
  feature: string
  planRequired: string
  currentPlan: string | null
  upgradeUrl: string
}

export interface LimitReachedError {
  error: "LIMIT_REACHED"
  feature: string
  limit: number
  used: number
  resetAt: string
  upgradeUrl: string
}

export interface SubscriptionExpiredError {
  error: "SUBSCRIPTION_EXPIRED"
  renewUrl: string
}

export type EntitlementError = FeatureNotAvailableError | LimitReachedError | SubscriptionExpiredError

// ============================================
// Admin Types
// ============================================

export interface OverrideInput {
  scope: "ORG" | "USER"
  scopeId: string
  featureKey: string
  enabled: boolean
  limitValue?: number | null
  expiresAt?: Date | null
  reason: string // mandatory
}

export interface DowngradePreview {
  featureKey: string
  currentValue: boolean | number | null
  willBeAffected: boolean
  strategy: DowngradeStrategy
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string // "key:asc", "key:desc"
}

// ============================================
// Experiment Types
// ============================================

export interface ExperimentConfig {
  percentage: number
  seed: string
  variantNames?: string[]
}

export interface ExperimentBucket {
  inExperiment: boolean
  variant?: string
  bucket: number
}

// ============================================
// Repository Interface (for dependency injection)
// ============================================

export interface IEntitlementRepository {
  // Plan features
  getPlanFeatures(planKey: string): Promise<Map<string, PlanFeatureConfig>>
  getPlan(planKey: string): Promise<{ key: string; name: string; isActive: boolean } | null>

  // Features
  getFeature(featureKey: string): Promise<FeatureDefinition | null>
  getAllFeatures(): Promise<FeatureDefinition[]>

  // Overrides
  getUserOverride(userId: string, featureKey: string): Promise<EntitlementValue | null>
  getOrgOverride(orgId: string, featureKey: string): Promise<EntitlementValue | null>
  createOverride(input: OverrideInput): Promise<void>
  deleteOverride(overrideId: string): Promise<void>

  // Subscription
  getSubscription(orgId: string): Promise<{
    planKey: string
    status: SubscriptionStatus
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
  } | null>

  // Usage tracking
  getUsage(orgId: string, featureKey: string, periodStart: Date): Promise<number>
  getCurrentPeriodUsage(orgId: string, featureKey: string): Promise<{ used: number; periodStart: Date; periodEnd: Date }>
  consumeUsage(orgId: string, featureKey: string, amount: number, periodStart: Date, periodEnd: Date): Promise<boolean>

  // Experiments
  getExperiment(experimentKey: string): Promise<ExperimentConfig | null>
}

// ============================================
// Cache Interface
// ============================================

export interface ICacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  invalidate(key: string): Promise<void>
  invalidatePattern(pattern: string): Promise<void>
  publishInvalidation(orgId: string): Promise<void>
}