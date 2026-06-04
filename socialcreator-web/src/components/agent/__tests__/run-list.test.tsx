/**
 * Tests for RunList component.
 *
 * Verifies:
 * - Shows empty state when no runs
 * - Renders table with run entries
 * - Shows status badges per run
 * - Shows brief text with link to detail
 * - Shows error text for failed runs
 * - Shows duration for completed runs
 * - Shows pagination controls when provided
 * - Shows rerun button for failed runs
 * - Shows view details button for each run
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { RunList } from "@/components/agent/run-list";

vi.mock("@socialcreator/utils", () => ({
  formatDateTime: vi.fn(() => "Jun 1, 2025"),
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: "svg-chevron-left",
  ChevronRight: "svg-chevron-right",
  Eye: "svg-eye",
  RefreshCw: "svg-refresh-cw",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../run-status-badge", () => ({
  RunStatusBadge: ({ status }: any) => <span data-testid="run-status-badge">{status}</span>,
}));

describe("RunList", () => {
  const baseRun = {
    id: "run-1",
    status: "SUCCESS" as const,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    startedAt: new Date("2025-06-01T10:00:05Z"),
    finishedAt: new Date("2025-06-01T10:05:00Z"),
    brief: "Create a post about productivity",
    error: null,
    _count: { generatedContents: 3 },
    generatedContents: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
  };

  it("shows empty state when runs array is empty", () => {
    render(<RunList runs={[]} agentId="agent-1" profileId="profile-1" />);

    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    expect(
      screen.getByText("Run the agent to generate content for your platforms."),
    ).toBeInTheDocument();
  });

  it("renders table with column headers", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Contents")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders run entry with status badge", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    const badges = screen.getAllByTestId("run-status-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("SUCCESS");
  });

  it("renders brief text as a link to run detail", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    const briefLink = screen.getByText("Create a post about productivity");
    expect(briefLink).toBeInTheDocument();
    expect(briefLink.closest("a")).toHaveAttribute(
      "href",
      "/profiles/profile-1/agents/agent-1/runs/run-1",
    );
  });

  it("shows error text for failed runs", () => {
    const failedRun = {
      ...baseRun,
      status: "FAILED" as const,
      error: "API timeout",
    };

    render(<RunList runs={[failedRun] as any} agentId="agent-1" profileId="profile-1" />);

    expect(screen.getByText("API timeout")).toBeInTheDocument();
  });

  it("shows content count", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows duration in seconds when available", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    // Duration = (finishedAt - startedAt) / 1000 = 295s
    expect(screen.getByText("295s")).toBeInTheDocument();
  });

  it("shows view details button for each run", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    const viewLink = screen.getByTitle("View details");
    expect(viewLink).toBeInTheDocument();
    expect(viewLink.closest("a")).toHaveAttribute(
      "href",
      "/profiles/profile-1/agents/agent-1/runs/run-1",
    );
  });

  it("shows rerun button for failed runs", () => {
    const failedRun = {
      ...baseRun,
      status: "FAILED" as const,
      error: "API timeout",
    };

    const onRerun = vi.fn();
    render(
      <RunList
        runs={[failedRun] as any}
        agentId="agent-1"
        profileId="profile-1"
        onRerun={onRerun}
      />,
    );

    const rerunBtn = screen.getByTitle("Rerun");
    expect(rerunBtn).toBeInTheDocument();
  });

  it("calls onRerun when rerun button is clicked", async () => {
    const failedRun = {
      ...baseRun,
      status: "FAILED" as const,
      error: "API timeout",
    };

    const onRerun = vi.fn();
    render(
      <RunList
        runs={[failedRun] as any}
        agentId="agent-1"
        profileId="profile-1"
        onRerun={onRerun}
      />,
    );

    const rerunBtn = screen.getByTitle("Rerun");
    await userEvent.click(rerunBtn);

    expect(onRerun).toHaveBeenCalledWith("run-1");
  });

  it("does not show rerun button for successful runs", () => {
    render(<RunList runs={[baseRun] as any} agentId="agent-1" profileId="profile-1" />);

    expect(screen.queryByTitle("Rerun")).not.toBeInTheDocument();
  });

  it("shows pagination when provided with more than 1 page", () => {
    const pagination = {
      page: 1,
      totalPages: 3,
      onPageChange: vi.fn(),
    };

    render(
      <RunList
        runs={[baseRun] as any}
        agentId="agent-1"
        profileId="profile-1"
        pagination={pagination}
      />,
    );

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
  });

  it("calls onPageChange when pagination buttons are clicked", async () => {
    const onPageChange = vi.fn();
    const pagination = {
      page: 2,
      totalPages: 3,
      onPageChange,
    };

    render(
      <RunList
        runs={[baseRun] as any}
        agentId="agent-1"
        profileId="profile-1"
        pagination={pagination}
      />,
    );

    const prevBtn = document.querySelectorAll("button")[0];
    const nextBtn = document.querySelectorAll("button")[1];

    await userEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    await userEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables prev button on first page", () => {
    const pagination = {
      page: 1,
      totalPages: 3,
      onPageChange: vi.fn(),
    };

    render(
      <RunList
        runs={[baseRun] as any}
        agentId="agent-1"
        profileId="profile-1"
        pagination={pagination}
      />,
    );

    const buttons = document.querySelectorAll("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("disables next button on last page", () => {
    const pagination = {
      page: 3,
      totalPages: 3,
      onPageChange: vi.fn(),
    };

    render(
      <RunList
        runs={[baseRun] as any}
        agentId="agent-1"
        profileId="profile-1"
        pagination={pagination}
      />,
    );

    const buttons = document.querySelectorAll("button");
    expect(buttons[1]).toBeDisabled();
  });
});
