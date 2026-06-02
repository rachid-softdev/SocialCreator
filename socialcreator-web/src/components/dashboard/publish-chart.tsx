"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ChartDataItem {
  date: string;
  success: number;
  failed: number;
}

export function PublishChart() {
  const [data, setData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dashboard/chart-data?days=7")
      .then((r) => r.json())
      .then((result) => setData(result.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-hairline bg-surface-card p-4">
        <div className="h-64 animate-pulse bg-surface-strong rounded-md" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-surface-card p-4">
        <h3 className="text-title-sm text-ink font-medium mb-4">Publications (7 days)</h3>
        <p className="text-muted text-center py-12">No data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-card p-4">
      <h3 className="text-title-sm text-ink font-medium mb-4">Publications (7 days)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-hairline" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted" />
          <Tooltip />
          <Bar dataKey="success" fill="#22c55e" name="Success" radius={[4, 4, 0, 0]} />
          <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
