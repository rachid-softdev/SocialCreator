// @vitest-environment jsdom
/**
 * Smoke tests for the Pricing page (src/app/(main)/pricing/page.tsx)
 *
 * Verifies:
 * - The page renders without crashing
 * - Key sections (heading, FAQ) are present
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PricingPage from "../page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@socialcreator/ui/gradient-orb", () => ({
  GradientOrb: () => <div data-testid="gradient-orb" />,
}));

vi.mock("@/components/billing/pricing-table", () => ({
  PricingTable: () => <div data-testid="pricing-table" />,
}));

describe("PricingPage", () => {
  it("renders without crashing", async () => {
    const Component = await PricingPage();
    render(Component);

    expect(screen.getByText(/simple, transparent pricing/i)).toBeInTheDocument();
  });

  it("renders the pricing table", async () => {
    const Component = await PricingPage();
    render(Component);

    expect(screen.getByTestId("pricing-table")).toBeInTheDocument();
  });

  it("renders FAQ section", async () => {
    const Component = await PricingPage();
    render(Component);

    expect(screen.getByText(/frequently asked questions/i)).toBeInTheDocument();
    expect(screen.getByText(/Can I change plans later/i)).toBeInTheDocument();
    expect(screen.getByText(/What payment methods do you accept/i)).toBeInTheDocument();
  });

  it("renders features comparison section", async () => {
    const Component = await PricingPage();
    render(Component);

    expect(screen.getByText(/Everything you need to scale/i)).toBeInTheDocument();
    expect(screen.getByText(/Multiple profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-powered agents/i)).toBeInTheDocument();
  });
});
