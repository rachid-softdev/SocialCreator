"use client";

import { Users, Bot, FileText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsGridProps {
  stats?: {
    totalProfiles: number;
    activeAgents: number;
    pendingDrafts: number;
    publishedThisWeek: number;
  };
}

const statCards = [
  { key: "totalProfiles", label: "Total Profiles", icon: Users, color: "bg-gradient-mint" },
  { key: "activeAgents", label: "Active Agents", icon: Bot, color: "bg-gradient-peach" },
  { key: "pendingDrafts", label: "Pending Drafts", icon: FileText, color: "bg-gradient-lavender" },
  { key: "publishedThisWeek", label: "Published This Week", icon: TrendingUp, color: "bg-gradient-sky" },
];

export function StatsGrid({ stats }: StatsGridProps) {
  const defaultStats = {
    totalProfiles: 0,
    activeAgents: 0,
    pendingDrafts: 0,
    publishedThisWeek: 0,
  };

  const currentStats = stats || defaultStats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <div
          key={stat.key}
          className="bg-surface-card border border-hairline rounded-xl p-6 shadow-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.color)}>
              <stat.icon className="w-5 h-5 text-ink" />
            </div>
          </div>
          <p className="text-caption text-muted mb-1">{stat.label}</p>
          <p className="text-display-sm font-display text-ink">
            {currentStats[stat.key as keyof typeof currentStats]}
          </p>
        </div>
      ))}
    </div>
  );
}