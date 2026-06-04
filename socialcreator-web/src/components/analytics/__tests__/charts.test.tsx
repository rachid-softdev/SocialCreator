/**
 * Tests for Charts components (ImpressionsChart, PlatformBreakdown, EngagementPie)
 *
 * Strategy: Mock all recharts components as string elements to avoid
 * SVG rendering complexity in jsdom. Verify each chart renders with data
 * and renders nothing (empty container) when data is empty.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@/components/__tests__/test-utils";
import { EngagementPie, ImpressionsChart, PlatformBreakdown } from "../charts";

// ── Mock recharts as string elements ─────────────────────────────────────

vi.mock("recharts", () => ({
  ResponsiveContainer: "svg-container",
  BarChart: "svg-bar-chart",
  LineChart: "svg-line-chart",
  PieChart: "svg-pie-chart",
  Bar: "svg-bar",
  Line: "svg-line",
  Pie: "svg-pie",
  Cell: "svg-cell",
  XAxis: "svg-x-axis",
  YAxis: "svg-y-axis",
  Tooltip: "svg-tooltip",
  Legend: "svg-legend",
  CartesianGrid: "svg-grid",
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockImpressionsData = [
  { date: "2025-01-01", impressions: 100 },
  { date: "2025-01-02", impressions: 150 },
];

const mockPlatformData = [
  { platform: "X", impressions: 500, engagements: 50 },
  { platform: "LinkedIn", impressions: 300, engagements: 30 },
];

const mockPieData = [
  { name: "X", value: 50 },
  { name: "LinkedIn", value: 30 },
  { name: "Instagram", value: 20 },
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("ImpressionsChart", () => {
  it("renders a chart container when data is provided", () => {
    const { container } = render(<ImpressionsChart data={mockImpressionsData} />);
    expect(container.querySelector("svg-container")).toBeInTheDocument();
  });

  it("renders a LineChart inside the container", () => {
    const { container } = render(<ImpressionsChart data={mockImpressionsData} />);
    expect(container.querySelector("svg-line-chart")).toBeInTheDocument();
  });

  it("renders nothing meaningful when data is empty (still renders container)", () => {
    const { container } = render(<ImpressionsChart data={[]} />);
    expect(container.querySelector("svg-container")).toBeInTheDocument();
  });
});

describe("PlatformBreakdown", () => {
  it("renders a chart container when data is provided", () => {
    const { container } = render(<PlatformBreakdown data={mockPlatformData} />);
    expect(container.querySelector("svg-container")).toBeInTheDocument();
  });

  it("renders a BarChart inside the container", () => {
    const { container } = render(<PlatformBreakdown data={mockPlatformData} />);
    expect(container.querySelector("svg-bar-chart")).toBeInTheDocument();
  });

  it("renders nothing meaningful when data is empty", () => {
    const { container } = render(<PlatformBreakdown data={[]} />);
    expect(container.querySelector("svg-container")).toBeInTheDocument();
  });
});

describe("EngagementPie", () => {
  it("renders a chart container when data is provided", () => {
    const { container } = render(<EngagementPie data={mockPieData} />);
    expect(container.querySelector("svg-container")).toBeInTheDocument();
  });

  it("renders a PieChart inside the container", () => {
    const { container } = render(<EngagementPie data={mockPieData} />);
    expect(container.querySelector("svg-pie-chart")).toBeInTheDocument();
  });

  it("renders nothing meaningful when data is empty (empty array)", () => {
    const { container } = render(<EngagementPie data={[]} />);
    expect(container.querySelector("svg-container")).toBeInTheDocument();
  });
});
