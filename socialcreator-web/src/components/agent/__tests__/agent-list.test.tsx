/**
 * Tests for AgentList component.
 *
 * Verifies:
 * - Renders list of AgentCard components
 * - Shows empty state when agents array is empty
 * - Shows create button in empty state when profileId provided
 * - Does not show create button in empty state without profileId
 * - Passes onDelete and onEdit to AgentCard
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { AgentList } from "@/components/agent/agent-list";

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

vi.mock("lucide-react", () => ({
  Bot: "svg-bot",
  Plus: "svg-plus",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/agent/agent-card", () => ({
  AgentCard: ({ agent, onDelete, onEdit }: any) => (
    <div data-testid="agent-card">
      <span data-testid="agent-name">{agent.name}</span>
      <button data-testid="mock-edit" onClick={() => onEdit?.(agent.id)}>
        Edit
      </button>
      <button data-testid="mock-delete" onClick={() => onDelete?.(agent.id)}>
        Delete
      </button>
    </div>
  ),
}));

describe("AgentList", () => {
  it("renders list of AgentCard components", () => {
    const agents = [mockAgent, { ...mockAgent, id: "agent-2", name: "Agent 2" }];

    render(<AgentList agents={agents as any} />);

    const cards = screen.getAllByTestId("agent-card");
    expect(cards).toHaveLength(2);

    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.getByText("Agent 2")).toBeInTheDocument();
  });

  it("shows empty state when agents array is empty", () => {
    render(<AgentList agents={[]} />);

    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Create your first AI agent to start generating content/),
    ).toBeInTheDocument();
  });

  it("shows create button in empty state when profileId provided", () => {
    render(<AgentList agents={[]} profileId="profile-1" />);

    const createLink = screen.getByText("Create Agent");
    expect(createLink).toBeInTheDocument();
    expect(createLink.closest("a")).toHaveAttribute("href", "/profiles/profile-1/agents/new");
  });

  it("does not show create button in empty state without profileId", () => {
    render(<AgentList agents={[]} />);

    expect(screen.queryByText("Create Agent")).not.toBeInTheDocument();
  });

  it("passes onDelete to AgentCard", () => {
    const onDelete = vi.fn();
    render(<AgentList agents={[mockAgent] as any} onDelete={onDelete} />);

    const deleteBtn = screen.getByTestId("mock-delete");
    deleteBtn.click();

    expect(onDelete).toHaveBeenCalledWith("agent-1");
  });

  it("passes onEdit to AgentCard", () => {
    const onEdit = vi.fn();
    render(<AgentList agents={[mockAgent] as any} onEdit={onEdit} />);

    const editBtn = screen.getByTestId("mock-edit");
    editBtn.click();

    expect(onEdit).toHaveBeenCalledWith("agent-1");
  });
});
