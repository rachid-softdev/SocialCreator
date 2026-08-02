/**
 * Tests for PlanSelector component
 *
 * Renders plan selection buttons (starter/pro/team), additional profiles stepper,
 * total price display, and checkout button.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { PlanSelector } from "../plan-selector";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockGetPlanData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/plans-data", () => ({
  getPlanData: mockGetPlanData,
}));

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Minus: ({ className }: any) => (
    <span data-testid="icon-minus" className={className}>
      svg-minus
    </span>
  ),
  Plus: ({ className }: any) => (
    <span data-testid="icon-plus" className={className}>
      svg-plus
    </span>
  ),
}));

const starterData = {
  name: "Starter",
  price: 5000,
  profiles: 1,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: [],
};
const proData = {
  name: "Pro",
  price: 7000,
  profiles: 2,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: [],
};
const teamData = {
  name: "Team",
  price: 11000,
  profiles: 4,
  addOnPrice: 2000,
  addOnProfiles: 1,
  features: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("PlanSelector", () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    currentPlan: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to starter
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
  });

  it("renders plan selection buttons", () => {
    render(<PlanSelector {...defaultProps} />);

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
  });

  it("displays the title 'Choose your plan'", () => {
    render(<PlanSelector {...defaultProps} />);

    expect(screen.getByText("Choose your plan")).toBeInTheDocument();
  });

  it("highlights the selected plan", () => {
    render(<PlanSelector {...defaultProps} />);

    // Starter should be selected by default
    const starterBtn = screen.getByText("Starter");
    expect(starterBtn.className).toContain("border-primary");
  });

  it("shows current plan indicator", () => {
    render(<PlanSelector {...defaultProps} currentPlan="pro" />);

    expect(screen.getByText(/Pro \(current\)/)).toBeInTheDocument();
  });

  it("disables the current plan button", () => {
    render(<PlanSelector {...defaultProps} currentPlan="pro" />);

    const proBtn = screen.getByText(/Pro \(current\)/);
    expect(proBtn).toBeDisabled();
  });

  it("shows additional profiles section for non-free plans", () => {
    render(<PlanSelector {...defaultProps} />);

    expect(screen.getByText("Additional profiles")).toBeInTheDocument();
  });

  it("renders minus and plus buttons for profiles", () => {
    render(<PlanSelector {...defaultProps} />);

    const minusBtn = screen.getByText("svg-minus");
    const plusBtn = screen.getByText("svg-plus");

    expect(minusBtn).toBeInTheDocument();
    expect(plusBtn).toBeInTheDocument();
  });

  it("decrements additional profiles on minus click", async () => {
    render(<PlanSelector {...defaultProps} />);

    const plusBtn = screen.getByText("svg-plus");
    await userEvent.click(plusBtn);
    await userEvent.click(plusBtn);

    // Should be 2
    expect(screen.getByText("2")).toBeInTheDocument();

    const minusBtn = screen.getByText("svg-minus");
    await userEvent.click(minusBtn);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not decrement below 0", async () => {
    render(<PlanSelector {...defaultProps} />);

    const minusBtn = screen.getByText("svg-minus").closest("button")!;
    expect(minusBtn).toBeDisabled();
  });

  it("shows total price", () => {
    render(<PlanSelector {...defaultProps} />);

    expect(screen.getByText(/\$50\/mo/)).toBeInTheDocument();
  });

  it("renders Continue to Checkout button", () => {
    render(<PlanSelector {...defaultProps} />);

    expect(screen.getByText("Continue to Checkout")).toBeInTheDocument();
  });

  it("calls onSubmit with selected plan when checkout is clicked", async () => {
    const onSubmit = vi.fn();
    render(<PlanSelector {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByText("Continue to Checkout"));

    expect(onSubmit).toHaveBeenCalledWith("starter", 0);
  });

  it("calls onSubmit with additional profiles", async () => {
    const onSubmit = vi.fn();
    render(<PlanSelector {...defaultProps} onSubmit={onSubmit} />);

    const plusBtn = screen.getByText("svg-plus");
    await userEvent.click(plusBtn);
    await userEvent.click(plusBtn);

    await userEvent.click(screen.getByText("Continue to Checkout"));

    expect(onSubmit).toHaveBeenCalledWith("starter", 2);
  });

  it("resets additional profiles when plan changes", async () => {
    const onSubmit = vi.fn();
    render(<PlanSelector {...defaultProps} onSubmit={onSubmit} />);

    // Add some profiles
    const plusBtn = screen.getByText("svg-plus");
    await userEvent.click(plusBtn);
    await userEvent.click(plusBtn);

    // Switch to Pro — this resets profiles to 0
    await userEvent.click(screen.getByText("Pro"));

    await userEvent.click(screen.getByText("Continue to Checkout"));

    expect(onSubmit).toHaveBeenCalledWith("pro", 0);
  });

  it("shows addOnPrice per additional profile", () => {
    render(<PlanSelector {...defaultProps} />);

    expect(screen.getByText(/\+\$20\/mo each/)).toBeInTheDocument();
  });

  it("updates total price when profiles are added", async () => {
    render(<PlanSelector {...defaultProps} />);

    const plusBtn = screen.getByText("svg-plus");
    await userEvent.click(plusBtn);

    // Starter is $50 + 1 * $20 = $70
    expect(screen.getByText(/\$70\/mo/)).toBeInTheDocument();
  });
});
