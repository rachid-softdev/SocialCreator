// @vitest-environment jsdom
/**
 * Smoke tests for the Landing page (src/app/page.tsx)
 *
 * Verifies:
 * - The page renders without crashing
 * - Key sections (hero, features) are present
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "../page";

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

// Mock UI components used by the landing page
vi.mock("@socialcreator/ui/feature-card", () => ({
  FeatureCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="feature-card">{children}</div>
  ),
}));

vi.mock("@socialcreator/ui/gradient-orb", () => ({
  GradientOrb: () => <div data-testid="gradient-orb" />,
}));

vi.mock("@socialcreator/ui/nav-top", () => ({
  NavTop: ({ links }: { links: { label: string }[] }) => (
    <nav data-testid="nav-top">
      {links.map((link) => (
        <span key={link.label}>{link.label}</span>
      ))}
    </nav>
  ),
}));

describe("Landing page (Home)", () => {
  it("renders without crashing", () => {
    render(<Home />);

    expect(screen.getByText(/social content/i)).toBeInTheDocument();
    expect(screen.getByText(/written by AI/i)).toBeInTheDocument();
  });

  it("renders the features section", () => {
    render(<Home />);

    expect(screen.getByText("AI-Powered Content")).toBeInTheDocument();
    expect(screen.getByText("Multi-Platform")).toBeInTheDocument();
    expect(screen.getByText("Smart Scheduling")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Home />);

    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Docs")).toBeInTheDocument();
  });

  it("renders CTA buttons", () => {
    render(<Home />);

    const ctas = screen.getAllByText("Get Started");
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("See How It Works")).toBeInTheDocument();
  });
});
