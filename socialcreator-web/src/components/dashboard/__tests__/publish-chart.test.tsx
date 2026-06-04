/**
 * Tests for PublishChart component.
 *
 * Verifies:
 * - Shows loading skeleton on mount
 * - Renders chart with data from fetch
 * - Shows empty state when data is empty
 * - Handles fetch error gracefully
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { PublishChart } from "@/components/dashboard/publish-chart";

const mockFetch = vi.fn();

vi.mock("recharts", () => ({
  ResponsiveContainer: "recharts-responsive-container",
  BarChart: "recharts-bar-chart",
  Bar: "recharts-bar",
  CartesianGrid: "recharts-cartesian-grid",
  Tooltip: "recharts-tooltip",
  XAxis: "recharts-x-axis",
  YAxis: "recharts-y-axis",
}));

describe("PublishChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("shows loading skeleton on mount", () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(<PublishChart />);

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders chart with data from fetch", async () => {
    const chartData = [
      { date: "2025-05-25", success: 5, failed: 1 },
      { date: "2025-05-26", success: 3, failed: 0 },
      { date: "2025-05-27", success: 7, failed: 2 },
    ];

    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: chartData }),
    });

    render(<PublishChart />);

    await waitFor(() => {
      expect(screen.getByText("Publications (7 days)")).toBeInTheDocument();
    });

    // Chart container should be rendered
    const chart = document.querySelector("recharts-bar-chart");
    expect(chart).toBeInTheDocument();

    expect(mockFetch).toHaveBeenCalledWith("/api/v1/dashboard/chart-data?days=7");
  });

  it("shows empty data message when data array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: [] }),
    });

    render(<PublishChart />);

    await waitFor(() => {
      expect(screen.getByText("No data yet")).toBeInTheDocument();
    });

    expect(screen.getByText("Publications (7 days)")).toBeInTheDocument();
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("API error"));

    render(<PublishChart />);

    await waitFor(() => {
      expect(screen.getByText("No data yet")).toBeInTheDocument();
    });
  });
});
