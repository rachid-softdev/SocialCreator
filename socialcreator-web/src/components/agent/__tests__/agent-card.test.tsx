/**
 * Tests for AgentCard component.
 *
 * Verifies:
 * - Renders agent name, type label, platform badges, stats
 * - Shows "Paused" badge when agent.isActive is false
 * - Dropdown menu with Edit and Delete options
 * - Clicking Edit calls onEdit
 * - Delete shows confirm dialog
 * - Shows last run info with RunStatusBadge
 * - Link wraps card to agent detail page
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { AgentCard } from "@/components/agent/agent-card";

const mockAgent = {
  id: "agent-1",
  name: "Test Agent",
  type: "TEXT_POST" as const,
  isActive: true,
  platform: "X",
  platforms: ["X", "LINKEDIN"],
  stats: { totalRuns: 42, successRate: 95 },
  runs: [
    {
      id: "run-1",
      status: "SUCCESS" as const,
      createdAt: new Date("2025-06-01T10:00:00Z"),
      completedAt: new Date("2025-06-01T10:05:00Z"),
    },
  ],
  profile: { id: "profile-1", name: "Main Profile" },
};

vi.mock("@socialcreator/types/agent", () => ({
  AGENT_TYPE_LABELS: {
    TEXT_POST: "Text Post",
    VIDEO_CLIP: "Video Clip",
    CROSS_POST: "Cross Post",
  },
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatDateTime: vi.fn(() => "Jun 1, 2025, 10:00 AM"),
}));

vi.mock("lucide-react", () => ({
  Bot: "svg-bot",
  MoreVertical: "svg-more-vertical",
  Pencil: "svg-pencil",
  Trash2: "svg-trash",
  X: "svg-x",
}));

vi.mock("@/components/admin/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm, description, confirmLabel }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{description}</p>
        <button type="button" data-testid="confirm-btn" onClick={onConfirm}>
          {confirmLabel || "Confirm"}
        </button>
        <button type="button" data-testid="cancel-btn" onClick={() => {}}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/content/platform-badge", () => ({
  PlatformBadge: ({ platform }: any) => <span data-testid="platform-badge">{platform}</span>,
}));

vi.mock("../run-status-badge", () => ({
  RunStatusBadge: ({ status }: any) => <span data-testid="run-status-badge">{status}</span>,
}));

describe("AgentCard", () => {
  it("renders agent name and type label", () => {
    render(<AgentCard agent={mockAgent as any} />);

    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.getByText("Text Post")).toBeInTheDocument();
  });

  it("renders platform badges", () => {
    render(<AgentCard agent={mockAgent as any} />);

    const badges = screen.getAllByTestId("platform-badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent("X");
    expect(badges[1]).toHaveTextContent("LINKEDIN");
  });

  it("renders stats (total runs and success rate)", () => {
    render(<AgentCard agent={mockAgent as any} />);

    expect(screen.getByText("Total Runs")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("shows Paused badge when agent is not active", () => {
    const inactiveAgent = { ...mockAgent, isActive: false };
    render(<AgentCard agent={inactiveAgent as any} />);

    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("does not show Paused badge when agent is active", () => {
    render(<AgentCard agent={mockAgent as any} />);

    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });

  it("shows last run info with RunStatusBadge", () => {
    render(<AgentCard agent={mockAgent as any} />);

    expect(screen.getByText("Last run")).toBeInTheDocument();
    expect(screen.getByText("Jun 1, 2025, 10:00 AM")).toBeInTheDocument();
    expect(screen.getByTestId("run-status-badge")).toHaveTextContent("SUCCESS");
  });

  it("does not show last run section when agent has no runs", () => {
    const agentNoRuns = { ...mockAgent, runs: [] };
    render(<AgentCard agent={agentNoRuns as any} />);

    expect(screen.queryByText("Last run")).not.toBeInTheDocument();
  });

  it("wraps card in a link to agent detail page", () => {
    render(<AgentCard agent={mockAgent as any} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/profiles/profile-1/agents/agent-1");
  });

  it("shows dropdown menu with Edit and Delete options on MoreVertical click", async () => {
    render(<AgentCard agent={mockAgent as any} />);

    // No dropdown visible initially
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();

    // Click the more button to open dropdown
    const moreButton = screen.getAllByRole("button")[0];
    await userEvent.click(moreButton);

    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onEdit when Edit is clicked", async () => {
    const onEdit = vi.fn();
    render(<AgentCard agent={mockAgent as any} onEdit={onEdit} />);

    const moreButton = screen.getAllByRole("button")[0];
    await userEvent.click(moreButton);

    const editButton = screen.getByText("Edit");
    await userEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith("agent-1");
  });

  it("calls onDelete with confirm when Delete is clicked", async () => {
    const onDelete = vi.fn();

    render(<AgentCard agent={mockAgent as any} onDelete={onDelete} />);

    const moreButton = screen.getAllByRole("button")[0];
    await userEvent.click(moreButton);

    const deleteButton = screen.getByText("Delete");
    await userEvent.click(deleteButton);

    // ConfirmDialog should appear
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    // Click confirm in the dialog
    await userEvent.click(screen.getByTestId("confirm-btn"));
    expect(onDelete).toHaveBeenCalledWith("agent-1");
  });

  it("does not call onDelete when confirm is canceled", async () => {
    const onDelete = vi.fn();

    render(<AgentCard agent={mockAgent as any} onDelete={onDelete} />);

    const moreButton = screen.getAllByRole("button")[0];
    await userEvent.click(moreButton);

    const deleteButton = screen.getByText("Delete");
    await userEvent.click(deleteButton);

    // ConfirmDialog should appear
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    // Click cancel in the dialog
    await userEvent.click(screen.getByTestId("cancel-btn"));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
