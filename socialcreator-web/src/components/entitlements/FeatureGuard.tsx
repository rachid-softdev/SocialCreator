/**
 * FeatureGuard Component
 * Conditionally render children based on feature availability
 */

"use client";

import { useEffect, useState } from "react";

/**
 * Local hook to check feature availability via the entitlements API.
 * Caches the feature map across calls within the same component tree.
 */
function useFeature(feature: string): { enabled: boolean; isLoading: boolean } {
  const [state, setState] = useState<{ enabled: boolean; isLoading: boolean }>({
    enabled: false,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/entitlements")
      .then((res) => (res.ok ? res.json() : { features: {} }))
      .then((data) => {
        if (!cancelled) {
          const enabled = data.features?.[feature] === true;
          setState({ enabled, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ enabled: false, isLoading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [feature]);

  return state;
}

interface FeatureGuardProps {
  /**
   * Feature key to check
   */
  feature: string;

  /**
   * Fallback to show when feature is not available
   */
  fallback?: React.ReactNode;

  /**
   * Children to render when feature IS available
   */
  children: React.ReactNode;

  /**
   * Show a default upgrade banner as fallback
   */
  showUpgradeBanner?: boolean;
}

export function FeatureGuard({
  feature,
  fallback = null,
  children,
  showUpgradeBanner = false,
}: FeatureGuardProps) {
  const { enabled, isLoading } = useFeature(feature);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        {/* Optional loading skeleton */}
        <div className="h-4 bg-gray-200 rounded w-24" />
      </div>
    );
  }

  if (!enabled) {
    if (showUpgradeBanner) {
      return <UpgradePrompt feature={feature}>{fallback}</UpgradePrompt>;
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Upgrade prompt component
 */
function UpgradePrompt({
  feature: _feature,
  children,
}: {
  feature: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <div className="mt-2 text-xs text-gray-500">
        This feature requires a higher plan.{" "}
        <a href="/settings/billing?upgrade=true" className="text-blue-600 hover:underline">
          Upgrade now
        </a>
      </div>
    </div>
  );
}

/**
 * Button wrapper that disables based on feature
 */
interface FeatureButtonProps {
  feature: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function FeatureButton({
  feature,
  children,
  onClick,
  disabled = false,
  className = "",
}: FeatureButtonProps) {
  const { enabled } = useFeature(feature);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !enabled}
      className={`${className} ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`}
      title={!enabled ? `Feature "${feature}" not available on your plan` : undefined}
    >
      {children}
    </button>
  );
}

/**
 * Link wrapper that shows upgrade prompt on click if feature unavailable
 */
interface FeatureLinkProps {
  feature: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatureLink({ feature, href, children, className = "" }: FeatureLinkProps) {
  const { enabled } = useFeature(feature);

  if (!enabled) {
    return (
      <a
        href="/settings/billing?upgrade=true"
        className={`${className} text-blue-600 hover:underline`}
        title={`Feature "${feature}" not available on your plan`}
      >
        {children}
      </a>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export default FeatureGuard;
