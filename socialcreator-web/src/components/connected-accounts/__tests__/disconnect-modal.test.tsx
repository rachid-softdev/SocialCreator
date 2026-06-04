/**
 * Tests for DisconnectModal component
 *
 * Verifies:
 * - Confirmation dialog renders with account info
 * - Confirm action fires onConfirm
 * - Cancel action closes dialog
 * - Loading state disables buttons
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { DisconnectModal } from "../disconnect-modal";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("@socialcreator/ui/dialog", () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div data-testid="dialog-overlay">{children}</div> : null,
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children, className }: any) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert-triangle" {...props} />
  ),
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader2" {...props} />,
}));

vi.mock("../platform-icon", () => ({
  PlatformIcon: ({ platform, size }: { platform: string; size: string }) => (
    <div data-testid="platform-icon" data-platform={platform} data-size={size} />
  ),
  getPlatformName: vi.fn((platform: string) => {
    const names: Record<string, string> = {
      INSTAGRAM: "Instagram",
      TIKTOK: "TikTok",
      LINKEDIN: "LinkedIn",
      X: "X (Twitter)",
      YOUTUBE: "YouTube",
      FACEBOOK: "Facebook",
      PINTEREST: "Pinterest",
      THREADS: "Threads",
    };
    return names[platform] || platform;
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("DisconnectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders confirmation dialog with account info when open", () => {
    render(
      <DisconnectModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        platform="X"
        accountName="@testuser"
      />,
    );

    expect(screen.getByText(/Déconnecter le compte/)).toBeInTheDocument();
    expect(screen.getByText("@testuser")).toBeInTheDocument();
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <DisconnectModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        platform="X"
        accountName="@testuser"
      />,
    );

    expect(screen.queryByTestId("dialog-overlay")).not.toBeInTheDocument();
  });

  it("renders cancel and confirm buttons", () => {
    render(
      <DisconnectModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        platform="X"
        accountName="@testuser"
      />,
    );

    expect(screen.getByText("Annuler")).toBeInTheDocument();
    expect(screen.getByText("Déconnecter")).toBeInTheDocument();
  });

  it("calls onClose when cancel is clicked", async () => {
    const handleClose = vi.fn();

    render(
      <DisconnectModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        platform="X"
        accountName="@testuser"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText("Annuler"));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <DisconnectModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        platform="X"
        accountName="@testuser"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText("Déconnecter"));

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner on confirm button when confirming", async () => {
    const handleConfirm = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)));

    render(
      <DisconnectModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        platform="X"
        accountName="@testuser"
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText("Déconnecter"));

    // Should show loader icon during confirmation
    expect(screen.getByTestId("icon-loader2")).toBeInTheDocument();
  });

  it("disables buttons when isLoading prop is true", () => {
    render(
      <DisconnectModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        platform="X"
        accountName="@testuser"
        isLoading
      />,
    );

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it("shows warning text about stopping publications", () => {
    render(
      <DisconnectModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        platform="X"
        accountName="@testuser"
      />,
    );

    expect(screen.getByText(/Attention/)).toBeInTheDocument();
  });
});
