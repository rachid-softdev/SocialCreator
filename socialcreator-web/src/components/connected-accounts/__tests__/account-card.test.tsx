/**
 * Tests for AccountCard component
 *
 * Verifies:
 * - Renders account name, platform, expires badge, avatar
 * - Refresh and disconnect buttons
 * - Expiry badge variants
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { AccountCard } from "../account-card";

// ── Hoisted factories for mock data ──────────────────────────────────

const mockAccountActive = vi.hoisted(() => ({
  id: "acct-1",
  platform: "X" as const,
  accountName: "Test User",
  accountId: "12345",
  accountAvatarUrl: "https://example.com/avatar.png",
  expiresAt: new Date("2099-12-31T23:59:59Z"),
  isActive: true,
  createdAt: new Date("2025-06-01T10:00:00Z"),
  updatedAt: new Date("2025-06-01T10:00:00Z"),
  profileId: "profile-1",
  accessToken: "encrypted-token",
  refreshToken: "encrypted-refresh",
}));

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@socialcreator/ui/badge", () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

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

vi.mock("@socialcreator/ui/skeleton", () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("lucide-react", () => ({
  RefreshCw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-refresh-cw" {...props} />
  ),
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-trash2" {...props} />,
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt || ""} src={props.src || "https://placehold.co/48"} />
  ),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "2 days ago"),
  fr: {},
}));

vi.mock("../platform-icon", () => ({
  PlatformIcon: ({ platform, size }: { platform: string; size: string }) => (
    <div data-testid="platform-icon" data-platform={platform} data-size={size} />
  ),
  getPlatformName: vi.fn((platform: string) => {
    const names: Record<string, string> = {
      X: "X (Twitter)",
      INSTAGRAM: "Instagram",
      LINKEDIN: "LinkedIn",
      TIKTOK: "TikTok",
      FACEBOOK: "Facebook",
      YOUTUBE: "YouTube",
      PINTEREST: "Pinterest",
      THREADS: "Threads",
    };
    return names[platform] || platform;
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("AccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders account name and platform", () => {
    render(<AccountCard account={mockAccountActive} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("renders active status badge", () => {
    render(<AccountCard account={mockAccountActive} />);

    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("renders expires badge with days remaining", () => {
    render(<AccountCard account={mockAccountActive} />);

    // Since expiresAt is in 2099, it should be more than 30 days
    expect(screen.getByText(/Expires in/)).toBeInTheDocument();
  });

  it("renders expired badge for expired accounts", () => {
    const expiredAccount = {
      ...mockAccountActive,
      expiresAt: new Date("2020-01-01T00:00:00Z"),
    };

    render(<AccountCard account={expiredAccount} />);

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("renders account avatar when accountAvatarUrl is provided", () => {
    render(<AccountCard account={mockAccountActive} />);

    const avatar = screen.getByAltText("Test User");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("renders refresh and disconnect buttons when callbacks are provided", () => {
    render(<AccountCard account={mockAccountActive} onRefresh={vi.fn()} onDisconnect={vi.fn()} />);

    // There should be buttons rendered via the mocked Button component
    expect(screen.getByTestId("icon-refresh-cw")).toBeInTheDocument();
    expect(screen.getByTestId("icon-trash2")).toBeInTheDocument();
  });

  it("does not render refresh button when onRefresh is not provided", () => {
    render(<AccountCard account={mockAccountActive} />);

    expect(screen.queryByTestId("icon-refresh-cw")).not.toBeInTheDocument();
  });

  it("does not render disconnect button when onDisconnect is not provided", () => {
    render(<AccountCard account={mockAccountActive} />);

    expect(screen.queryByTestId("icon-trash2")).not.toBeInTheDocument();
  });

  it("calls onDisconnect with account id when disconnect button is clicked", async () => {
    const handleDisconnect = vi.fn();

    render(
      <AccountCard
        account={mockAccountActive}
        onDisconnect={handleDisconnect}
        onRefresh={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("icon-trash2"));

    expect(handleDisconnect).toHaveBeenCalledWith("acct-1");
  });
});
