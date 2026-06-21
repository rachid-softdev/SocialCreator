/**
 * Tests for CalendarPlatformFilter component
 *
 * Verifies:
 * - Renders "All" chip with total count
 * - Renders platform chips from PLATFORMS
 * - Clicking a platform sets it as selected
 * - Clicking the same platform again deselects (sets to null)
 * - Clicking "All" sets selected to null
 * - Platform chips show count badges
 * - Selected state styling is applied
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { CalendarPlatformFilter } from "../calendar-platform-filter";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: [
    { value: "TIKTOK", label: "TikTok", icon: "TikTok" },
    { value: "INSTAGRAM", label: "Instagram", icon: "Instagram" },
    { value: "YOUTUBE", label: "YouTube", icon: "YouTube" },
    { value: "FACEBOOK", label: "Facebook", icon: "Facebook" },
    { value: "X", label: "X (Twitter)", icon: "X" },
    { value: "LINKEDIN", label: "LinkedIn", icon: "LinkedIn" },
    { value: "THREADS", label: "Threads", icon: "Threads" },
    { value: "PINTEREST", label: "Pinterest", icon: "Pinterest" },
  ],
}));

// ── Fixtures ──────────────────────────────────────────────────────────

const mockCounts: Record<string, number> = {
  TIKTOK: 3,
  INSTAGRAM: 5,
  YOUTUBE: 2,
  FACEBOOK: 0,
  X: 7,
  LINKEDIN: 1,
  THREADS: 0,
  PINTEREST: 4,
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("CalendarPlatformFilter", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the All chip with total count", () => {
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={mockCounts} />);

    const allButton = screen.getByText("All");
    expect(allButton).toBeInTheDocument();
    // Total = 3+5+2+0+7+1+0+4 = 22
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("renders all platform chips", () => {
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={mockCounts} />);

    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByText("Facebook")).toBeInTheDocument();
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Threads")).toBeInTheDocument();
    expect(screen.getByText("Pinterest")).toBeInTheDocument();
  });

  it("shows count badges for platforms with counts > 0", () => {
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={mockCounts} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // TikTok
    expect(screen.getByText("5")).toBeInTheDocument(); // Instagram
    expect(screen.getByText("7")).toBeInTheDocument(); // X
    expect(screen.getByText("4")).toBeInTheDocument(); // Pinterest
  });

  it("does not show count badge for platforms with 0 count", () => {
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={mockCounts} />);

    // Facebook has count 0, so no badge should be rendered for it
    const facebookButton = screen.getByText("Facebook").closest("button");
    // The badge content should not exist inside the Facebook button
    const badgeSpans = facebookButton?.querySelectorAll("span");
    // There should be no extra span for the count (only the label span)
    expect(facebookButton?.textContent?.trim()).toBe("Facebook");
  });

  it("calls onChange with platform value when a platform chip is clicked", async () => {
    const user = userEvent.setup();
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={mockCounts} />);

    await user.click(screen.getByText("TikTok"));
    expect(onChange).toHaveBeenCalledWith("TIKTOK");
  });

  it("calls onChange with null when the selected platform is clicked again", async () => {
    const user = userEvent.setup();
    render(<CalendarPlatformFilter selected="INSTAGRAM" onChange={onChange} counts={mockCounts} />);

    await user.click(screen.getByText("Instagram"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with null when 'All' is clicked", async () => {
    const user = userEvent.setup();
    render(<CalendarPlatformFilter selected="X" onChange={onChange} counts={mockCounts} />);

    await user.click(screen.getByText("All"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("applies selected styling to the All chip when selected is null", () => {
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={mockCounts} />);

    const allButton = screen.getByText("All");
    // When selected is null, All is active and should have ink bg
    expect(allButton.className).toContain("bg-ink");
  });

  it("applies selected styling to the platform chip when selected", () => {
    render(<CalendarPlatformFilter selected="TIKTOK" onChange={onChange} counts={mockCounts} />);

    const tiktokButton = screen.getByText("TikTok").closest("button");
    expect(tiktokButton?.className).toContain("bg-ink");
  });

  it("calls onChange with new platform when switching selection", async () => {
    const user = userEvent.setup();
    render(<CalendarPlatformFilter selected="TIKTOK" onChange={onChange} counts={mockCounts} />);

    await user.click(screen.getByText("Instagram"));
    expect(onChange).toHaveBeenCalledWith("INSTAGRAM");
  });

  it("handles empty counts object", () => {
    render(<CalendarPlatformFilter selected={null} onChange={onChange} counts={{}} />);

    // All count should be 0
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
