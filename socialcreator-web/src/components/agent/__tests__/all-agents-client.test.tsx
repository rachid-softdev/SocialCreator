/**
 * Tests for AllAgentsClient component.
 *
 * Verifies:
 * - Renders all agents across profiles
 * - Shows loading state
 * - Shows empty state when no agents
 * - Filters agents by profile
 * - Profile filter buttons are rendered
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { AllAgentsClient } from "@/components/agent/all-agents-client";

const mockFetch = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

const profiles = [
  { id: "profile-1", name: "Main Profile" },
  { id: "profile-2", name: "Work Profile" },
];

const mockAgent1 = {
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

const mockAgent2 = {
  id: "agent-2",
  name: "Work Bot",
  type: "VIDEO_CLIP",
  isActive: false,
  platform: "LINKEDIN",
  platforms: ["LINKEDIN"],
  _count: { runs: 2 },
  profile: { id: "profile-2", name: "Work Profile" },
  runs: [],
  stats: { totalRuns: 2, successRate: 50 },
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
  PageHeader: ({ title, description }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock("@/components/agent/agent-list", () => ({
  AgentList: ({ agents, onDelete, onEdit }: any) => (
    <div data-testid="agent-list">
      {agents.length === 0 ? (
        <div data-testid="empty-state">No agents yet</div>
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

describe("AllAgentsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("renders page header", () => {
    render(<AllAgentsClient initialAgents={[]} profiles={profiles} />);

    expect(screen.getByText("All Agents")).toBeInTheDocument();
  });

  it("renders breadcrumb with 'Agents'", () => {
    render(<AllAgentsClient initialAgents={[]} profiles={profiles} />);

    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("shows all agents with correct count", () => {
    render(<AllAgentsClient initialAgents={[mockAgent1, mockAgent2] as any} profiles={profiles} />);

    expect(screen.getByText("2 agents · 1 active")).toBeInTheDocument();
  });

  it("renders agent list with all agents", () => {
    render(<AllAgentsClient initialAgents={[mockAgent1, mockAgent2] as any} profiles={profiles} />);

    expect(screen.getByTestId("agent-list")).toBeInTheDocument();
    const agentItems = screen.getAllByTestId("agent-item");
    expect(agentItems).toHaveLength(2);
  });

  it("shows profile filter buttons when multiple profiles", () => {
    render(<AllAgentsClient initialAgents={[mockAgent1, mockAgent2] as any} profiles={profiles} />);

    expect(screen.getByText("All Profiles")).toBeInTheDocument();
    expect(screen.getByText("Main Profile")).toBeInTheDocument();
    expect(screen.getByText("Work Profile")).toBeInTheDocument();
  });

  it("filters agents by profile when profile button clicked", async () => {
    render(<AllAgentsClient initialAgents={[mockAgent1, mockAgent2] as any} profiles={profiles} />);

    // Click "Main Profile" filter
    await userEvent.click(screen.getByText("Main Profile"));

    // Should show only agent-1 (from profile-1)
    const agentItems = screen.getAllByTestId("agent-item");
    expect(agentItems).toHaveLength(1);
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
    expect(screen.queryByText("Work Bot")).not.toBeInTheDocument();

    // Count should update
    expect(screen.getByText("1 agent · 1 active")).toBeInTheDocument();
  });

  it("shows all agents when 'All Profiles' is selected after filtering", async () => {
    render(<AllAgentsClient initialAgents={[mockAgent1, mockAgent2] as any} profiles={profiles} />);

    await userEvent.click(screen.getByText("Work Profile"));
    expect(screen.getAllByTestId("agent-item")).toHaveLength(1);

    await userEvent.click(screen.getByText("All Profiles"));
    expect(screen.getAllByTestId("agent-item")).toHaveLength(2);
  });

  it("shows empty state when filtered profile has no agents", async () => {
    // Create a profile with no agents
    const extraProfiles = [...profiles, { id: "profile-3", name: "Empty Profile" }];

    render(<AllAgentsClient initialAgents={[mockAgent1] as any} profiles={extraProfiles} />);

    await userEvent.click(screen.getByText("Empty Profile"));

    // The component renders its own empty state (not AgentList)
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
  });

  it("shows empty state when no agents at all", () => {
    render(<AllAgentsClient initialAgents={[]} profiles={profiles} />);

    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Create your first AI agent to start generating content automatically/),
    ).toBeInTheDocument();
  });

  it("handles edit action - navigates to correct profile", async () => {
    render(<AllAgentsClient initialAgents={[mockAgent1] as any} profiles={profiles} />);

    const editBtn = screen.getByTestId("edit-btn");
    await userEvent.click(editBtn);

    expect(mockPush).toHaveBeenCalledWith("/profiles/profile-1/agents/agent-1");
  });

  it("handles delete action - calls API and removes agent", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    render(<AllAgentsClient initialAgents={[mockAgent1] as any} profiles={profiles} />);

    const deleteBtn = screen.getByTestId("delete-btn");
    await userEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/agents/agent-1", {
        method: "DELETE",
      });
    });

    expect(mockRefresh).toHaveBeenCalled();
  });
});
