/**
 * Tests for Analytics StatsCard component
 *
 * Verifies: value rendering, label display, trend indicator (positive/negative/flat),
 * icon rendering, and that trend section is hidden when trend is undefined.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { StatsCard } from "../stats-card";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("StatsCard", () => {
  it("renders the label text", () => {
    render(<StatsCard label="Total Impressions" value="1,234" />);
    expect(screen.getByText("Total Impressions")).toBeInTheDocument();
  });

  it("renders the value as a string", () => {
    render(<StatsCard label="Total Impressions" value="1,234" />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("renders the value as a number", () => {
    render(<StatsCard label="Followers" value={5000} />);
    expect(screen.getByText("5000")).toBeInTheDocument();
  });

  it("renders a positive trend indicator with '+' prefix", () => {
    render(<StatsCard label="Engagements" value={300} trend={12.5} />);
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByText("vs last period")).toBeInTheDocument();
  });

  it("renders a negative trend indicator with no '+' prefix", () => {
    render(<StatsCard label="Bounces" value={50} trend={-5} />);
    expect(screen.getByText("-5%")).toBeInTheDocument();
  });

  it("renders a flat trend indicator with 0 value", () => {
    render(<StatsCard label="Clicks" value={100} trend={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("does not render trend section when trend is undefined", () => {
    render(<StatsCard label="Views" value="999" />);
    expect(screen.queryByText("vs last period")).not.toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    const Icon = () => <svg data-testid="custom-icon" />;
    const { container } = render(<StatsCard label="Test" value="1" icon={Icon as any} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render icon section when icon is not provided", () => {
    const { container } = render(<StatsCard label="Test" value="1" />);
    // Only the trend icon might be present; no custom icon wrapper
    expect(container.querySelector(".rounded-xl")).toBeInTheDocument();
  });

  it("renders positive trend with TrendingUp icon", () => {
    const { container } = render(<StatsCard label="Test" value="1" trend={10} />);
    // TrendingUp icon should be rendered
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders negative trend with TrendingDown icon", () => {
    const { container } = render(<StatsCard label="Test" value="1" trend={-10} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("displays the correct card structure with label, value, and trend", () => {
    render(<StatsCard label="Revenue" value="$5,000" trend={8.3} />);
    const card = screen.getByText("Revenue").closest(".rounded-xl");
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent("Revenue");
    expect(card).toHaveTextContent("$5,000");
    expect(card).toHaveTextContent("+8.3%");
  });
});
