/**
 * Tests for BillingOverview component
 *
 * Renders subscription overview with plan info, status badge, renewal date,
 * cancel/past due banners, and action buttons (Manage Billing, Upgrade).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";

// ── Mocks (must be before imports) ────────────────────────────────────────

const mockGetPlanData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/plans-data", () => ({
  getPlanData: mockGetPlanData,
}));

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@socialcreator/ui/badge", () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>
      {children}
    </span>
  ),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: ({ className }: any) => (
    <span data-testid="icon-alert-circle" className={className}>
      svg-alert-circle
    </span>
  ),
  Calendar: ({ className }: any) => (
    <span data-testid="icon-calendar" className={className}>
      svg-calendar
    </span>
  ),
  CheckCircle: ({ className }: any) => (
    <span data-testid="icon-check-circle" className={className}>
      svg-check-circle
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
  Loader2: ({ className }: any) => (
    <span data-testid="icon-loader" className={className}>
      svg-loader
    </span>
  ),
  XCircle: ({ className }: any) => (
    <span data-testid="icon-x-circle" className={className}>
      svg-x-circle
    </span>
  ),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("date-fns", () => ({
  format: vi.fn(() => "Jun 1, 2025"),
}));

import { BillingOverview } from "../billing-overview";

// ── Fixtures ──────────────────────────────────────────────────────────────

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

const starterPlanData = {
  name: "Starter",
  price: 5000,
  profiles: 1,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: ["1 profile", "AI content generation", "Basic scheduling", "Email support"],
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("BillingOverview", () => {
  const defaultProps = {
    currentPlan: "pro" as const,
    status: "active",
    renewalDate: new Date("2025-07-01"),
    customerId: "cus_123",
    cancelAtPeriodEnd: false,
    onOpenPortal: vi.fn(),
    onChangePlan: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanData.mockReturnValue(proPlanData);
  });

  it("shows no subscription state when currentPlan is null", () => {
    render(<BillingOverview {...defaultProps} currentPlan={null} status={null} />);

    expect(screen.getByText(/You don't have an active subscription/)).toBeInTheDocument();
    expect(screen.getByText("View Plans")).toBeInTheDocument();
  });

  it("shows View Plans button in no-subscription state", async () => {
    const onChangePlan = vi.fn();
    render(
      <BillingOverview
        {...defaultProps}
        currentPlan={null}
        status={null}
        onChangePlan={onChangePlan}
      />,
    );

    await userEvent.click(screen.getByText("View Plans"));
    expect(onChangePlan).toHaveBeenCalledWith("starter");
  });

  it("renders the current plan name and price", () => {
    render(<BillingOverview {...defaultProps} />);

    expect(screen.getByText("Current Plan")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("renders Active status badge", () => {
    render(<BillingOverview {...defaultProps} status="active" />);

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders Trial status badge", () => {
    render(<BillingOverview {...defaultProps} status="trialing" />);

    expect(screen.getByText("Trial")).toBeInTheDocument();
  });

  it("renders Past Due status badge", () => {
    render(<BillingOverview {...defaultProps} status="past_due" />);

    expect(screen.getByText("Past Due")).toBeInTheDocument();
  });

  it("renders Canceled status badge", () => {
    render(<BillingOverview {...defaultProps} status="canceled" />);

    expect(screen.getByText("Canceled")).toBeInTheDocument();
  });

  it("renders No Subscription badge for null status", () => {
    render(<BillingOverview {...defaultProps} status={null} currentPlan="free" />);
    mockGetPlanData.mockReturnValue(null);

    expect(screen.getByText("No Subscription")).toBeInTheDocument();
  });

  it("shows renewal date", () => {
    render(<BillingOverview {...defaultProps} />);

    expect(screen.getByText(/Renews/)).toBeInTheDocument();
  });

  it("shows cancel at period end warning", () => {
    render(<BillingOverview {...defaultProps} cancelAtPeriodEnd={true} />);

    expect(
      screen.getByText(/Your subscription will be canceled at the end of the billing period/),
    ).toBeInTheDocument();
  });

  it("does not show cancel warning when cancelAtPeriodEnd is false", () => {
    render(<BillingOverview {...defaultProps} cancelAtPeriodEnd={false} />);

    expect(
      screen.queryByText(/Your subscription will be canceled at the end of the billing period/),
    ).not.toBeInTheDocument();
  });

  it("shows past due warning when status is past_due", () => {
    render(<BillingOverview {...defaultProps} status="past_due" />);

    expect(screen.getByText(/Your payment is past due/)).toBeInTheDocument();
  });

  it("renders Manage Billing button", () => {
    render(<BillingOverview {...defaultProps} />);

    expect(screen.getByText("Manage Billing")).toBeInTheDocument();
  });

  it("calls onOpenPortal when Manage Billing is clicked", async () => {
    const onOpenPortal = vi.fn().mockResolvedValue(undefined);
    render(<BillingOverview {...defaultProps} onOpenPortal={onOpenPortal} />);

    await userEvent.click(screen.getByText("Manage Billing"));
    await waitFor(() => {
      expect(onOpenPortal).toHaveBeenCalled();
    });
  });

  it("shows Upgrade Plan button when not on highest tier", () => {
    render(<BillingOverview {...defaultProps} currentPlan="starter" />);
    mockGetPlanData.mockReturnValue(starterPlanData);

    expect(screen.getByText("Upgrade Plan")).toBeInTheDocument();
  });

  it("does not show Upgrade Plan on team plan", () => {
    render(<BillingOverview {...defaultProps} currentPlan="team" />);

    expect(screen.queryByText("Upgrade Plan")).not.toBeInTheDocument();
  });

  it("shows loading spinner on Manage Billing while portal is opening", async () => {
    const onOpenPortal: () => Promise<void> = vi.fn(() => new Promise(() => {})); // never resolves
    render(<BillingOverview {...defaultProps} onOpenPortal={onOpenPortal} />);

    await userEvent.click(screen.getByText("Manage Billing"));
    expect(screen.getByText("svg-loader")).toBeInTheDocument();
  });

  it("renders Plan Features section", () => {
    render(<BillingOverview {...defaultProps} />);

    expect(screen.getByText("Plan Features")).toBeInTheDocument();
    expect(screen.getByText(/2 profiles included/)).toBeInTheDocument();
  });

  it("renders Help section", () => {
    render(<BillingOverview {...defaultProps} />);

    expect(screen.getByText("Need help?")).toBeInTheDocument();
    expect(screen.getByText("Contact Support")).toBeInTheDocument();
  });
});
