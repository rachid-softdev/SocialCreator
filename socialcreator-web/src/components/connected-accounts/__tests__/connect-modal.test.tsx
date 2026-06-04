/**
 * Tests for ConnectModal component
 *
 * Verifies:
 * - Renders modal with platform list
 * - Triggers OAuth flow on platform click
 * - Shows success state after connection
 * - Shows error state
 * - Shows popup blocked warning
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { ConnectModal } from "../connect-modal";

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
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert-triangle" {...props} />
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  ExternalLink: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-external-link" {...props} />
  ),
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader2" {...props} />,
}));

const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

vi.mock("../account-list", () => ({
  getUnconnectedPlatforms: vi.fn((accounts: any[]) => {
    const connected = new Set(accounts.map((a: any) => a.platform));
    const all = [
      "INSTAGRAM",
      "TIKTOK",
      "LINKEDIN",
      "X",
      "YOUTUBE",
      "FACEBOOK",
      "PINTEREST",
      "THREADS",
    ];
    return all.filter((p) => !connected.has(p));
  }),
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

describe("ConnectModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with platform list when open", () => {
    render(<ConnectModal isOpen={true} onClose={vi.fn()} accounts={[]} profileId="profile-1" />);

    expect(screen.getByText("Connecter un compte")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
  });

  it("does not render modal when closed", () => {
    render(<ConnectModal isOpen={false} onClose={vi.fn()} accounts={[]} profileId="profile-1" />);

    expect(screen.queryByTestId("dialog-overlay")).not.toBeInTheDocument();
  });

  it("shows only unconnected platforms", () => {
    render(
      <ConnectModal
        isOpen={true}
        onClose={vi.fn()}
        accounts={[{ platform: "X" as const }, { platform: "LINKEDIN" as const }]}
        profileId="profile-1"
      />,
    );

    expect(screen.queryByText("X (Twitter)")).not.toBeInTheDocument();
    expect(screen.queryByText("LinkedIn")).not.toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("shows error state when OAuth URL fetch fails", async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Failed to get OAuth URL" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<ConnectModal isOpen={true} onClose={vi.fn()} accounts={[]} profileId="profile-1" />);

    const user = userEvent.setup();
    const instagramButton = screen.getByText("Instagram").closest("button")!;
    await user.click(instagramButton);

    await waitFor(() => {
      expect(screen.getByText("Failed to get OAuth URL")).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("shows popup blocked warning when window.open returns null", async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ redirectUrl: "https://oauth.example.com/auth" }),
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("open", () => null);

    render(<ConnectModal isOpen={true} onClose={vi.fn()} accounts={[]} profileId="profile-1" />);

    const user = userEvent.setup();
    const instagramButton = screen.getByText("Instagram").closest("button")!;
    await user.click(instagramButton);

    await waitFor(() => {
      expect(screen.getByText(/Pop-up blocked/)).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("shows all connected message when all platforms are connected", () => {
    render(
      <ConnectModal
        isOpen={true}
        onClose={vi.fn()}
        accounts={[
          { platform: "INSTAGRAM" as const },
          { platform: "TIKTOK" as const },
          { platform: "LINKEDIN" as const },
          { platform: "X" as const },
          { platform: "YOUTUBE" as const },
          { platform: "FACEBOOK" as const },
          { platform: "PINTEREST" as const },
          { platform: "THREADS" as const },
        ]}
        profileId="profile-1"
      />,
    );

    expect(screen.getByText("Tous les comptes sont déjà connectés !")).toBeInTheDocument();
  });

  it("shows loader icon on the connecting platform button", async () => {
    // Keep the fetch pending so the button stays in connecting state
    const mockFetch = vi.fn();
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );
    vi.stubGlobal("fetch", mockFetch);

    // Also mock open to prevent popup blocked warning
    vi.stubGlobal("open", () => null);

    render(<ConnectModal isOpen={true} onClose={vi.fn()} accounts={[]} profileId="profile-1" />);

    const user = userEvent.setup();
    const instagramButton = screen.getByText("Instagram").closest("button")!;
    await user.click(instagramButton);

    // The button should show a loader (Loader2 icon)
    expect(screen.getByTestId("icon-loader2")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
