"use client";

import { cn } from "@socialcreator/utils";
import { useEffect, useState } from "react";

interface QueueStatusData {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

interface StatCard {
  label: string;
  key: keyof QueueStatusData;
  color: string;
}

const statCards: StatCard[] = [
  { label: "Pending", key: "pending", color: "text-blue" },
  { label: "Running", key: "running", color: "text-blue" },
  { label: "Completed", key: "completed", color: "text-green" },
  { label: "Failed", key: "failed", color: "text-red" },
  { label: "Total", key: "total", color: "text-ink" },
];

export function QueueStatus() {
  const [stats, setStats] = useState<QueueStatusData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/v1/queue/status", { cache: "no-store" });
        if (!res.ok) return;
        const data: QueueStatusData = await res.json();
        if (mounted) setStats(data);
      } catch {
        // Fetch errors handled silently
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {statCards.map((card) => (
        <div
          key={card.key}
          className="rounded-md border border-hairline bg-surface-card p-4 text-center"
        >
          <p className={cn("text-title-lg", card.color)}>{stats[card.key]}</p>
          <p className="text-caption text-muted">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
