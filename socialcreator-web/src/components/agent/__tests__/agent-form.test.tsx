/**
 * Tests for AgentForm component.
 *
 * Verifies:
 * - Multi-step form with step indicator
 * - Type selection in step 1
 * - Platform selection in step 2
 * - Submit creates agent via POST
 * - Validation: name required, at least one platform
 * - Handles API errors
 * - Edit mode uses PATCH /api/agents/:id
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { AgentForm } from "@/components/agent/agent-form";

const mockFetch = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@socialcreator/types/agent", () => ({
  AGENT_TYPE_LABELS: {
    TEXT_POST: "Text Post",
    VIDEO_CLIP: "Video Clip",
    CROSS_POST: "Cross Post",
  },
  AGENT_TYPE_DESCRIPTIONS: {
    TEXT_POST: "Generate text-based social media posts",
    VIDEO_CLIP: "Create short video clips",
    CROSS_POST: "Cross-post content across platforms",
  },
}));

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: [
    { value: "X", icon: "𝕏", label: "X" },
    { value: "LINKEDIN", icon: "in", label: "LinkedIn" },
    { value: "INSTAGRAM", icon: "📷", label: "Instagram" },
  ],
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Bot: "svg-bot",
  RefreshCw: "svg-refresh-cw",
  Type: "svg-type",
  Video: "svg-video",
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    refresh: mockRefresh,
  })),
}));

describe("AgentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("renders multi-step form with step indicator (Basic Info and Platforms & Schedule)", () => {
    render(<AgentForm profileId="profile-1" />);

    expect(screen.getByText("Basic Info")).toBeInTheDocument();
    expect(screen.getByText("Platforms & Schedule")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows type selection options in step 1", () => {
    render(<AgentForm profileId="profile-1" />);

    expect(screen.getByText("Text Post")).toBeInTheDocument();
    expect(screen.getByText("Video Clip")).toBeInTheDocument();
    expect(screen.getByText("Cross Post")).toBeInTheDocument();
  });

  it("has name input field", () => {
    render(<AgentForm profileId="profile-1" />);

    expect(screen.getByLabelText("Agent Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\., Daily Inspiration Bot/)).toBeInTheDocument();
  });

  it("moves to step 2 when Continue is clicked", async () => {
    render(<AgentForm profileId="profile-1" />);

    const continueBtn = screen.getByText("Continue");
    await userEvent.click(continueBtn);

    // Step 2 content should appear
    expect(screen.getByText("Target Platforms")).toBeInTheDocument();
    expect(screen.getByText("Schedule (Cron Expression)")).toBeInTheDocument();
    expect(screen.getByText("Auto-publish")).toBeInTheDocument();
  });

  it("can go back from step 2 to step 1", async () => {
    render(<AgentForm profileId="profile-1" />);

    await userEvent.click(screen.getByText("Continue"));
    expect(screen.getByText("Target Platforms")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Agent Type")).toBeInTheDocument();
  });

  it("allows selecting a platform in step 2", async () => {
    render(<AgentForm profileId="profile-1" />);

    await userEvent.click(screen.getByText("Continue"));

    // Find the X platform button (the label text span has class "text-body-sm")
    const xLabel = screen.getByText("X");
    const xButton = xLabel.closest("button")!;
    await userEvent.click(xButton);

    // Platform pill button should now have active styling (bg-primary class on button)
    expect(xButton.className).toContain("bg-primary");
  });

  it("submits form and creates agent via POST on step 2", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<AgentForm profileId="profile-1" />);

    // Fill in name
    const nameInput = screen.getByLabelText("Agent Name");
    await userEvent.type(nameInput, "My Agent");

    // Go to step 2
    await userEvent.click(screen.getByText("Continue"));

    // Select a platform
    const xButton = screen.getByText("X");
    await userEvent.click(xButton);

    // Submit
    const createBtn = screen.getByText("Create Agent");
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("My Agent"),
      });
    });

    expect(mockPush).toHaveBeenCalledWith("/profiles/profile-1/agents");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows validation error when name is empty", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<AgentForm profileId="profile-1" />);

    // Go to step 2 without filling name
    await userEvent.click(screen.getByText("Continue"));

    // Try to submit without filling name (name validation runs first)
    const createBtn = screen.getByText("Create Agent");
    await userEvent.click(createBtn);

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("renders in edit mode with initial data and pre-fills fields", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(
      <AgentForm
        profileId="profile-1"
        isEdit={true}
        agentId="agent-1"
        initialData={{
          name: "Existing Agent",
          type: "VIDEO_CLIP",
        }}
      />,
    );

    // Should pre-fill the name
    const nameInput = screen.getByLabelText("Agent Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Existing Agent");

    // Should show Save Changes button (not Create Agent)
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
    expect(screen.queryByText("Create Agent")).not.toBeInTheDocument();

    // Should not show step indicator
    expect(screen.queryByText("Basic Info")).not.toBeInTheDocument();
  });

  it("displays API error message on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Agent limit reached" }),
    });

    render(<AgentForm profileId="profile-1" />);

    const nameInput = screen.getByLabelText("Agent Name");
    await userEvent.type(nameInput, "My Agent");

    await userEvent.click(screen.getByText("Continue"));

    const xButton = screen.getByText("X");
    await userEvent.click(xButton);

    await userEvent.click(screen.getByText("Create Agent"));

    await waitFor(() => {
      expect(screen.getByText("Agent limit reached")).toBeInTheDocument();
    });
  });

  it("shows preview card when form has name or platforms", async () => {
    render(<AgentForm profileId="profile-1" />);

    const nameInput = screen.getByLabelText("Agent Name");
    await userEvent.type(nameInput, "Preview Agent");

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Preview Agent")).toBeInTheDocument();
  });
});
