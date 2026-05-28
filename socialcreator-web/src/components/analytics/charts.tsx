"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Color palette matching ElevenLabs design
const COLORS = {
  primary: "#292524",
  mint: "#a7e5d3",
  peach: "#f4c5a8",
  lavender: "#c8b8e0",
  sky: "#a8c8e8",
};

interface ImpressionsChartProps {
  data: { date: string; impressions: number }[];
}

export function ImpressionsChart({ data }: ImpressionsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#777169" }}
          tickLine={{ stroke: "#e7e5e4" }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#777169" }} tickLine={{ stroke: "#e7e5e4" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e7e5e4",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="impressions"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={{ fill: COLORS.primary, strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface PlatformBreakdownProps {
  data: { platform: string; impressions: number; engagements: number }[];
}

export function PlatformBreakdown({ data }: PlatformBreakdownProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis
          dataKey="platform"
          tick={{ fontSize: 12, fill: "#777169" }}
          tickLine={{ stroke: "#e7e5e4" }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#777169" }} tickLine={{ stroke: "#e7e5e4" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e7e5e4",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <Bar dataKey="impressions" name="Impressions" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
        <Bar dataKey="engagements" name="Engagements" fill={COLORS.mint} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface EngagementPieProps {
  data: { name: string; value: number }[];
}

export function EngagementPie({ data }: EngagementPieProps) {
  const PIE_COLORS = [COLORS.primary, COLORS.mint, COLORS.peach, COLORS.lavender, COLORS.sky];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e7e5e4",
            borderRadius: "8px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
