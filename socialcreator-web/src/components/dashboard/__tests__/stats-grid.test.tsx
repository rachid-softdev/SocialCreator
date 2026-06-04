/**
 * Tests for StatsGrid component.
 *
 * Verifies:
 * - Renders 4 stat cards with default values when no stats provided
 * - Renders with provided stats values
 * - Layout container has correct grid classes
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { StatsGrid } from "@/components/dashboard/stats-grid";

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Bot: "svg-bot",
  FileText: "svg-file-text",
  TrendingUp: "svg-trending-up",
  Users: "svg-users",
}));

describe("StatsGrid", () => {
  it("renders 4 stat cards with default values (0) when no stats provided", () => {
    render(<StatsGrid />);

    expect(screen.getByText("Total Profiles")).toBeInTheDocument();
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(screen.getByText("Pending Drafts")).toBeInTheDocument();
    expect(screen.getByText("Published This Week")).toBeInTheDocument();

    // All default values should be 0
    const values = screen.getAllByText("0");
    expect(values).toHaveLength(4);
  });

  it("renders with provided stats values", () => {
    const stats = {
      totalProfiles: 5,
      activeAgents: 3,
      pendingDrafts: 12,
      publishedThisWeek: 47,
    };

    render(<StatsGrid stats={stats} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("renders layout container with grid classes", () => {
    const { container } = render(<StatsGrid />);

    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-1");
  });

  it("renders icon wrappers with gradient background classes", () => {
    render(<StatsGrid />);

    const iconWrappers = document.querySelectorAll(".rounded-lg.flex.items-center.justify-center");
    // Should have 4 icon wrappers (one per card)
    expect(iconWrappers.length).toBe(4);
  });
});
