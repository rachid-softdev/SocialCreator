// @vitest-environment jsdom
/**
 * Smoke tests for the Video page (src/app/(main)/video/page.tsx)
 *
 * Verifies:
 * - The page renders without crashing
 * - Key sections (header, filters) are present
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AllVideosPage from "../page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("AllVideosPage", () => {
  it("renders without crashing", () => {
    render(<AllVideosPage />);

    expect(screen.getByText("All Videos")).toBeInTheDocument();
    expect(screen.getByText(/manage your video library/i)).toBeInTheDocument();
  });

  it("renders the new video button", () => {
    render(<AllVideosPage />);

    expect(screen.getByText("New Video")).toBeInTheDocument();
  });

  it("renders status filter buttons", () => {
    render(<AllVideosPage />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders view mode toggle buttons", () => {
    render(<AllVideosPage />);

    const buttons = screen.getAllByRole("button");
    // Should have at least: New Video button, 7 status filter buttons, 2 view toggle buttons
    expect(buttons.length).toBeGreaterThanOrEqual(9);
  });
});
