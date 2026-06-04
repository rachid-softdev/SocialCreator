/**
 * Tests for PublishStats component.
 *
 * Verifies:
 * - Renders success/failure counts per platform
 * - Shows progress bars with correct widths
 * - Renders warning for platforms near limit
 * - Shows "No active platform connections" when all max = 0
 * - Renders total today count
 * - Shows period/title heading
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PublishStats } from "@/components/dashboard/publish-stats";

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: "svg-alert-circle",
  TrendingUp: "svg-trending-up",
}));

vi.mock("@/components/connected-accounts/platform-icon", () => ({
  getPlatformName: (platform: string) => {
    const names: Record<string, string> = {
      X: "X (Twitter)",
      LINKEDIN: "LinkedIn",
      INSTAGRAM: "Instagram",
    };
    return names[platform] || platform;
  },
}));

describe("PublishStats", () => {
  const defaultStats = [
    { platform: "X" as const, count: 3, max: 10, allowed: true },
    { platform: "LINKEDIN" as const, count: 8, max: 10, allowed: true },
    { platform: "INSTAGRAM" as const, count: 0, max: 0, allowed: false },
  ];

  it("renders platform names and counts", () => {
    render(<PublishStats stats={defaultStats} />);

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
  });

  it("shows progress bar with correct width", () => {
    render(<PublishStats stats={defaultStats} />);

    const progressBars = document.querySelectorAll("[style*='width:']");
    expect(progressBars.length).toBeGreaterThan(0);
    // First bar (X): 3/10 = 30%
    expect(progressBars[0]).toHaveStyle("width: 30%");
  });

  it("shows warning for platforms near limit (>= 75%)", () => {
    const nearLimitStats = [{ platform: "X" as const, count: 8, max: 10, allowed: true }];

    render(<PublishStats stats={nearLimitStats} />);

    expect(screen.getByText("Limit approaching")).toBeInTheDocument();
  });

  it("does not show warning when showWarnings is false", () => {
    const nearLimitStats = [{ platform: "X" as const, count: 8, max: 10, allowed: true }];

    render(<PublishStats stats={nearLimitStats} showWarnings={false} />);

    expect(screen.queryByText("Limit approaching")).not.toBeInTheDocument();
  });

  it("shows 'No active platform connections' when all max = 0", () => {
    const emptyStats = [
      { platform: "X" as const, count: 0, max: 0, allowed: false },
      { platform: "INSTAGRAM" as const, count: 0, max: 0, allowed: false },
    ];

    render(<PublishStats stats={emptyStats} />);

    expect(screen.getByText("No active platform connections yet")).toBeInTheDocument();
  });

  it("renders total today count", () => {
    render(<PublishStats stats={defaultStats} />);

    expect(screen.getByText("Total today")).toBeInTheDocument();
    expect(screen.getByText("11 posts")).toBeInTheDocument(); // 3 + 8
  });

  it("renders custom title when provided", () => {
    render(<PublishStats stats={defaultStats} title="Custom Title" />);

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  it("renders default title when not provided", () => {
    render(<PublishStats stats={defaultStats} />);

    expect(screen.getByText("Publication Limits")).toBeInTheDocument();
  });
});
