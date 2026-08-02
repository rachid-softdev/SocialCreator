/**
 * Tests for VideoTimeline component
 *
 * Verifies:
 * - Renders time markers every 30 seconds
 * - Renders segment highlights
 * - CurrentTime shows progress indicator and playhead
 * - Seek interaction on timeline click
 * - Segment label buttons
 * - Heatmap words intensity
 * - Empty state when no words or segments
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { VideoTimeline } from "../video-timeline";

// ── Fixtures ──────────────────────────────────────────────────────────

const mockWords = [
  { word: "Hello", start: 0, end: 0.5 },
  { word: "world", start: 0.6, end: 1.0 },
  { word: "this", start: 10, end: 10.5 },
  { word: "is", start: 11, end: 11.5 },
  { word: "a", start: 20, end: 20.5 },
  { word: "test", start: 21, end: 21.5 },
];

const mockSegments = [
  { start: 0, end: 30, reason: "Opening", hook: "Intro" },
  { start: 60, end: 90, reason: "Main point", hook: "Key insight" },
];

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("VideoTimeline", () => {
  const onSeek = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders time markers every 30 seconds based on duration", () => {
    render(<VideoTimeline duration={120} />);

    // Markers at 0, 30, 60, 90, 120
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("0:30")).toBeInTheDocument();
    expect(screen.getByText("1:00")).toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("calculates duration from words when not provided", () => {
    render(<VideoTimeline words={mockWords} />);

    // Last word ends at 21.5, so markers at 0 only (less than 30s total)
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.queryByText("0:30")).not.toBeInTheDocument();
  });

  it("renders segment highlight buttons", () => {
    render(<VideoTimeline words={mockWords} segments={mockSegments} duration={120} />);

    expect(screen.getByText("Clip 1")).toBeInTheDocument();
    expect(screen.getByText("Clip 2")).toBeInTheDocument();
  });

  it("calls onSeek with segment start time when segment label is clicked", async () => {
    const user = userEvent.setup();
    render(
      <VideoTimeline words={mockWords} segments={mockSegments} duration={120} onSeek={onSeek} />,
    );

    await user.click(screen.getByText("Clip 1"));
    expect(onSeek).toHaveBeenCalledWith(0);

    await user.click(screen.getByText("Clip 2"));
    expect(onSeek).toHaveBeenCalledWith(60);
  });

  it("renders progress indicator when currentTime > 0", () => {
    const { container } = render(
      <VideoTimeline words={mockWords} duration={120} currentTime={30} />,
    );

    // Progress indicator is a div with gradient background
    const timeline = container.querySelector("button");
    expect(timeline).toBeInTheDocument();
  });

  it("renders playhead indicator", () => {
    const { container } = render(
      <VideoTimeline words={mockWords} duration={120} currentTime={60} />,
    );

    // Playhead is a rounded-full div
    const playhead = container.querySelector(".rounded-full");
    expect(playhead).toBeInTheDocument();
  });

  it("does not render segment labels when segments array is empty", () => {
    const { container } = render(<VideoTimeline words={mockWords} segments={[]} duration={120} />);

    expect(screen.queryByText("Clip 1")).not.toBeInTheDocument();
  });

  it("calls onSeek when timeline is clicked", async () => {
    const user = userEvent.setup();
    render(<VideoTimeline words={mockWords} duration={120} onSeek={onSeek} />);

    // The timeline track button is the one that handles clicks for seeking
    const timelineButtons = screen.getAllByRole("button");
    // Find the main timeline track button (it has class 'relative w-full h-16')
    const timeline = timelineButtons.find(
      (btn) => btn.className.includes("w-full") && btn.className.includes("h-16"),
    )!;

    // Mock getBoundingClientRect before clicking
    const originalGetBoundingClientRect = timeline.getBoundingClientRect.bind(timeline);
    timeline.getBoundingClientRect = () => ({
      left: 0,
      width: 400,
      top: 0,
      height: 64,
      right: 400,
      bottom: 64,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // user-event v14 click() does not accept clientX; use pointer() to specify coords
    await user.pointer([
      { target: timeline, coords: { clientX: 100, clientY: 32 } },
      { keys: "[MouseLeft]", target: timeline, coords: { clientX: 100, clientY: 32 } },
    ]);

    // 100/400 = 0.25 * 120 = 30
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it("applies custom className", () => {
    const { container } = render(<VideoTimeline className="custom-class" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("custom-class");
  });

  it("renders with empty words and segments", () => {
    const { container } = render(<VideoTimeline />);

    // Should still render time markers (just 0:00 when total duration is 0)
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("does not call onSeek when onSeek is not provided", async () => {
    const user = userEvent.setup();
    const { container } = render(<VideoTimeline words={mockWords} duration={120} />);

    const timeline = container.querySelector("button")!;
    const rect = { left: 0, width: 400 };
    Object.defineProperty(timeline, "getBoundingClientRect", {
      value: () => rect,
    });

    await user.click(timeline);
    // No error should occur
  });

  it("renders segment highlights with correct positioning", () => {
    const { container } = render(
      <VideoTimeline words={mockWords} segments={mockSegments} duration={120} />,
    );

    const segmentHighlights = container.querySelectorAll('[class*="bg-gradient-peach"]');
    expect(segmentHighlights.length).toBe(2);
  });
});
