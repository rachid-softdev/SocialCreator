/**
 * Tests for PricingTable component
 *
 * Renders all plan tiers (starter/pro/team) with features, prices,
 * CTA buttons, and annual/monthly toggle. Includes loading skeleton state.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { PricingTable } from "../pricing-table";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetPlanData = vi.hoisted(() => vi.fn());
const mockFetchActivePrices = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe", () => ({
  getPlanData: mockGetPlanData,
  fetchActivePrices: mockFetchActivePrices,
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

vi.mock("lucide-react", () => ({
  Check: ({ className }: any) => (
    <span data-testid="icon-check" className={className}>
      svg-check
    </span>
  ),
}));

vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const starterData = {
  name: "Starter",
  price: 5000,
  profiles: 1,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: ["1 profile", "AI content generation", "Basic scheduling", "Email support"],
};
const proData = {
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
const teamData = {
  name: "Team",
  price: 11000,
  profiles: 4,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: [
    "4 profiles",
    "AI content generation",
    "Advanced scheduling",
    "Video clipping",
    "Team collaboration",
    "Dedicated support",
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("PricingTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlanData.mockImplementation((plan: string) => {
      switch (plan) {
        case "starter":
          return starterData;
        case "pro":
          return proData;
        case "team":
          return teamData;
        default:
          return null;
      }
    });
    mockFetchActivePrices.mockResolvedValue({ starter: 5000, pro: 7000, team: 11000 });
  });

  it("renders all three plan tiers", async () => {
    render(<PricingTable />);

    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("Team")).toBeInTheDocument();
    });
  });

  it("renders features for each plan", async () => {
    render(<PricingTable />);

    await waitFor(() => {
      expect(screen.getByText("1 profile")).toBeInTheDocument();
      expect(screen.getByText("2 profiles")).toBeInTheDocument();
      expect(screen.getByText("4 profiles")).toBeInTheDocument();
    });
  });

  it("renders prices for each plan", async () => {
    render(<PricingTable />);

    await waitFor(() => {
      expect(screen.getByText("$50")).toBeInTheDocument();
      expect(screen.getByText("$70")).toBeInTheDocument();
      expect(screen.getByText("$110")).toBeInTheDocument();
    });
  });

  it("displays 'Most Popular' badge on Pro plan", async () => {
    render(<PricingTable />);

    await waitFor(() => {
      expect(screen.getByText("Most Popular")).toBeInTheDocument();
    });
  });

  it("renders Select Plan buttons for each tier", async () => {
    render(<PricingTable />);

    await waitFor(() => {
      const buttons = screen.getAllByText("Select Plan");
      expect(buttons).toHaveLength(3);
    });
  });

  it("calls onSelectPlan when a plan button is clicked", async () => {
    const onSelectPlan = vi.fn();
    render(<PricingTable onSelectPlan={onSelectPlan} />);

    await waitFor(() => {
      // Button should no longer be loading
      expect(screen.queryByText("$50")).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByText("Select Plan");
    await userEvent.click(selectButtons[0]);

    expect(onSelectPlan).toHaveBeenCalledWith("starter");
  });

  it("shows 'Current Plan' for the current plan and disables the button", async () => {
    render(<PricingTable currentPlan="pro" />);

    await waitFor(() => {
      expect(screen.getByText("Current Plan")).toBeInTheDocument();
    });

    const currentPlanBtn = screen.getByText("Current Plan");
    expect(currentPlanBtn).toBeDisabled();
  });

  it("shows loading skeleton while prices are being fetched", () => {
    // Don't resolve fetchActivePrices so it stays loading
    mockFetchActivePrices.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PricingTable />);

    // Should show animated skeleton divs for prices
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all features from plan data", async () => {
    render(<PricingTable />);

    await waitFor(() => {
      // Some features appear in multiple plan tiers; use getAllByText for duplicates
      expect(screen.getAllByText("AI content generation").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Basic scheduling")).toBeInTheDocument();
      expect(screen.getByText("Email support")).toBeInTheDocument();
      expect(screen.getAllByText("Video clipping").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Team collaboration")).toBeInTheDocument();
      expect(screen.getByText("Dedicated support")).toBeInTheDocument();
    });
  });
});
