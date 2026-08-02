/**
 * Tests for AgentsClient component.
 *
 * Verifies:
 * - Renders page header with agent counts
 * - Shows agents list via AgentList
 * - Shows loading spinner initially
 * - Shows empty state via AgentList
 * - Handles delete action
 * - Handles edit action (navigation)
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { AgentsClient } from "@/components/agent/agents-client";

const mockFetch = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

const mockAgent = {
  id: "agent-1",
  name: "Test Agent",
  type: "TEXT_POST",
  isActive: true,
  platform: "X",
  platforms: ["X"],
  _count: { runs: 5 },
  profile: { id: "profile-1", name: "Main Profile" },
  runs: [],
  stats: { totalRuns: 5, successRate: 80 },
};

vi.mock("lucide-react", () => ({
  Plus: "svg-plus",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    refresh: mockRefresh,
  })),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: any) => (
    <nav data-testid="breadcrumb">
      {items.map((item: any, i: number) => (
        <span key={i}>{item.label}</span>
      ))}
    </nav>
  ),
}));

vi.mock("@/components/layout/page-header", () => ({
  PageHeader: ({ title, description, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </div>
  ),
}));

vi.mock("@/components/agent/agent-list", () => ({
  AgentList: ({ agents, onDelete, onEdit }: any) => (
    <div data-testid="agent-list">
      {agents.length === 0 ? (
        <div data-testid="empty-state">Empty state</div>
      ) : (
        agents.map((a: any) => (
          <div key={a.id} data-testid="agent-item">
            <span>{a.name}</span>
            <button data-testid="delete-btn" onClick={() => onDelete(a.id)}>
              Delete
            </button>
            <button data-testid="edit-btn" onClick={() => onEdit(a.id)}>
              Edit
            </button>
          </div>
        ))
      )}
    </div>
  ),
}));

describe("AgentsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("renders page header with agent counts", () => {
    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    expect(screen.getByText("AI Agents")).toBeInTheDocument();
    expect(screen.getByText("1 agent · 1 active")).toBeInTheDocument();
  });

  it("renders breadcrumb", () => {
    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Profiles")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders agents list when not loading", () => {
    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    expect(screen.getByTestId("agent-list")).toBeInTheDocument();
    expect(screen.getByTestId("agent-item")).toBeInTheDocument();
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("shows empty state via AgentList when no agents", () => {
    render(<AgentsClient profileId="profile-1" initialAgents={[]} />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("shows New Agent link with correct href", () => {
    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    const newAgentLink = screen.getByText("New Agent");
    expect(newAgentLink.closest("a")).toHaveAttribute("href", "/profiles/profile-1/agents/new");
  });

  it("handles delete action - makes API call and removes agent", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    const deleteBtn = screen.getByTestId("delete-btn");
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/agents/agent-1", {
        method: "DELETE",
      });
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it("handles edit action - navigates to edit page", async () => {
    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    const editBtn = screen.getByTestId("edit-btn");
    await userEvent.click(editBtn);

    expect(mockPush).toHaveBeenCalledWith("/profiles/profile-1/agents/agent-1");
  });

  it("logs error when delete fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<AgentsClient profileId="profile-1" initialAgents={[mockAgent] as any} />);

    const deleteBtn = screen.getByTestId("delete-btn");
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith("Error deleting agent", expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it("calculates agent count with correct pluralization", () => {
    const agents = [mockAgent, { ...mockAgent, id: "agent-2", name: "Agent 2", isActive: false }];

    render(<AgentsClient profileId="profile-1" initialAgents={agents as any} />);

    expect(screen.getByText("2 agents · 1 active")).toBeInTheDocument();
  });
});
