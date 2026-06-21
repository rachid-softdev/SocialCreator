// @vitest-environment jsdom
/**
 * Smoke tests for the Register page (src/app/(auth)/register/page.tsx)
 *
 * Verifies:
 * - The page renders without crashing
 * - Key sections (heading, form area) are present
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "../page";

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

// Mock RegisterForm component
vi.mock("@/components/auth/register-form", () => ({
  RegisterForm: () => <div data-testid="register-form" />,
}));

describe("RegisterPage", () => {
  it("renders without crashing", () => {
    render(<RegisterPage />);

    expect(screen.getByText(/join socialcreator/i)).toBeInTheDocument();
    expect(screen.getByText("Create Account")).toBeInTheDocument();
  });

  it("renders the register form", () => {
    render(<RegisterPage />);

    expect(screen.getByTestId("register-form")).toBeInTheDocument();
  });

  it("renders a link to sign in", () => {
    render(<RegisterPage />);

    const signInLink = screen.getByText(/sign in/i);
    expect(signInLink).toBeInTheDocument();
    expect(signInLink.closest("a")).toHaveAttribute("href", "/login");
  });
});
