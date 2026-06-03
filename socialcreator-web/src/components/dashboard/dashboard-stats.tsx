"use client";

import { FileText, Layers, Send, User } from "lucide-react";
import { useEffect, useState } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import logger from "@/lib/logger";

interface DashboardStats {
  stats: {
    profiles: number;
    totalContents: number;
    totalPublished: number;
    todayPublishes: number;
  };
  recentActivity: Array<Record<string, unknown>>;
}

export function DashboardStats() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/v1/dashboard");
        if (!res.ok) throw new Error("Failed to fetch dashboard stats");
        const json: DashboardStats = await res.json();
        setData(json);
      } catch (err) {
        logger.error({ err }, "Dashboard stats fetch error");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-hairline bg-surface-card p-4 animate-pulse"
          >
            <div className="h-4 w-20 bg-surface-strong rounded mb-2" />
            <div className="h-8 w-16 bg-surface-strong rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { stats } = data;

  const cards = [
    { label: "Profiles", value: stats.profiles, icon: <User className="w-5 h-5" /> },
    { label: "Total Content", value: stats.totalContents, icon: <FileText className="w-5 h-5" /> },
    { label: "Published", value: stats.totalPublished, icon: <Send className="w-5 h-5" /> },
    { label: "Published Today", value: stats.todayPublishes, icon: <Layers className="w-5 h-5" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatsCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
      ))}
    </div>
  );
}
