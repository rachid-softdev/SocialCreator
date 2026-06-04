/**
 * Tests for DashboardStats component.
 *
 * Verifies:
 * - Shows 4 skeleton cards on loading
 * - Renders stat cards with data from fetch
 * - Returns null on error (logger called)
 * - Fetch is called on mount
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";

const mockFetch = vi.fn();

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("lucide-react", () => ({
  FileText: "svg-file-text",
  Layers: "svg-layers",
  Send: "svg-send",
  User: "svg-user",
}));

vi.mock("@/components/dashboard/stats-card", () => ({
  StatsCard: ({ label, value, icon }: any) => (
    <div data-testid="stats-card">
      <span data-testid="card-label">{label}</span>
      <span data-testid="card-value">{value}</span>
      {icon}
    </div>
  ),
}));

describe("DashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("shows 4 skeleton cards on loading", () => {
    // Never resolve the fetch to keep loading state
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(<DashboardStats />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(4);
  });

  it("renders stat cards with data from fetch", async () => {
    const dashboardData = {
      stats: {
        profiles: 3,
        totalContents: 25,
        totalPublished: 18,
        todayPublishes: 2,
      },
      recentActivity: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => dashboardData,
    });

    render(<DashboardStats />);

    await waitFor(() => {
      expect(screen.getByText("Profiles")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Content")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Published Today")).toBeInTheDocument();

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const cards = screen.getAllByTestId("stats-card");
    expect(cards).toHaveLength(4);

    expect(mockFetch).toHaveBeenCalledWith("/api/v1/dashboard");
  });

  it("returns null on error and calls logger", async () => {
    const logger = await import("@/lib/logger");
    const loggerError = vi.spyOn(logger.default, "error");

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { container } = render(<DashboardStats />);

    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });

    expect(loggerError).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Dashboard stats fetch error",
    );
  });

  it("calls fetch on mount", () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(<DashboardStats />);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/dashboard");
  });
});
