/**
 * Tests for AgentRunModal component.
 *
 * Verifies:
 * - Modal UI with backdrop and form
 * - Confirm run submits brief and calls API
 * - Validates brief length (min 10 characters)
 * - Error handling displays API errors
 * - onSuccess callback is called after successful run
 * - onClose is called when cancelling
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { AgentRunModal } from "@/components/agent/agent-run-modal";

const mockFetch = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("lucide-react", () => ({
  Loader2: "svg-loader",
  Send: "svg-send",
  X: "svg-x",
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    refresh: mockRefresh,
  })),
}));

describe("AgentRunModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("returns null when isOpen is false", () => {
    const { container } = render(
      <AgentRunModal isOpen={false} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders modal with title and agent name when isOpen is true", () => {
    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    expect(screen.getByText("Run Agent")).toBeInTheDocument();
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("renders textarea for content brief", () => {
    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    expect(screen.getByLabelText(/Content Brief/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\., Create a motivational post/)).toBeInTheDocument();
  });

  it("renders Cancel and Start Run buttons", () => {
    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Start Run")).toBeInTheDocument();
  });

  it("shows character count feedback", async () => {
    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    expect(screen.getByText(/10 more characters needed/)).toBeInTheDocument();

    const textarea = screen.getByLabelText(/Content Brief/);
    await userEvent.type(textarea, "This is my content brief for testing");

    expect(screen.getByText("Ready to generate")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(
      <AgentRunModal isOpen={true} onClose={onClose} agentId="agent-1" agentName="Test Agent" />,
    );

    await userEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <AgentRunModal isOpen={true} onClose={onClose} agentId="agent-1" agentName="Test Agent" />,
    );

    const backdrop = screen.getByLabelText("Close");
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Start Run button when brief is too short", async () => {
    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    const startBtn = screen.getByText("Start Run");
    expect(startBtn).toBeDisabled();

    const textarea = screen.getByLabelText(/Content Brief/);
    await userEvent.type(textarea, "Short");

    // Still disabled because brief is less than 10 chars
    expect(startBtn).toBeDisabled();
  });

  it("submits brief and calls API when Start Run is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "run-1" }),
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <AgentRunModal
        isOpen={true}
        onClose={onClose}
        agentId="agent-1"
        agentName="Test Agent"
        onSuccess={onSuccess}
      />,
    );

    const textarea = screen.getByLabelText(/Content Brief/);
    await userEvent.type(textarea, "This is a valid brief for testing");

    await userEvent.click(screen.getByText("Start Run"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/agents/agent-1/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: "This is a valid brief for testing" }),
      });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("displays API error message on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Agent is paused" }),
    });

    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    const textarea = screen.getByLabelText(/Content Brief/);
    await userEvent.type(textarea, "This is a valid brief for testing");

    await userEvent.click(screen.getByText("Start Run"));

    await waitFor(() => {
      expect(screen.getByText("Agent is paused")).toBeInTheDocument();
    });
  });

  it("shows loading state while submitting", async () => {
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 1000),
        ),
    );

    render(
      <AgentRunModal isOpen={true} onClose={vi.fn()} agentId="agent-1" agentName="Test Agent" />,
    );

    const textarea = screen.getByLabelText(/Content Brief/);
    await userEvent.type(textarea, "This is a valid brief for testing");

    await userEvent.click(screen.getByText("Start Run"));

    expect(screen.getByText("Starting...")).toBeInTheDocument();
    expect(screen.queryByText("Start Run")).not.toBeInTheDocument();
  });
});
