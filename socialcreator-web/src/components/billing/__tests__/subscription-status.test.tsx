/**
 * Tests for SubscriptionStatus component
 *
 * Renders current plan info, status badge, renewal date,
 * profile usage bar, and manage subscription button.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { SubscriptionStatus } from "../subscription-status";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetPlanData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/plans-data", () => ({
  getPlanData: mockGetPlanData,
}));

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, variant, className, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Calendar: ({ className }: any) => (
    <span data-testid="icon-calendar" className={className}>
      svg-calendar
    </span>
  ),
  CreditCard: ({ className }: any) => (
    <span data-testid="icon-credit-card" className={className}>
      svg-credit-card
    </span>
  ),
  ExternalLink: ({ className }: any) => (
    <span data-testid="icon-external-link" className={className}>
      svg-external-link
    </span>
  ),
}));

const proPlanData = {
  name: "Pro",
  price: 7000,
  profiles: 2,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: [
    "2 profiles",
    "AI content generation",
    "Advanced scheduling",
    "Video clipping",
    "Priority support",
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("SubscriptionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanData.mockReturnValue(proPlanData);
  });

  it("renders current plan name", () => {
    render(<SubscriptionStatus plan="pro" />);

    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Current Plan")).toBeInTheDocument();
  });

  it("renders 'Free' plan when plan is 'free'", () => {
    mockGetPlanData.mockReturnValue(null);
    render(<SubscriptionStatus plan="free" />);

    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("renders price per month for paid plans", () => {
    render(<SubscriptionStatus plan="pro" />);

    expect(screen.getByText("$70.00/month")).toBeInTheDocument();
  });

  it("renders active status badge for non-active statuses", () => {
    render(<SubscriptionStatus plan="pro" status="past_due" />);

    expect(screen.getByText("Past Due")).toBeInTheDocument();
  });

  it("renders trialing status badge", () => {
    render(<SubscriptionStatus plan="pro" status="trialing" />);

    expect(screen.getByText("Trialing")).toBeInTheDocument();
  });

  it("renders canceled status badge", () => {
    render(<SubscriptionStatus plan="pro" status="canceled" />);

    expect(screen.getByText("Canceled")).toBeInTheDocument();
  });

  it("does not render status badge for active status", () => {
    render(<SubscriptionStatus plan="pro" status="active" />);

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("renders renewal date when provided", () => {
    render(<SubscriptionStatus plan="pro" renewalDate={new Date("2025-07-01")} />);

    expect(screen.getByText(/Renews/)).toBeInTheDocument();
  });

  it("does not render renewal date when not provided", () => {
    render(<SubscriptionStatus plan="pro" />);

    expect(screen.queryByText(/Renews/)).not.toBeInTheDocument();
  });

  it("renders profile usage bar with correct values", () => {
    render(<SubscriptionStatus plan="pro" profilesUsed={1} profilesMax={2} />);

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("calculates correct usage bar width", () => {
    const { container } = render(
      <SubscriptionStatus plan="pro" profilesUsed={1} profilesMax={2} />,
    );

    const bar = container.querySelector(".h-full");
    expect(bar).toHaveStyle({ width: "50%" });
  });

  it("caps usage bar at 100%", () => {
    const { container } = render(
      <SubscriptionStatus plan="pro" profilesUsed={5} profilesMax={2} />,
    );

    const bar = container.querySelector(".h-full");
    expect(bar).toHaveStyle({ width: "100%" });
  });

  it("renders Manage Subscription button for paid plans with onManagePortal", () => {
    render(<SubscriptionStatus plan="pro" onManagePortal={vi.fn()} />);

    expect(screen.getByText("Manage Subscription")).toBeInTheDocument();
  });

  it("does not render Manage Subscription button for free plan", () => {
    mockGetPlanData.mockReturnValue(null);
    render(<SubscriptionStatus plan="free" onManagePortal={vi.fn()} />);

    expect(screen.queryByText("Manage Subscription")).not.toBeInTheDocument();
  });

  it("does not render Manage Subscription button when onManagePortal is not provided", () => {
    render(<SubscriptionStatus plan="pro" />);

    expect(screen.queryByText("Manage Subscription")).not.toBeInTheDocument();
  });

  it("renders CreditCard icon for price display", () => {
    render(<SubscriptionStatus plan="pro" />);

    expect(screen.getByText("svg-credit-card")).toBeInTheDocument();
  });

  it("renders Calendar icon when renewalDate is provided", () => {
    render(<SubscriptionStatus plan="pro" renewalDate={new Date("2025-07-01")} />);

    expect(screen.getByText("svg-calendar")).toBeInTheDocument();
  });
});
