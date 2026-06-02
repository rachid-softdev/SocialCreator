/**
 * Frontend hooks for Feature Flags & Entitlements
 */

"use client";

import { useCallback, useEffect, useState } from "react";

export interface EntitlementsData {
  plan: string | null;
  status: string | null;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  usage: Record<string, number>;
  reset_at: Record<string, string>;
}

export interface FeatureHookResult {
  enabled: boolean;
  isLoading: boolean;
  error: Error | null;
}

export interface LimitHookResult {
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useEntitlements() {
  const [data, setData] = useState<EntitlementsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEntitlements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/entitlements", {
        next: { revalidate: 60 },
      } as RequestInit & { next?: { revalidate?: number } });
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      setData((await response.json()) as EntitlementsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  return { data, isLoading, error, refetch: fetchEntitlements };
}

export function useFeature(featureKey: string): FeatureHookResult {
  const { data, isLoading, error } = useEntitlements();
  return { enabled: data?.features[featureKey] ?? false, isLoading, error };
}

export function useLimit(limitKey: string): LimitHookResult {
  const { data, isLoading, error } = useEntitlements();
  const limit = data?.limits[limitKey] ?? null;
  const used = data?.usage[limitKey] ?? 0;
  const resetAt = data?.reset_at[limitKey] ?? null;
  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetAt,
    isLoading,
    error,
  };
}

export function useCanConsume(featureKey: string, amount = 1): boolean {
  const { data } = useEntitlements();
  if (!data) return false;
  const limit = data.limits[featureKey] ?? null;
  const used = data.usage[featureKey] ?? 0;
  return limit === null || used + amount <= limit;
}

interface FeatureGuardProps {
  feature: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function FeatureGuard({ feature, fallback = null, children }: FeatureGuardProps) {
  const { enabled, isLoading } = useFeature(feature);
  if (isLoading) return null;
  return <>{enabled ? children : fallback}</>;
}

interface LimitIndicatorProps {
  feature: string;
  showBar?: boolean;
}

export function LimitIndicator({ feature, showBar = true }: LimitIndicatorProps) {
  const { limit, used, remaining, resetAt, isLoading } = useLimit(feature);
  if (isLoading) return <span className="text-gray-400">Loading...</span>;
  if (limit === null) return <span className="text-green-600">Unlimited</span>;
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`text-sm ${percentage >= 100 ? "text-red-600" : percentage >= 80 ? "text-yellow-600" : "text-gray-600"}`}
      >
        {used} / {limit} ({remaining} remaining)
      </span>
      {showBar && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${percentage >= 100 ? "bg-red-500" : percentage >= 80 ? "bg-yellow-500" : "bg-green-500"}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
      {resetAt && (
        <span className="text-xs text-gray-400">
          Resets: {new Date(resetAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

interface UpgradeBannerProps {
  feature?: string;
  message?: string;
}

export function UpgradeBanner({
  feature,
  message = "Upgrade your plan to access this feature",
}: UpgradeBannerProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{message}</p>
          {feature && <p className="text-xs text-gray-500 mt-1">Feature: {feature}</p>}
        </div>
        <a
          href="/settings/billing?upgrade=true"
          className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upgrade
        </a>
      </div>
    </div>
  );
}

export default {
  useEntitlements,
  useFeature,
  useLimit,
  useCanConsume,
  FeatureGuard,
  LimitIndicator,
  UpgradeBanner,
};
