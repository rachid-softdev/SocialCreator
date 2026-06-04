/**
 * Tests for PlatformTable component
 *
 * Verifies: table rows rendering, sorting by columns, platform name display,
 * formatted numbers, followers with "+" prefix, empty state (no rows).
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { PlatformTable } from "../platform-table";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockData = [
  { platform: "X", impressions: 1000, engagements: 50, clicks: 200, followers: 25, published: 10 },
  {
    platform: "LinkedIn",
    impressions: 500,
    engagements: 30,
    clicks: 100,
    followers: 10,
    published: 5,
  },
  {
    platform: "Instagram",
    impressions: 2000,
    engagements: 80,
    clicks: 300,
    followers: 0,
    published: 8,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("PlatformTable", () => {
  it("renders the table with column headers", () => {
    render(<PlatformTable data={mockData} />);
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Impressions")).toBeInTheDocument();
    expect(screen.getByText("Engagements")).toBeInTheDocument();
    expect(screen.getByText("Clicks")).toBeInTheDocument();
    expect(screen.getByText("Followers")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders a row for each platform", () => {
    render(<PlatformTable data={mockData} />);
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("formats impression numbers with locale separators", () => {
    render(<PlatformTable data={mockData} />);
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("2,000")).toBeInTheDocument();
  });

  it("shows followers with + prefix when greater than 0", () => {
    render(<PlatformTable data={mockData} />);
    expect(screen.getByText("+25")).toBeInTheDocument();
    expect(screen.getByText("+10")).toBeInTheDocument();
  });

  it("shows em dash for followers when 0", () => {
    render(<PlatformTable data={mockData} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders empty table body when data is empty", () => {
    const { container } = render(<PlatformTable data={[]} />);
    // Table should still render with headers, but no data rows
    expect(screen.getByText("Platform")).toBeInTheDocument();
    const tbody = container.querySelector("tbody");
    expect(tbody).toBeInTheDocument();
    expect(tbody?.children.length).toBe(0);
  });

  it("sorts by impressions descending by default", () => {
    render(<PlatformTable data={mockData} />);
    const rows = screen.getAllByRole("row");
    // First data row should be Instagram (2000 impressions)
    expect(rows[1]).toHaveTextContent("Instagram");
    expect(rows[2]).toHaveTextContent("X");
    expect(rows[3]).toHaveTextContent("LinkedIn");
  });

  it("toggles sort direction when clicking the same column header", async () => {
    const user = userEvent.setup();
    render(<PlatformTable data={mockData} />);

    // Click Impressions header (already sorted desc)
    await user.click(screen.getByText("Impressions"));

    // Now should be sorted asc: LinkedIn first
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("LinkedIn");
  });

  it("sorts by a different column when clicking its header", async () => {
    const user = userEvent.setup();
    render(<PlatformTable data={mockData} />);

    // Click Engagements header
    await user.click(screen.getByText("Engagements"));

    // Sorted desc by engagements: Instagram (80), X (50), LinkedIn (30)
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Instagram");
  });

  it("renders published count as-is", () => {
    render(<PlatformTable data={mockData} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});
