/**
 * Tests for QueueStatus component
 *
 * Verifies: renders queue stat cards (queued, running, completed, failed, total),
 * fetches status from API, displays counts, empty/loading states.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { QueueStatus } from "../queue-status";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", mockFetch);

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockQueueData = {
  queued: 3,
  running: 2,
  completed: 150,
  failed: 1,
  total: 156,
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("QueueStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing initially while loading (returns null)", () => {
    // Mock fetch to never resolve during this test
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<QueueStatus />);
    expect(container.innerHTML).toBe("");
  });

  it("renders stat cards after fetching data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueueData,
    });

    render(<QueueStatus />);

    await waitFor(() => {
      expect(screen.getByText("Queued")).toBeInTheDocument();
    });

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("displays the correct counts from the API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueueData,
    });

    render(<QueueStatus />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("156")).toBeInTheDocument();
  });

  it("fetches from /api/v1/queue/status endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQueueData,
    });

    render(<QueueStatus />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/queue/status", { cache: "no-store" });
    });
  });

  it("handles fetch error gracefully (remains null)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { container } = render(<QueueStatus />);

    // Wait for effect to run
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Component returns null on error
    expect(container.innerHTML).toBe("");
  });

  it("handles non-ok response gracefully (remains null)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { container } = render(<QueueStatus />);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders zero values correctly", async () => {
    const zeroData = { queued: 0, running: 0, completed: 0, failed: 0, total: 0 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => zeroData,
    });

    render(<QueueStatus />);

    await waitFor(() => {
      expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    });
  });
});
