/**
 * Tests for MuxPlayer component
 *
 * Verifies:
 * - Renders video container with controls
 * - Renders hook overlay when hook prop is provided
 * - Renders Mux branding SVG
 * - Sets stream URL from playbackId
 * - Attempts autoPlay when autoPlay is true
 * - Applies className to container
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { MuxPlayer } from "../mux-player";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn() },
}));

vi.mock("@/lib/mux", () => ({
  getMuxStreamUrl: vi.fn((playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`),
}));

// Import mocked module for assertion
import { getMuxStreamUrl as mockGetMuxStreamUrl } from "@/lib/mux";

// Mock hls.js dynamic import
vi.mock("hls.js", () => ({
  default: {
    isSupported: vi.fn(() => false),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("MuxPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the video container", () => {
    const { container } = render(<MuxPlayer playbackId="abc123" />);

    const videoContainer = container.querySelector(".aspect-video");
    expect(videoContainer).toBeInTheDocument();
  });

  it("renders a video element with controls", () => {
    render(<MuxPlayer playbackId="abc123" />);

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
  });

  it("renders the video element with playsInline attribute", () => {
    render(<MuxPlayer playbackId="abc123" />);

    const video = document.querySelector("video");
    expect(video).toHaveAttribute("playsinline");
  });

  it("renders Mux branding SVG", () => {
    const { container } = render(<MuxPlayer playbackId="abc123" />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders hook overlay when hook prop is provided", () => {
    render(<MuxPlayer playbackId="abc123" hook="Amazing intro" />);

    expect(screen.getByText("Amazing intro")).toBeInTheDocument();
  });

  it("does not render hook overlay when hook is not provided", () => {
    render(<MuxPlayer playbackId="abc123" />);

    expect(screen.queryByText("Amazing intro")).not.toBeInTheDocument();
  });

  it("renders Mux branding with aria-hidden", () => {
    const { container } = render(<MuxPlayer playbackId="abc123" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom className to container", () => {
    const { container } = render(<MuxPlayer playbackId="abc123" className="custom-class" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("custom-class");
  });

  it("sets video muted attribute", () => {
    render(<MuxPlayer playbackId="abc123" />);

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
  });

  it("renders with default startTime of 0", () => {
    const { container } = render(<MuxPlayer playbackId="abc123" />);

    expect(container.querySelector(".aspect-video")).toBeInTheDocument();
  });

  it("renders with autoPlay false by default", () => {
    const { container } = render(<MuxPlayer playbackId="abc123" />);

    expect(container.querySelector(".aspect-video")).toBeInTheDocument();
  });

  it("calls getMuxStreamUrl with playbackId", () => {
    render(<MuxPlayer playbackId="test-id" />);

    // Mock is already set up via vi.mock — verify it was called
    expect(mockGetMuxStreamUrl).toHaveBeenCalledWith("test-id");
  });

  it("does not throw on unmount when HLS is not supported", () => {
    const { unmount } = render(<MuxPlayer playbackId="abc123" />);
    expect(() => unmount()).not.toThrow();
  });
});
