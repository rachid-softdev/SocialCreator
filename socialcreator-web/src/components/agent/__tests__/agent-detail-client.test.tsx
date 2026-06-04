/**
 * Tests for AgentDetailClient component.
 *
 * Verifies:
 * - Shows agent details (name, type, status badge)
 * - Shows configuration card with platforms, schedule, etc.
 * - Shows statistics card
 * - Tab switching (overview, runs, content)
 * - Run Agent button triggers modal
 * - Toggle active/inactive state
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { AgentDetailClient } from "@/components/agent/agent-detail-client";

const mockFetch = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

const mockAgent = {
  id: "agent-1",
  name: "Test Agent",
  type: "TEXT_POST",
  isActive: true,
  platform: "X",
  platforms: ["X", "LINKEDIN"],
  scheduleCron: "0 9 * * *",
  maxPerDay: 3,
  autoPublish: true,
  _count: { runs: 5 },
  stats: { totalRuns: 42, successRate: 95 },
  runs: [{ id: "run-1", status: "SUCCESS", createdAt: new Date(), completedAt: new Date() }],
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
}));

vi.mock("lucide-react", () => {
  const icons = new Set([
    "Bot",
    "FileText",
    "Play",
    "RefreshCw",
    "Settings",
    "X",
    "Send",
    "CheckCircle",
    "Clock",
    "Loader2",
    "XCircle",
    "Plus",
  ]);
  const mod: Record<string, string> = {};
  for (const icon of icons) {
    mod[icon] = `svg-${icon.toLowerCase()}`;
  }
  return mod;
});

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    refresh: mockRefresh,
  })),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/components/agent/run-list", () => ({
  RunList: ({ runs, onRerun }: any) => (
    <div data-testid="run-list">
      {runs.length === 0 ? (
        <span data-testid="no-runs">No runs</span>
      ) : (
        runs.map((r: any) => (
          <div key={r.id} data-testid="run-item">
            <span>{r.status}</span>
          </div>
        ))
      )}
      {onRerun && <button data-testid="rerun-btn">Rerun</button>}
    </div>
  ),
}));

vi.mock("@/components/content/content-list", () => ({
  ContentList: ({ contents }: any) => (
    <div data-testid="content-list">
      <span>Content: {contents?.length || 0} items</span>
    </div>
  ),
}));

vi.mock("@/components/content/platform-badge", () => ({
  PlatformBadge: ({ platform }: any) => <span data-testid="platform-badge">{platform}</span>,
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

vi.mock("../agent-run-modal", () => ({
  AgentRunModal: ({ isOpen, onClose, agentName, onSuccess }: any) =>
    isOpen ? (
      <div data-testid="run-modal">
        <span>{agentName}</span>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="modal-success"
          onClick={() => {
            onSuccess?.();
            onClose();
          }}
        >
          Complete Run
        </button>
      </div>
    ) : null,
}));

describe("AgentDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("renders agent name and type label", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Test Agent");
    expect(screen.getByText("Text Post")).toBeInTheDocument();
  });

  it("shows Active status badge by default", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Paused status badge when agent is inactive", () => {
    const inactiveAgent = { ...mockAgent, isActive: false };
    render(<AgentDetailClient agent={inactiveAgent as any} profileId="profile-1" />);

    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Profiles")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders configuration card with platform badges", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByText("Configuration")).toBeInTheDocument();
    const badges = screen.getAllByTestId("platform-badge");
    expect(badges).toHaveLength(2);
  });

  it("shows schedule info in configuration", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByText("0 9 * * *")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // maxPerDay
    expect(screen.getByText("Enabled")).toBeInTheDocument(); // autoPublish
  });

  it("shows 'Manual runs only' when no cron schedule", () => {
    const agentNoSchedule = { ...mockAgent, scheduleCron: null };
    render(<AgentDetailClient agent={agentNoSchedule as any} profileId="profile-1" />);

    expect(screen.getByText("Manual runs only")).toBeInTheDocument();
  });

  it("renders statistics card with total runs and success rate", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByText("Statistics")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("renders tabs: Overview, Runs, Content", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("shows run count badge next to Runs tab", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    const tabs = screen.getAllByText("5");
    expect(tabs.length).toBeGreaterThanOrEqual(1);
  });

  it("switches to runs tab when clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: [], page: 1, totalPages: 1 }),
    });

    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    await userEvent.click(screen.getByText("Runs"));

    expect(screen.getByTestId("run-list")).toBeInTheDocument();
  });

  it("switches to content tab when clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contents: [] }),
    });

    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    await userEvent.click(screen.getByText("Content"));

    expect(screen.getByTestId("content-list")).toBeInTheDocument();
  });

  it("shows Run Agent button", () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    expect(screen.getByText("Run Agent")).toBeInTheDocument();
  });

  it("opens run modal when Run Agent is clicked", async () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    await userEvent.click(screen.getByText("Run Agent"));

    expect(screen.getByTestId("run-modal")).toBeInTheDocument();
  });

  it("closes run modal when onClose is triggered", async () => {
    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    await userEvent.click(screen.getByText("Run Agent"));
    expect(screen.getByTestId("run-modal")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("modal-close"));
    expect(screen.queryByTestId("run-modal")).not.toBeInTheDocument();
  });

  it("toggles agent active state", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    render(<AgentDetailClient agent={mockAgent as any} profileId="profile-1" />);

    // Find the toggle button (the first button with role switch or clickable div)
    const toggleButtons = document.querySelectorAll("button.relative");
    const toggleBtn = Array.from(toggleButtons).find(
      (btn) => btn.className.includes("rounded-full") && btn.className.includes("w-12"),
    );

    expect(toggleBtn).not.toBeNull();

    await userEvent.click(toggleBtn!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/agents/agent-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
    });
  });

  it("disables Run Agent button when agent is inactive", () => {
    const inactiveAgent = { ...mockAgent, isActive: false };
    render(<AgentDetailClient agent={inactiveAgent as any} profileId="profile-1" />);

    const runBtn = screen.getByText("Run Agent");
    expect(runBtn.closest("button")).toBeDisabled();
  });
});
