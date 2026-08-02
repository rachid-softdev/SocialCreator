/**
 * Tests for GenerationPanel component.
 *
 * Tests profile dropdown, platform selection, brief input,
 * generate button, results display, and error state.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { GenerationPanel } from "../generation-panel";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "💼" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
]);

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Loader2: "svg-loader",
  Sparkles: "svg-sparkles",
  X: "svg-x",
}));

vi.mock("../generation-result", () => ({
  GenerationResult: ({ content }: any) => (
    <div data-testid="generation-result">{content.textContent}</div>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("GenerationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for profile loading
    globalThis.fetch = vi.fn();
  });

  it("renders the generation form with heading", () => {
    // Mock fetch to return profiles
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    expect(screen.getByText("Generate Content")).toBeInTheDocument();
  });

  it("renders a profile selector", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toBeInTheDocument();
    });
  });

  it("renders platform selection", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Select a platform/)).toBeInTheDocument();
    });
  });

  it("renders brief textarea", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("Describe what you want to generate...");
      expect(textarea).toBeInTheDocument();
    });
  });

  it("renders generate button", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getByText("Generate")).toBeInTheDocument();
    });
  });

  it("renders count selector buttons (1-5)", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  it("shows brief validation error when brief is under 10 chars", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    const user = userEvent.setup();
    render(<GenerationPanel />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Describe what you want to generate..."),
      ).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Describe what you want to generate...");
    await user.type(textarea, "Short");

    expect(screen.getByText("Brief must be at least 10 characters")).toBeInTheDocument();
    // Generate button should be disabled
    expect(screen.getByText("Generate")).toBeDisabled();
  });

  it("shows error message when API returns an error", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "profile-1", name: "Test Profile" }],
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Generation limit reached", code: "LIMIT_REACHED" }),
      });

    globalThis.fetch = mockFetch;

    const user = userEvent.setup();
    render(<GenerationPanel />);

    // Wait for profiles to load
    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toBeInTheDocument();
    });

    const platformSelect = screen.getAllByRole("combobox")[1]!; // Second combobox is platform
    await user.selectOptions(platformSelect, "X");

    const textarea = screen.getByPlaceholderText("Describe what you want to generate...");
    await user.type(textarea, "This is a valid brief with enough characters");

    // Click generate
    await user.click(screen.getByText("Generate"));

    await waitFor(() => {
      expect(screen.getByText("Generation limit reached")).toBeInTheDocument();
    });
  });

  it("shows generated content results after successful generation", async () => {
    const mockResults = [
      {
        id: "gen-1",
        textContent: "Generated post 1",
        platform: "X",
        hashtags: [],
        status: "DRAFT",
      },
      {
        id: "gen-2",
        textContent: "Generated post 2",
        platform: "X",
        hashtags: [],
        status: "DRAFT",
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "profile-1", name: "Test Profile" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contents: mockResults }),
      });

    globalThis.fetch = mockFetch;

    const user = userEvent.setup();
    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toBeInTheDocument();
    });

    const platformSelect = screen.getAllByRole("combobox")[1]!; // Second combobox is platform
    await user.selectOptions(platformSelect, "X");

    const textarea = screen.getByPlaceholderText("Describe what you want to generate...");
    await user.type(textarea, "This is a valid brief with enough chars");

    await user.click(screen.getByText("Generate"));

    await waitFor(() => {
      expect(screen.getByText("Generated Content (2 items)")).toBeInTheDocument();
    });

    expect(screen.getByText("Generated post 1")).toBeInTheDocument();
    expect(screen.getByText("Generated post 2")).toBeInTheDocument();
  });

  it("shows loading state during generation", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "profile-1", name: "Test Profile" }],
      })
      .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    globalThis.fetch = mockFetch;

    const user = userEvent.setup();
    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toBeInTheDocument();
    });

    const platformSelect = screen.getAllByRole("combobox")[1]!; // Second combobox is platform
    await user.selectOptions(platformSelect, "X");

    const textarea = screen.getByPlaceholderText("Describe what you want to generate...");
    await user.type(textarea, "This is a valid brief with enough chars");

    await user.click(screen.getByText("Generate"));

    await waitFor(() => {
      expect(screen.getByText("Generating...")).toBeInTheDocument();
    });
  });

  it("renders keywords input field", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g., AI, technology, innovation")).toBeInTheDocument();
    });
  });

  it("renders brand voice input field", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "profile-1", name: "Test Profile" }],
    });

    render(<GenerationPanel />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("e.g., Professional and authoritative"),
      ).toBeInTheDocument();
    });
  });
});
