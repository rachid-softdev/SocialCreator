/**
 * Tests for QueueDashboard component
 *
 * Verifies:
 * - Renders STAT_CARDS with status counts
 * - Renders header with title
 * - Auto-refresh checkbox and toggle
 * - Refresh button with loading indicator
 * - Job list table with status/priority badges
 * - Retry button for failed jobs
 * - Error state display
 * - Loading state
 * - Empty jobs state
 * - Error jobs section with retry
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { QueueDashboard } from "../queue-dashboard";

// ── Hoisted factories ─────────────────────────────────────────────────

const mockStore = vi.hoisted(() => ({
  status: null,
  jobs: [],
  isLoading: false,
  error: null,
  autoRefresh: true,
  fetchStatus: vi.fn(),
  fetchJobs: vi.fn(),
  retryJob: vi.fn(),
  setAutoRefresh: vi.fn(),
}));

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: ({ className }: any) => (
    <span data-testid="icon-alert" className={className}>
      svg-alert
    </span>
  ),
  CheckCircle2: ({ className }: any) => (
    <span data-testid="icon-check" className={className}>
      svg-check
    </span>
  ),
  Clock: ({ className }: any) => (
    <span data-testid="icon-clock" className={className}>
      svg-clock
    </span>
  ),
  Loader2: ({ className }: any) => (
    <span data-testid="icon-loader" className={className}>
      svg-loader
    </span>
  ),
  Play: ({ className }: any) => (
    <span data-testid="icon-play" className={className}>
      svg-play
    </span>
  ),
  RefreshCw: ({ className }: any) => (
    <span data-testid="icon-refresh" className={className}>
      svg-refresh
    </span>
  ),
}));

vi.mock("@/lib/stores/queue-store", () => ({
  useQueueStore: (selector?: (state: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

// ── Fixtures ──────────────────────────────────────────────────────────

const mockStatus = {
  queued: 5,
  running: 2,
  completed: 45,
  failed: 3,
  total: 55,
};

const mockJobs = [
  {
    id: "job-001-xxxxxxxx",
    type: "publish",
    status: "completed" as const,
    priority: "normal",
    attempts: 1,
    maxAttempts: 3,
    createdAt: Date.now() - 3600000,
    completedAt: Date.now() - 1800000,
  },
  {
    id: "job-002-yyyyyyyy",
    type: "generate",
    status: "running" as const,
    priority: "high",
    attempts: 1,
    maxAttempts: 3,
    createdAt: Date.now() - 600000,
  },
  {
    id: "job-003-zzzzzzzz",
    type: "publish",
    status: "failed" as const,
    priority: "critical",
    attempts: 2,
    maxAttempts: 3,
    createdAt: Date.now() - 7200000,
    completedAt: Date.now() - 3600000,
    error: "API timeout after 30s",
  },
];

// ── Tests ─────────────────────────────────────────────────────────────

describe("QueueDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    mockStore.status = null;
    mockStore.jobs = [];
    mockStore.isLoading = false;
    mockStore.error = null;
    mockStore.autoRefresh = true;
  });

  it("renders the header title", () => {
    render(<QueueDashboard />);

    expect(screen.getByText("Queue Overview")).toBeInTheDocument();
  });

  it("renders STAT_CARDS for all status types", () => {
    mockStore.status = mockStatus;
    render(<QueueDashboard />);

    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders status counts from store", () => {
    mockStore.status = mockStatus;
    render(<QueueDashboard />);

    expect(screen.getByText("5")).toBeInTheDocument(); // queued
    expect(screen.getByText("2")).toBeInTheDocument(); // running
    expect(screen.getByText("45")).toBeInTheDocument(); // completed
    expect(screen.getByText("3")).toBeInTheDocument(); // failed
  });

  it("renders total queue count", () => {
    mockStore.status = mockStatus;
    render(<QueueDashboard />);

    expect(screen.getByText("55")).toBeInTheDocument(); // total
  });

  it("renders auto-refresh checkbox with default checked", () => {
    mockStore.autoRefresh = true;
    render(<QueueDashboard />);

    const checkbox = screen.getByLabelText("Auto-refresh (5s)");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("calls setAutoRefresh when checkbox is toggled", async () => {
    const user = userEvent.setup();
    mockStore.autoRefresh = true;
    render(<QueueDashboard />);

    const checkbox = screen.getByLabelText("Auto-refresh (5s)");
    await user.click(checkbox);

    expect(mockStore.setAutoRefresh).toHaveBeenCalledWith(false);
  });

  it("renders Refresh button", () => {
    render(<QueueDashboard />);

    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("calls fetchStatus and fetchJobs on mount", () => {
    render(<QueueDashboard />);

    expect(mockStore.fetchStatus).toHaveBeenCalled();
    expect(mockStore.fetchJobs).toHaveBeenCalled();
  });

  it("renders job list table when jobs are present", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    // Table headers — "Completed" also appears in stat cards + badges,
    // so use getAllByText (at least the header + stat card row exist)
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Attempts")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    // "Completed" appears in stat card, table header, and possibly badges
    const completedElements = screen.getAllByText("Completed");
    expect(completedElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders job type and status badges", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    // "publish" appears twice (job-001 and job-003 both have type "publish")
    const publishElements = screen.getAllByText("publish");
    expect(publishElements.length).toBe(2);
    expect(screen.getByText("generate")).toBeInTheDocument();
    // Status badges share labels with stat cards, so use getAllByText
    const completedElements = screen.getAllByText("Completed");
    expect(completedElements.length).toBeGreaterThanOrEqual(2);
    const runningElements = screen.getAllByText("Running");
    expect(runningElements.length).toBeGreaterThanOrEqual(2);
    const failedElements = screen.getAllByText("Failed");
    expect(failedElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders priority badges", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("renders Retry button for failed jobs", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    const retryButtons = screen.getAllByText("Retry");
    expect(retryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls retryJob when Retry button is clicked", async () => {
    const user = userEvent.setup();
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    const retryButtons = screen.getAllByText("Retry");
    await user.click(retryButtons[0]);

    expect(mockStore.retryJob).toHaveBeenCalledWith("job-003-zzzzzzzz");
  });

  it("does not render Retry button for non-failed jobs", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = [mockJobs[0]]; // Only completed job
    render(<QueueDashboard />);

    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("renders loading state when isLoading and no jobs", () => {
    mockStore.isLoading = true;
    mockStore.jobs = [];
    const { container } = render(<QueueDashboard />);

    const loader = container.querySelector(".animate-spin");
    expect(loader).toBeInTheDocument();
  });

  it("renders empty state when no jobs", () => {
    mockStore.jobs = [];
    render(<QueueDashboard />);

    expect(screen.getByText("No jobs in the queue.")).toBeInTheDocument();
  });

  it("renders error banner when error is present", () => {
    mockStore.error = "Failed to fetch queue data";
    render(<QueueDashboard />);

    expect(screen.getByText("Failed to fetch queue data")).toBeInTheDocument();
  });

  it("renders error jobs section for jobs with errors", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    expect(screen.getByText("Recent Errors")).toBeInTheDocument();
    expect(screen.getByText(/API timeout after 30s/)).toBeInTheDocument();
  });

  it("does not render error jobs section when no jobs have errors", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = [mockJobs[0]]; // completed job, no error
    render(<QueueDashboard />);

    expect(screen.queryByText("Recent Errors")).not.toBeInTheDocument();
  });

  it("renders attempt counts for jobs", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    // "1/3" appears twice (job-001 and job-002 both have attempts=1, maxAttempts=3)
    const attemptElements = screen.getAllByText("1/3");
    expect(attemptElements.length).toBe(2);
    expect(screen.getByText("2/3")).toBeInTheDocument(); // failed — unique
  });

  it("renders stat cards with correct icons", () => {
    mockStore.status = mockStatus;
    render(<QueueDashboard />);

    expect(screen.getByTestId("icon-clock")).toBeInTheDocument(); // queued
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument(); // running
    expect(screen.getByTestId("icon-check")).toBeInTheDocument(); // completed
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument(); // failed
  });

  it("renders retry button in error section", () => {
    mockStore.status = mockStatus;
    mockStore.jobs = mockJobs;
    render(<QueueDashboard />);

    const retryButtons = screen.getAllByText("Retry");
    // Should have retry in both: job table row and error section
    expect(retryButtons.length).toBe(2);
  });

  it("handles 0 values in status gracefully", () => {
    mockStore.status = { queued: 0, running: 0, completed: 0, failed: 0, total: 0 };
    render(<QueueDashboard />);

    // "0" appears in every stat card (4x) + total count → at least 5 occurrences
    const zeroElements = screen.getAllByText("0");
    expect(zeroElements.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Total jobs in queue:")).toBeInTheDocument();
  });

  it("displays status without total when status is null", () => {
    mockStore.status = null;
    render(<QueueDashboard />);

    expect(screen.queryByText("Total jobs in queue:")).not.toBeInTheDocument();
  });
});
