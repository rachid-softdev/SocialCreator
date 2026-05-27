"use client";

import { Eye, Heart, MousePointerClick, TrendingUp } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { DateRangePicker } from "@/components/analytics/date-range-picker";
import { PlatformTable } from "@/components/analytics/platform-table";
import { StatsCard } from "@/components/analytics/stats-card";

// Lazy load Recharts - only load when charts are in viewport
const ImpressionsChart = dynamic(
  () => import("@/components/analytics/charts").then((mod) => mod.ImpressionsChart),
  {
    ssr: true,
    loading: () => <div className="h-[300px] animate-pulse bg-surface-soft rounded-lg" />,
  },
);

const PlatformBreakdown = dynamic(
  () => import("@/components/analytics/charts").then((mod) => mod.PlatformBreakdown),
  {
    ssr: true,
    loading: () => <div className="h-[300px] animate-pulse bg-surface-soft rounded-lg" />,
  },
);

const EngagementPie = dynamic(
  () => import("@/components/analytics/charts").then((mod) => mod.EngagementPie),
  {
    ssr: true,
    loading: () => <div className="h-[300px] animate-pulse bg-surface-soft rounded-lg" />,
  },
);

interface Profile {
  id: string;
  name: string;
}

interface ChartData {
  date: string;
  impressions: number;
}

interface PlatformBreakdownData {
  platform: string;
  impressions: number;
  engagements: number;
}

interface EngagementType {
  name: string;
  value: number;
}

interface ClientAnalyticsPageProps {
  totalImpressions: number;
  totalEngagements: number;
  totalClicks: number;
  growthRate: number;
  publishCount: number;
  chartData: ChartData[];
  platformBreakdown: PlatformBreakdownData[];
  engagementTypes: EngagementType[];
  profiles: Profile[];
}

export function ClientAnalyticsPage({
  totalImpressions,
  totalEngagements,
  totalClicks,
  growthRate,
  publishCount,
  chartData,
  platformBreakdown,
  engagementTypes,
  profiles,
}: ClientAnalyticsPageProps) {
  const [selectedRange, setSelectedRange] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedProfile, setSelectedProfile] = useState<string>("all");

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";

  return (
    <div className="max-w-content mx-auto px-6 py-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-title-md mb-1">Analytics</h1>
          <p className="text-body-sm text-muted">Track your content performance</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Profile filter */}
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="px-3 py-2 rounded-lg border border-hairline text-body-sm"
          >
            <option value="all">All profiles</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>

          {/* Date range */}
          <DateRangePicker
            value={selectedRange}
            onChange={(range) => setSelectedRange(range as "7d" | "30d" | "90d")}
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          label="Total Impressions"
          value={formatNumber(totalImpressions)}
          trend={growthRate}
          icon={Eye}
        />
        <StatsCard
          label="Engagements"
          value={formatNumber(totalEngagements)}
          trend={undefined}
          icon={Heart}
        />
        <StatsCard
          label="Clicks"
          value={formatNumber(totalClicks)}
          trend={undefined}
          icon={MousePointerClick}
        />
        <StatsCard label="CTR" value={`${ctr}%`} trend={undefined} icon={TrendingUp} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Impressions over time */}
        <div className="rounded-xl border border-hairline bg-surface-card p-6">
          <h3 className="text-title-sm mb-4">Impressions over time</h3>
          {chartData.length > 0 ? (
            <ImpressionsChart data={chartData} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted">
              No data available
            </div>
          )}
        </div>

        {/* Platform breakdown */}
        <div className="rounded-xl border border-hairline bg-surface-card p-6">
          <h3 className="text-title-sm mb-4">By platform</h3>
          {platformBreakdown.length > 0 ? (
            <PlatformBreakdown data={platformBreakdown} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Engagement breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="rounded-xl border border-hairline bg-surface-card p-6 lg:col-span-2">
          <h3 className="text-title-sm mb-4">Engagement breakdown</h3>
          {engagementTypes.some((e) => e.value > 0) ? (
            <EngagementPie data={engagementTypes} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted">
              No data available
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="rounded-xl border border-hairline bg-surface-card p-6">
          <h3 className="text-title-sm mb-4">This period</h3>

          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-body-sm text-muted">Published</span>
              <span className="text-body-sm font-medium">{publishCount}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-body-sm text-muted">Active profiles</span>
              <span className="text-body-sm font-medium">
                {selectedProfile === "all" ? profiles.length : "1"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-body-sm text-muted">Avg. engagement</span>
              <span className="text-body-sm font-medium">
                {totalImpressions > 0
                  ? ((totalEngagements / totalImpressions) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform table */}
      <div>
        <h3 className="text-title-sm mb-4">Platform details</h3>
        {platformBreakdown.length > 0 ? (
          <PlatformTable
            data={platformBreakdown.map((p) => ({
              platform: p.platform,
              impressions: p.impressions,
              engagements: p.engagements,
              clicks: Math.round(p.engagements * 0.3), // Estimate
              followers: 0,
              published: 0,
            }))}
          />
        ) : (
          <div className="rounded-xl border border-hairline bg-surface-card p-8 text-center text-muted">
            No platform data available
          </div>
        )}
      </div>
    </div>
  );
}
