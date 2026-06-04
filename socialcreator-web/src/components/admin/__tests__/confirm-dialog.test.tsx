/**
 * Tests for ConfirmDialog component
 *
 * Renders a confirmation dialog with title, description, cancel/confirm buttons,
 * loading state, and destructive variant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { ConfirmDialog } from "../confirm-dialog";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@socialcreator/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { className?: string }) => (
    <svg data-testid="loader-icon" className={className} />
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Confirm Action",
    description: "Are you sure you want to proceed?",
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with title and description", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
  });

  it("does not render dialog when open is false", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders confirm and cancel buttons", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Yes, Delete" cancelLabel="No, Keep" />);

    expect(screen.getByText("Yes, Delete")).toBeInTheDocument();
    expect(screen.getByText("No, Keep")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onOpenChange(false) when cancel button is clicked", async () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByText("Cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both buttons when loading is true", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    expect(screen.getByText("Confirm")).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("shows Loader2 icon when loading is true", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
  });

  it("does not show Loader2 icon when loading is false", () => {
    render(<ConfirmDialog {...defaultProps} loading={false} />);

    expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
  });

  it("renders with destructive variant by default", () => {
    render(<ConfirmDialog {...defaultProps} />);

    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn).toHaveAttribute("data-variant", "destructive");
  });

  it("renders with primary variant when specified", () => {
    render(<ConfirmDialog {...defaultProps} variant="primary" />);

    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn).toHaveAttribute("data-variant", "primary");
  });

  it("renders cancel button with outline variant", () => {
    render(<ConfirmDialog {...defaultProps} />);

    const cancelBtn = screen.getByText("Cancel");
    expect(cancelBtn).toHaveAttribute("data-variant", "outline");
  });
});
