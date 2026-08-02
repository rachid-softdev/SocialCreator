/**
 * Tests for ClipsList component
 *
 * Verifies:
 * - Renders list of clips with hooks and reasons
 * - Status badges (CREATING / READY / ERROR)
 * - Preview and delete action buttons
 * - Empty state when no clips
 * - Thumbnail display
 * - Duration formatting
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ClipsList } from "../clips-list";

// ── Fixtures ──────────────────────────────────────────────────────────

const mockClip = (overrides: Record<string, unknown> = {}) => ({
  assetId: "asset-1",
  playbackId: "playback-1",
  streamUrl: "https://stream.mux.com/playback-1.m3u8",
  thumbnailUrl: "https://image.mux.com/playback-1/thumbnail.jpg?time=0",
  segment: {
    start: 0,
    end: 30,
    reason: "Opening hook",
    hook: "Amazing intro",
  },
  status: "READY" as const,
  ...overrides,
});

const mockClips = [
  mockClip({
    assetId: "asset-1",
    segment: { start: 0, end: 30, reason: "Opening hook", hook: "Amazing intro" },
  }),
  mockClip({
    assetId: "asset-2",
    segment: { start: 60, end: 120, reason: "Key insight", hook: "The main point" },
    status: "CREATING",
  }),
  mockClip({
    assetId: "asset-3",
    segment: { start: 180, end: 210, reason: "Conclusion", hook: "Final thoughts" },
    status: "ERROR",
  }),
];

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Download: ({ className }: any) => (
    <span data-testid="icon-download" className={className}>
      svg-download
    </span>
  ),
  MoreVertical: ({ className }: any) => (
    <span data-testid="icon-more" className={className}>
      svg-more
    </span>
  ),
  Play: ({ className }: any) => (
    <span data-testid="icon-play" className={className}>
      svg-play
    </span>
  ),
  Trash2: ({ className }: any) => (
    <span data-testid="icon-trash" className={className}>
      svg-trash
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

describe("ClipsList", () => {
  const onPreview = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no clips", () => {
    render(<ClipsList clips={[]} />);

    expect(screen.getByText("No clips created yet")).toBeInTheDocument();
  });

  it("renders all clips with hooks", () => {
    render(<ClipsList clips={mockClips} />);

    expect(screen.getByText("Amazing intro")).toBeInTheDocument();
    expect(screen.getByText("The main point")).toBeInTheDocument();
    expect(screen.getByText("Final thoughts")).toBeInTheDocument();
  });

  it("renders all clips with reasons", () => {
    render(<ClipsList clips={mockClips} />);

    expect(screen.getByText("Opening hook")).toBeInTheDocument();
    expect(screen.getByText("Key insight")).toBeInTheDocument();
    expect(screen.getByText("Conclusion")).toBeInTheDocument();
  });

  it("renders status badges with correct labels", () => {
    render(<ClipsList clips={mockClips} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Creating")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("defaults to READY status when status is not provided", () => {
    const clipNoStatus = mockClip({ status: undefined });
    render(<ClipsList clips={[clipNoStatus]} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders thumbnails for each clip", () => {
    render(<ClipsList clips={mockClips} />);

    const images = screen.getAllByRole("img");
    expect(images.length).toBe(3);
  });

  it("renders duration badges", () => {
    render(<ClipsList clips={mockClips} />);

    // 0:30 (asset-1 and asset-3 both have 30s clips)
    const durationBadges = screen.getAllByText("0:30");
    expect(durationBadges.length).toBe(2);
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });

  it("renders preview button for each clip", () => {
    render(<ClipsList clips={mockClips} onPreview={onPreview} />);

    const playIcons = screen.getAllByTestId("icon-play");
    expect(playIcons.length).toBeGreaterThanOrEqual(3);
  });

  it("renders delete button for each clip", () => {
    render(<ClipsList clips={mockClips} onDelete={onDelete} />);

    const trashIcons = screen.getAllByTestId("icon-trash");
    expect(trashIcons.length).toBe(3);
  });

  it("calls onPreview when preview button is clicked", async () => {
    const user = userEvent.setup();
    render(<ClipsList clips={[mockClip()]} onPreview={onPreview} />);

    const previewButtons = screen.getAllByTitle("Preview");
    await user.click(previewButtons[0]!);

    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ assetId: "asset-1" }));
  });

  it("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<ClipsList clips={[mockClip()]} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByTitle("Delete");
    await user.click(deleteButtons[0]!);

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ assetId: "asset-1" }));
  });

  it("renders download buttons for each clip", () => {
    render(<ClipsList clips={mockClips} />);

    const downloadIcons = screen.getAllByTestId("icon-download");
    expect(downloadIcons.length).toBe(3);
  });

  it("renders MoreVertical action buttons for each clip", () => {
    render(<ClipsList clips={mockClips} />);

    const moreIcons = screen.getAllByTestId("icon-more");
    expect(moreIcons.length).toBe(3);
  });

  it("does not crash when onPreview and onDelete are not provided", () => {
    render(<ClipsList clips={mockClips} />);

    expect(screen.getByText("Amazing intro")).toBeInTheDocument();
  });
});
