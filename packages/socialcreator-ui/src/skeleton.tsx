"use client";

import { cn } from "@socialcreator/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-md bg-hairline", className)} />;
}

export function ProfileCardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-pill" />
        <Skeleton className="h-6 w-16 rounded-pill" />
      </div>
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-6 w-16 rounded-pill" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-pill" />
        <Skeleton className="h-6 w-16 rounded-pill" />
        <Skeleton className="h-6 w-16 rounded-pill" />
      </div>
    </div>
  );
}

export function ContentCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-hairline bg-surface-card rounded-lg">
      <Skeleton className="h-10 w-10 rounded" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-20 rounded-pill" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden">
      <Skeleton className="h-40 w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ContentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <ProfileCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AgentListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(count)].map((_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: "Total Profiles", value: "w-24" },
        { label: "Active Agents", value: "w-20" },
        { label: "Pending Drafts", value: "w-28" },
        { label: "Published This Week", value: "w-32" },
      ].map((stat, i) => (
        <div key={i} className="rounded-xl border border-hairline bg-surface-card p-6">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className={`h-8 ${stat.value}`} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card p-6">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="h-64 flex items-end gap-2">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t animate-pulse bg-hairline"
            style={{ height: `${Math.floor(Math.random() * 60 + 20)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {[
        { h: 4, w: 24 },
        { h: 10, w: "full" },
        { h: 4, w: 24 },
        { h: 10, w: "full" },
        { h: 4, w: 24 },
        { h: 24, w: "full" },
      ].map((s, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className={`h-${s.h} w-${s.w}`} />
        </div>
      ))}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-card overflow-hidden">
      <div className="border-b border-hairline">
        <div className="flex p-4 gap-4">
          {[...Array(columns)].map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex p-4 gap-4 border-b border-hairline-soft">
          {[...Array(columns)].map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="w-64 h-screen border-r border-hairline bg-surface-card p-4 space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-hairline border-t-primary",
        sizeClasses[size],
      )}
    />
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <StatsGridSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <ContentListSkeleton count={3} />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <AgentListSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}
