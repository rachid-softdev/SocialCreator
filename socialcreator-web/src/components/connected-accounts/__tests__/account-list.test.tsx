/**
 * Tests for AccountList component
 *
 * Verifies:
 * - Renders list of accounts
 * - Shows empty state when no accounts
 * - Shows loading state with skeleton cards
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { AccountList } from "../account-list";

// ── Hoisted mock data ────────────────────────────────────────────────

const mockAccounts = vi.hoisted(() => [
  {
    id: "acct-1",
    platform: "X" as const,
    accountName: "Test User",
    accountId: "12345",
    accountAvatarUrl: null,
    expiresAt: null,
    isActive: true,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    updatedAt: new Date("2025-06-01T10:00:00Z"),
    profileId: "profile-1",
    accessToken: "encrypted-token",
    refreshToken: null,
  },
  {
    id: "acct-2",
    platform: "LINKEDIN" as const,
    accountName: "LinkedIn User",
    accountId: "67890",
    accountAvatarUrl: null,
    expiresAt: null,
    isActive: true,
    createdAt: new Date("2025-06-02T10:00:00Z"),
    updatedAt: new Date("2025-06-02T10:00:00Z"),
    profileId: "profile-1",
    accessToken: "encrypted-token-2",
    refreshToken: null,
  },
]);

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("../account-card", () => ({
  AccountCard: ({ account }: any) => (
    <div data-testid="account-card" data-account-id={account.id}>
      {account.accountName}
    </div>
  ),
  AccountCardSkeleton: () => <div data-testid="account-card-skeleton" />,
}));

vi.mock("../platform-icon", () => ({
  PlatformIcon: ({ platform, size }: { platform: string; size: string }) => (
    <div data-testid="platform-icon" data-platform={platform} data-size={size} />
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("AccountList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a list of accounts", () => {
    render(<AccountList accounts={mockAccounts} />);

    const cards = screen.getAllByTestId("account-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn User")).toBeInTheDocument();
  });

  it("shows empty state when no accounts are connected", () => {
    render(<AccountList accounts={[]} />);

    expect(screen.getByText("Aucun compte connecté")).toBeInTheDocument();
    expect(
      screen.getByText(/Connectez vos comptes sociaux pour commencer à publier/),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton cards when isLoading is true", () => {
    render(<AccountList accounts={[]} isLoading />);

    const skeletons = screen.getAllByTestId("account-card-skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("renders accounts sorted with active first", () => {
    const accountsWithInactive = [{ ...mockAccounts[0]!, isActive: false }, mockAccounts[1]!];

    render(<AccountList accounts={accountsWithInactive} />);

    const cards = screen.getAllByTestId("account-card");
    expect(cards).toHaveLength(2);
    // First card should be the active one (LinkedIn User)
    expect(cards[0]).toHaveAttribute("data-account-id", "acct-2");
    expect(cards[1]).toHaveAttribute("data-account-id", "acct-1");
  });

  it("passes onRefresh and onDisconnect callbacks to AccountCard", () => {
    const handleRefresh = vi.fn();
    const handleDisconnect = vi.fn();

    render(
      <AccountList
        accounts={mockAccounts}
        onRefresh={handleRefresh}
        onDisconnect={handleDisconnect}
      />,
    );

    const cards = screen.getAllByTestId("account-card");
    expect(cards).toHaveLength(2);
  });
});
