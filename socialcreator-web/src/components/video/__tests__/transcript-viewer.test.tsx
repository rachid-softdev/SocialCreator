/**
 * Tests for TranscriptViewer component
 *
 * Verifies:
 * - Renders transcript text when no words provided
 * - Renders clickable word buttons when words are provided
 * - Time formatting (M:SS)
 * - Hover time indicator
 * - Word click calls onSeek with correct time
 * - Time navigation buttons for every 50th word
 * - Highlights hovered word
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { TranscriptViewer } from "../transcript-viewer";

// ── Fixtures ──────────────────────────────────────────────────────────

const mockWords = [
  { word: "Hello", start: 0, end: 0.5 },
  { word: "world", start: 0.6, end: 1.0 },
  { word: "this", start: 1.2, end: 1.5 },
  { word: "is", start: 1.6, end: 1.8 },
  { word: "a", start: 1.9, end: 2.0 },
  { word: "test", start: 2.1, end: 2.5 },
  { word: "transcript", start: 5.0, end: 5.8 },
];

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("TranscriptViewer", () => {
  const onSeek = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders plain transcript text when no words provided", () => {
    render(<TranscriptViewer transcript="Hello world this is a test" />);

    expect(screen.getByText("Hello world this is a test")).toBeInTheDocument();
  });

  it("renders word buttons when words are provided", () => {
    render(
      <TranscriptViewer transcript="Hello world this is a test transcript" words={mockWords} />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
  });

  it("calls onSeek with word start time when word is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TranscriptViewer
        transcript="Hello world this is a test transcript"
        words={mockWords}
        onSeek={onSeek}
      />,
    );

    await user.click(screen.getByText("Hello"));
    expect(onSeek).toHaveBeenCalledWith(0);

    await user.click(screen.getByText("test"));
    expect(onSeek).toHaveBeenCalledWith(2.1);
  });

  it("shows hover time indicator when hovering over a word", async () => {
    const user = userEvent.setup();
    render(
      <TranscriptViewer
        transcript="Hello world this is a test transcript"
        words={mockWords}
        onSeek={onSeek}
      />,
    );

    const helloButton = screen.getByText("Hello");
    await user.hover(helloButton);

    expect(screen.getByText("Jump to 0:00")).toBeInTheDocument();
  });

  it("hides hover time indicator on mouse leave", async () => {
    const user = userEvent.setup();
    render(
      <TranscriptViewer
        transcript="Hello world this is a test transcript"
        words={mockWords}
        onSeek={onSeek}
      />,
    );

    const helloButton = screen.getByText("Hello");
    await user.hover(helloButton);
    expect(screen.getByText("Jump to 0:00")).toBeInTheDocument();

    await user.unhover(helloButton);
    expect(screen.queryByText("Jump to 0:00")).not.toBeInTheDocument();
  });

  it("formats time correctly for various values", () => {
    const timeWords = [
      { word: "start", start: 0, end: 0.5 },
      { word: "minute", start: 65, end: 66 },
      { word: "long", start: 125, end: 126 },
    ];

    render(<TranscriptViewer transcript="test" words={timeWords} onSeek={onSeek} />);

    // Check time navigation buttons exist with formatted times
    const navButtons = screen.getAllByText("0:00");
    // First word at start=0 should have a nav button
    expect(navButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders time navigation buttons for every 50th word", () => {
    // Create 150 words
    const manyWords = Array.from({ length: 150 }, (_, i) => ({
      word: `word${i}`,
      start: i * 2,
      end: i * 2 + 1,
    }));

    render(<TranscriptViewer transcript="test" words={manyWords} onSeek={onSeek} />);

    // Should have navigation buttons at indices 0, 50, 100 (up to 20 max)
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.getByText("1:40")).toBeInTheDocument(); // 100s = 1:40
    expect(screen.getByText("3:20")).toBeInTheDocument(); // 200s = 3:20
  });

  it("does not show word groups when words array is empty", () => {
    render(<TranscriptViewer transcript="Plain text only" words={[]} />);

    expect(screen.getByText("Plain text only")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<TranscriptViewer transcript="test" className="custom-class" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("custom-class");
  });

  it("renders word title attribute with time range", () => {
    render(
      <TranscriptViewer transcript="Hello world" words={mockWords.slice(0, 2)} onSeek={onSeek} />,
    );

    const helloButton = screen.getByText("Hello");
    // formatTime(0) = "0:00", formatTime(0.5) = "0:00" (floor(0.5 % 60) = 0)
    expect(helloButton).toHaveAttribute("title", "0:00 - 0:00");

    const worldButton = screen.getByText("world");
    // formatTime(0.6) = "0:00", formatTime(1.0) = "0:01"
    expect(worldButton).toHaveAttribute("title", "0:00 - 0:01");
  });

  it("calls onSeek when time navigation button is clicked", async () => {
    const user = userEvent.setup();
    render(<TranscriptViewer transcript="test" words={mockWords} onSeek={onSeek} />);

    await user.click(screen.getByText("0:00"));
    expect(onSeek).toHaveBeenCalledWith(0);
  });
});
