"use client";

import type { Platform } from "@prisma/client";
import { formatDateTime } from "@socialcreator/utils";
import { BarChart3, Calendar, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ContentStatusBadge } from "@/components/content/content-status-badge";
import { PlatformBadge } from "@/components/content/platform-badge";
import { PublishStats } from "@/components/dashboard/publish-stats";
import { PageHeader } from "@/components/layout/page-header";

interface AnalyticsDashboardProps {
  profiles: { id: string; name: string }[];
  initialProfileId: string;
  initialPublishLogs: {
    id: string;
    platform: Platform;
    success: boolean;
    publishedAt: Date;
    error: string | null;
    contentId: string;
  }[];
  initialRecentContent: {
    id: string;
    platform: Platform;
    status: string;
    textContent: string;
    postId: string | null;
    publishedAt: Date | null;
    profileName: string;
  }[];
  initialCapStatus: Array<{
    platform: Platform;
    count: number;
    max: number;
    allowed: boolean;
  }>;
}

export function AnalyticsDashboard({
  profiles,
  initialProfileId,
  initialPublishLogs,
  initialRecentContent,
  initialCapStatus,
}: AnalyticsDashboardProps) {
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfileId);
  const [_isLoading, setIsLoading] = useState(false);
  const [publishLogs, _setPublishLogs] = useState(initialPublishLogs);
  const [recentContent, _setRecentContent] = useState(initialRecentContent);
  const [capStatus, setCapStatus] = useState(initialCapStatus);

  const handleProfileChange = async (profileId: string) => {
    setSelectedProfileId(profileId);
    setIsLoading(true);

    try {
      const [analyticsRes, capRes] = await Promise.all([
        fetch(`/api/analytics?profileId=${profileId}`),
        fetch(`/api/analytics/cap-status?profileId=${profileId}`),
      ]);

      if (analyticsRes.ok) {
        const _data = await analyticsRes.json();
        // Would update charts data here
      }

      if (capRes.ok) {
        const data = await capRes.json();
        setCapStatus(data);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats
  const totalPosts = publishLogs.filter((l) => l.success).length;
  const totalFailed = publishLogs.filter((l) => !l.success).length;
  const successRate =
    totalPosts + totalFailed > 0 ? Math.round((totalPosts / (totalPosts + totalFailed)) * 100) : 0;

  // Platform breakdown
  const platformStats = publishLogs.reduce(
    (acc, log) => {
      if (!acc[log.platform]) {
        acc[log.platform] = { success: 0, failed: 0 };
      }
      if (log.success) {
        acc[log.platform].success++;
      } else {
        acc[log.platform].failed++;
      }
      return acc;
    },
    {} as Record<string, { success: number; failed: number }>,
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Track your content performance" />

      {/* Profile Selector */}
      {profiles.length > 1 && (
        <div className="flex items-center gap-4">
          <label className="text-body-sm text-muted">Profile:</label>
          <select
            value={selectedProfileId}
            onChange={(e) => handleProfileChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-hairline bg-surface-card text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card rounded-xl border border-hairline p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-semantic-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-semantic-success" />
            </div>
            <div>
              <p className="text-caption text-muted">Published</p>
              <p className="text-display-sm text-ink">{totalPosts}</p>
            </div>
          </div>
          <p className="text-caption text-muted">Last 30 days</p>
        </div>

        <div className="bg-surface-card rounded-xl border border-hairline p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-surface-strong flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-muted" />
            </div>
            <div>
              <p className="text-caption text-muted">Success Rate</p>
              <p className="text-display-sm text-ink">{successRate}%</p>
            </div>
          </div>
          <p className="text-caption text-muted">{totalFailed > 0 && `${totalFailed} failed`}</p>
        </div>

        <div className="bg-surface-card rounded-xl border border-hairline p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-surface-strong flex items-center justify-center">
              <Calendar className="w-5 h-5 text-muted" />
            </div>
            <div>
              <p className="text-caption text-muted">Platforms</p>
              <p className="text-display-sm text-ink">{Object.keys(platformStats).length}</p>
            </div>
          </div>
          <p className="text-caption text-muted">Active this month</p>
        </div>
      </div>

      {/* Publish Stats */}
      <PublishStats stats={capStatus} />

      {/* Platform Breakdown */}
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <h3 className="text-title-sm text-ink mb-6">Platform Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(platformStats).map(([platform, stats]) => (
            <div key={platform} className="p-4 bg-surface-soft rounded-lg space-y-2">
              <PlatformBadge platform={platform} />
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted">Success</span>
                <span className="text-body-sm text-semantic-success font-medium">
                  {stats.success}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted">Failed</span>
                <span className="text-body-sm text-semantic-error font-medium">{stats.failed}</span>
              </div>
            </div>
          ))}

          {Object.keys(platformStats).length === 0 && (
            <p className="text-body-sm text-muted col-span-full text-center py-8">
              No publications yet
            </p>
          )}
        </div>
      </div>

      {/* Recent Publications Table */}
      <div className="bg-surface-card rounded-xl border border-hairline p-6">
        <h3 className="text-title-sm text-ink mb-6">Recent Publications</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left text-caption text-muted py-3 px-4">Platform</th>
                <th className="text-left text-caption text-muted py-3 px-4">Content</th>
                <th className="text-left text-caption text-muted py-3 px-4">Status</th>
                <th className="text-left text-caption text-muted py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentContent.map((content) => (
                <tr key={content.id} className="border-b border-hairline/50">
                  <td className="py-3 px-4">
                    <PlatformBadge platform={content.platform} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-body-sm text-ink truncate max-w-xs">{content.textContent}</p>
                  </td>
                  <td className="py-3 px-4">
                    <ContentStatusBadge status={content.status as any} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-body-sm text-muted">
                      {content.publishedAt ? formatDateTime(content.publishedAt) : "-"}
                    </span>
                  </td>
                </tr>
              ))}

              {recentContent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-body-sm text-muted">
                    No recent publications
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
