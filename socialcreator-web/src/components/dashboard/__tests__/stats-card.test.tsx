/**
 * Tests for dashboard StatsCard component.
 *
 * Verifies:
 * - Renders label and value
 * - Renders icon when provided
 * - Renders trend indicator when provided
 * - Handles missing icon and trend gracefully
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { StatsCard } from "@/components/dashboard/stats-card";

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("StatsCard (dashboard)", () => {
  it("renders label and value", () => {
    render(<StatsCard label="Profiles" value={42} />);

    expect(screen.getByText("Profiles")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders a formatted large number", () => {
    render(<StatsCard label="Total" value={1234} />);

    // toLocaleString() output can vary by Node version/locale (e.g. "1,234" en-US vs "1 234" fr-FR)
    expect(screen.getByText(/1[\s,.]*234/)).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<StatsCard label="Profiles" value={3} icon={<span data-testid="test-icon">🔍</span>} />);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("renders positive trend indicator", () => {
    render(<StatsCard label="Profiles" value={3} trend={{ value: 12, positive: true }} />);

    expect(screen.getByText("↑ 12%")).toBeInTheDocument();
    expect(screen.getByText("↑ 12%").className).toContain("text-green-600");
  });

  it("renders negative trend indicator", () => {
    render(<StatsCard label="Profiles" value={3} trend={{ value: 5, positive: false }} />);

    expect(screen.getByText("↓ 5%")).toBeInTheDocument();
    expect(screen.getByText("↓ 5%").className).toContain("text-red-600");
  });

  it("renders without icon and trend", () => {
    render(<StatsCard label="Test" value={0} />);

    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
