/**
 * Tests for ClipSelector component
 *
 * Verifies:
 * - Renders segment list with hook and reason
 * - Select all / deselect all
 * - Generate button disabled when 0 segments selected
 * - isGenerating state shows "Generating..."
 * - Thumbnail rendering with playbackId
 * - Duration and time formatting
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ClipSelector } from "../clip-selector";

// ── Fixtures ──────────────────────────────────────────────────────────

const mockSegments = [
  { start: 0, end: 30, reason: "Opening hook", hook: "Amazing intro" },
  { start: 60, end: 120, reason: "Key insight", hook: "The main point" },
  { start: 180, end: 210, reason: "Strong conclusion", hook: "Final thoughts" },
];

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Check: ({ className }: any) => (
    <span data-testid="icon-check" className={className}>
      svg-check
    </span>
  ),
  Clock: ({ className }: any) => (
    <span data-testid="icon-clock" className={className}>
      svg-clock
    </span>
  ),
  Play: ({ className }: any) => (
    <span data-testid="icon-play" className={className}>
      svg-play
    </span>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt || ""} />
  ),
}));

vi.mock("@/lib/mux", () => ({
  getMuxThumbnailUrl: vi.fn(
    (playbackId: string, time: number) =>
      `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`,
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("ClipSelector", () => {
  const onSelectSegments = vi.fn();
  const onGenerateContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header with clip count", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    expect(screen.getByText("Identified Clips")).toBeInTheDocument();
    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();
  });

  it("renders all segment cards with hooks and reasons", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    expect(screen.getByText("Amazing intro")).toBeInTheDocument();
    expect(screen.getByText("The main point")).toBeInTheDocument();
    expect(screen.getByText("Final thoughts")).toBeInTheDocument();

    expect(screen.getByText("Opening hook")).toBeInTheDocument();
    expect(screen.getByText("Key insight")).toBeInTheDocument();
    expect(screen.getByText("Strong conclusion")).toBeInTheDocument();
  });

  it("renders duration badges for each segment", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    // 0→30 = 30s, 60→120 = 1m 0s, 180→210 = 30s
    const thirthySecBadges = screen.getAllByText("30s");
    expect(thirthySecBadges.length).toBe(2);
    expect(screen.getByText("1m 0s")).toBeInTheDocument();
  });

  it("renders time range badges for each segment", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    expect(screen.getByText("0:00 → 0:30")).toBeInTheDocument();
    expect(screen.getByText("1:00 → 2:00")).toBeInTheDocument();
    expect(screen.getByText("3:00 → 3:30")).toBeInTheDocument();
  });

  it("renders thumbnails when playbackId is provided", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        playbackId="abc123"
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images.length).toBe(3);
    expect(images[0]).toHaveAttribute("src", "https://image.mux.com/abc123/thumbnail.jpg?time=0");
  });

  it("selects all segments by default", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();
  });

  it("deselects all when Deselect all is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    await user.click(screen.getByText("Deselect all"));

    expect(screen.getByText("0 of 3 selected")).toBeInTheDocument();
  });

  it("selects all after deselect when Select all is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    await user.click(screen.getByText("Deselect all"));
    expect(screen.getByText("0 of 3 selected")).toBeInTheDocument();

    await user.click(screen.getByText("Select all"));
    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();
  });

  it("generates button is disabled when 0 segments selected", async () => {
    const user = userEvent.setup();
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    await user.click(screen.getByText("Deselect all"));

    const generateButton = screen.getByText("Generate content for 0 clips");
    expect(generateButton).toBeDisabled();
  });

  it("shows Generating... text when isGenerating is true", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
        isGenerating={true}
      />,
    );

    expect(screen.getByText("Generating...")).toBeInTheDocument();
  });

  it("generate button is disabled when isGenerating is true", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
        isGenerating={true}
      />,
    );

    const button = screen.getByText("Generating...");
    expect(button).toBeDisabled();
  });

  it("calls onSelectSegments and onGenerateContent when generate is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    await user.click(screen.getByText("Generate content for 3 clips"));

    expect(onSelectSegments).toHaveBeenCalledWith(mockSegments);
    expect(onGenerateContent).toHaveBeenCalled();
  });

  it("toggles segment selection on click", async () => {
    const user = userEvent.setup();
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    // Click first segment card to deselect it
    const segmentButtons = screen.getAllByRole("button");
    const firstCard = segmentButtons.find((btn) => btn.textContent?.includes("Amazing intro"));
    expect(firstCard).toBeDefined();

    if (firstCard) {
      await user.click(firstCard);
      expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    }
  });

  it("shows singular 'clip' for single selection", async () => {
    const user = userEvent.setup();
    render(
      <ClipSelector
        segments={[mockSegments[0]]}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    expect(screen.getByText("Generate content for 1 clip")).toBeInTheDocument();
  });

  it("shows the clock icon on time range badges", () => {
    render(
      <ClipSelector
        segments={mockSegments}
        onSelectSegments={onSelectSegments}
        onGenerateContent={onGenerateContent}
      />,
    );

    const clockIcons = screen.getAllByTestId("icon-clock");
    expect(clockIcons.length).toBe(3);
  });
});
