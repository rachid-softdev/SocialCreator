/**
 * Tests for ReviewDialog component.
 *
 * Tests dialog open/close, approval workflow,
 * rejection reason input, error handling.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { ReviewDialog } from "../review-dialog";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockRouter = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => mockRouter),
}));

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@socialcreator/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn() },
}));

vi.mock("lucide-react", () => ({
  CheckCircle: "svg-check-circle",
  Loader2: "svg-loader",
  XCircle: "svg-x-circle",
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("ReviewDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders nothing when open is false", () => {
    render(<ReviewDialog contentId="content-1" open={false} onOpenChange={onOpenChange} />);

    expect(screen.queryByText("Review Content")).not.toBeInTheDocument();
  });

  it("renders dialog with title and description when open is true", () => {
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText("Review Content")).toBeInTheDocument();
    expect(
      screen.getByText("Approve this content for publishing or reject it with feedback."),
    ).toBeInTheDocument();
  });

  it("renders approve and reject buttons", () => {
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("renders cancel button", () => {
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders review comment textarea", () => {
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByLabelText("Review comment (required for rejection)")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls approve API and closes dialog on approve", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Approve"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/content/content-1/approve-review",
      expect.objectContaining({ method: "POST" }),
    );

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  it("shows error when approve API fails", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Content is not in DRAFT status" }),
    });

    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Approve"));

    await waitFor(() => {
      expect(screen.getByText("Content is not in DRAFT status")).toBeInTheDocument();
    });
  });

  it("requires comment for rejection", async () => {
    const user = userEvent.setup();
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Reject"));

    expect(
      screen.getByText("A review comment is required when rejecting content"),
    ).toBeInTheDocument();
  });

  it("calls reject API with comment when rejection is submitted", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    const textarea = screen.getByLabelText("Review comment (required for rejection)");
    await user.type(textarea, "This content needs more details");

    await user.click(screen.getByText("Reject"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/content/content-1/reject-review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ comment: "This content needs more details" }),
      }),
    );

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error when reject API fails", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Already approved" }),
    });

    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    const textarea = screen.getByLabelText("Review comment (required for rejection)");
    await user.type(textarea, "Needs work");

    await user.click(screen.getByText("Reject"));

    await waitFor(() => {
      expect(screen.getByText("Already approved")).toBeInTheDocument();
    });
  });

  it("disables all action buttons while loading", async () => {
    // Mock fetch to never resolve
    (globalThis.fetch as any).mockImplementationOnce(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Approve"));

    // All buttons should be disabled while loading
    expect(screen.getByText("Approve")).toBeDisabled();
    expect(screen.getByText("Reject")).toBeDisabled();
    expect(screen.getByText("Cancel")).not.toBeDisabled();
  });

  it("clears error when user types in the comment field", async () => {
    const user = userEvent.setup();
    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    // Trigger rejection without comment to show error
    await user.click(screen.getByText("Reject"));
    expect(
      screen.getByText("A review comment is required when rejecting content"),
    ).toBeInTheDocument();

    // Type in the comment field
    const textarea = screen.getByLabelText("Review comment (required for rejection)");
    await user.type(textarea, "Some feedback");

    // Error should be cleared
    expect(
      screen.queryByText("A review comment is required when rejecting content"),
    ).not.toBeInTheDocument();
  });

  it("handles network error on approve gracefully", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockRejectedValueOnce(new Error("Network failure"));

    render(<ReviewDialog contentId="content-1" open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText("Approve"));

    await waitFor(() => {
      expect(screen.getByText("Failed to approve content")).toBeInTheDocument();
    });
  });
});
