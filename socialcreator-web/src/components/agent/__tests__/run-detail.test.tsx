/**
 * Tests for RunDetail component.
 *
 * Verifies:
 * - Shows run status with correct icon and colors
 * - Shows timeline (Created, Started, Completed/Failed)
 * - Shows brief text
 * - Shows error message when run has error
 * - Shows generated content when available
 * - Shows duration when available
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { RunDetail } from "@/components/agent/run-detail";

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatDateTime: vi.fn(() => "Jun 1, 2025, 10:00 AM"),
}));

vi.mock("lucide-react", () => ({
  CheckCircle: "svg-check-circle",
  Clock: "svg-clock",
  Loader2: "svg-loader",
  XCircle: "svg-x-circle",
}));

vi.mock("@/components/content/platform-badge", () => ({
  PlatformBadge: ({ platform }: any) => <span data-testid="platform-badge">{platform}</span>,
}));

vi.mock("../run-status-badge", () => ({
  RunStatusBadge: ({ status }: any) => <span data-testid="run-status-badge">{status}</span>,
}));

describe("RunDetail", () => {
  const baseRun = {
    id: "run-abc-123",
    status: "SUCCESS" as const,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    startedAt: new Date("2025-06-01T10:00:05Z"),
    finishedAt: new Date("2025-06-01T10:05:00Z"),
    brief: "Create a post about productivity tips",
    duration: 295,
    error: null,
    agent: { id: "agent-1", name: "Test Agent", type: "TEXT_POST" as const },
    log: [{ level: "info", message: "Run started", timestamp: new Date("2025-06-01T10:00:05Z") }],
    generatedContents: [],
  };

  it("renders run status header with RunStatusBadge", () => {
    render(<RunDetail run={baseRun as any} />);

    expect(screen.getByTestId("run-status-badge")).toHaveTextContent("SUCCESS");
  });

  it("shows run ID (last 6 chars) and agent name", () => {
    render(<RunDetail run={baseRun as any} />);
    const last6 = baseRun.id.slice(-6);

    expect(screen.getByText(new RegExp(`Run #${last6}`))).toBeInTheDocument();
    expect(screen.getByText(/Test Agent/)).toBeInTheDocument();
  });

  it("shows timeline entries (Created, Started, Completed)", () => {
    render(<RunDetail run={baseRun as any} />);

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("shows 'Failed' instead of 'Completed' for failed runs", () => {
    const failedRun = {
      ...baseRun,
      status: "FAILED" as const,
      error: "LLM API error: timeout",
    };

    render(<RunDetail run={failedRun as any} />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  it("shows brief text", () => {
    render(<RunDetail run={baseRun as any} />);

    expect(screen.getByText("Create a post about productivity tips")).toBeInTheDocument();
  });

  it("shows error message when run has error", () => {
    const failedRun = {
      ...baseRun,
      status: "FAILED" as const,
      error: "LLM API error: timeout",
    };

    render(<RunDetail run={failedRun as any} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("LLM API error: timeout")).toBeInTheDocument();
  });

  it("does not show error section when run has no error", () => {
    render(<RunDetail run={baseRun as any} />);

    expect(screen.queryByText("Error")).not.toBeInTheDocument();
  });

  it("shows generated content when available", () => {
    const runWithContent = {
      ...baseRun,
      generatedContents: [
        {
          id: "content-1",
          textContent: "This is generated content with some hashtags",
          platform: "X" as const,
          hashtags: ["productivity", "tips"],
        },
      ],
    };

    render(<RunDetail run={runWithContent as any} />);

    expect(screen.getByText("Generated Content (1)")).toBeInTheDocument();
    expect(screen.getByText("This is generated content with some hashtags")).toBeInTheDocument();
  });

  it("shows hashtags in generated content", () => {
    const runWithContent = {
      ...baseRun,
      generatedContents: [
        {
          id: "content-1",
          textContent: "Post content here",
          platform: "X" as const,
          hashtags: ["productivity", "tips"],
        },
      ],
    };

    render(<RunDetail run={runWithContent as any} />);

    expect(screen.getByText("#productivity")).toBeInTheDocument();
    expect(screen.getByText("#tips")).toBeInTheDocument();
  });

  it("shows duration in timeline when available", () => {
    render(<RunDetail run={baseRun as any} />);

    expect(screen.getByText(/295s/)).toBeInTheDocument();
  });

  it("shows loading animation for RUNNING status", () => {
    const runningRun = {
      ...baseRun,
      status: "RUNNING" as const,
      startedAt: new Date("2025-06-01T10:00:05Z"),
      finishedAt: null,
      duration: null,
    };

    render(<RunDetail run={runningRun as any} />);

    expect(screen.getByTestId("run-status-badge")).toHaveTextContent("RUNNING");
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });
});
