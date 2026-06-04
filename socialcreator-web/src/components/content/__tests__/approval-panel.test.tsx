/**
 * Tests for ApprovalPanel component.
 *
 * Tests approve/reject buttons, rejection reason input,
 * backdrop close, and content display.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContent } from "@/components/__tests__/test-fixtures";
import { render, screen } from "@/components/__tests__/test-utils";
import { ApprovalPanel } from "../approval-panel";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
]);

const mockStatusLabels = vi.hoisted(() => ({
  DRAFT: "Draft",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
}));

const mockStatusColors = vi.hoisted(() => ({
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-purple-100 text-purple-700",
  FAILED: "bg-red-100 text-red-700",
}));

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
  CONTENT_STATUS_LABELS: mockStatusLabels,
  CONTENT_STATUS_COLORS: mockStatusColors,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: "svg-alert-triangle",
  Check: "svg-check",
  X: "svg-x",
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("ApprovalPanel", () => {
  const onClose = vi.fn();
  const onApprove = vi.fn();
  const onReject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={false}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.queryByText("Review Content")).not.toBeInTheDocument();
  });

  it("renders nothing when content is null", () => {
    render(
      <ApprovalPanel
        content={null}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.queryByText("Review Content")).not.toBeInTheDocument();
  });

  it("renders the panel when isOpen is true and content is provided", () => {
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("Review Content")).toBeInTheDocument();
  });

  it("renders the content text", () => {
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(
      screen.getByText("This is a draft post for testing purposes with some hashtags."),
    ).toBeInTheDocument();
  });

  it("renders platform and status badges", () => {
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders approve and reject buttons", () => {
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("calls onApprove when approve button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledWith("content-1");
  });

  it("shows rejection reason input when reject is clicked once", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByText("Reject"));
    expect(screen.getByLabelText("Reason for rejection (optional)")).toBeInTheDocument();
    // Button text changes to "Confirm Reject"
    expect(screen.getByText("Confirm Reject")).toBeInTheDocument();
  });

  it("calls onReject with reason when confirm reject is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByText("Reject"));
    const reasonInput = screen.getByLabelText("Reason for rejection (optional)");
    await user.type(reasonInput, "Not on brand");
    await user.click(screen.getByText("Confirm Reject"));

    expect(onReject).toHaveBeenCalledWith("content-1", "Not on brand");
  });

  it("calls onClose when backdrop is clicked (aria-label 'Close')", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes the rejection input and resets on second reject click", async () => {
    const user = userEvent.setup();
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    // First click shows input
    await user.click(screen.getByText("Reject"));
    expect(screen.getByLabelText("Reason for rejection (optional)")).toBeInTheDocument();

    // Type a reason
    const reasonInput = screen.getByLabelText("Reason for rejection (optional)");
    await user.type(reasonInput, "Some reason");

    // Click "Confirm Reject" to submit
    await user.click(screen.getByText("Confirm Reject"));

    expect(onReject).toHaveBeenCalledWith("content-1", "Some reason");
  });

  it("renders character count for the content", () => {
    const content = createContent({ textContent: "Short" });
    render(
      <ApprovalPanel
        content={content}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("5 characters")).toBeInTheDocument();
  });

  it("disables buttons when isLoading is true", () => {
    render(
      <ApprovalPanel
        content={createContent()}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
        isLoading={true}
      />,
    );

    // Approve button should be disabled
    const approveButton = screen.getByText("Approve");
    expect(approveButton).toBeDisabled();
  });

  it("shows 'Generated by' when content has run.agent", () => {
    const content = createContent({
      run: { id: "run-1", agent: { id: "agent-1", name: "Writer Bot" } },
    });
    render(
      <ApprovalPanel
        content={content}
        isOpen={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    expect(screen.getByText(/Generated by/)).toBeInTheDocument();
    expect(screen.getByText("Writer Bot")).toBeInTheDocument();
  });
});
