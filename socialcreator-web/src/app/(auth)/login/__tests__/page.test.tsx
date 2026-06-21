// @vitest-environment jsdom
/**
 * Smoke tests for the Login page (src/app/(auth)/login/page.tsx)
 *
 * Verifies:
 * - The page renders without crashing
 * - Key sections (heading, form area) are present
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "../page";

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

// Mock LoginForm to avoid useRouter/useSearchParams dependencies
vi.mock("@/components/auth/login-form", () => ({
  LoginForm: () => <div data-testid="login-form" />,
}));

describe("LoginPage", () => {
  it("renders without crashing", () => {
    render(<LoginPage />);

    expect(screen.getByText(/welcome back to socialcreator/i)).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("renders the login form heading", () => {
    render(<LoginPage />);

    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(
      screen.getByText(/welcome back.*sign in to pick up where you left off/i),
    ).toBeInTheDocument();
  });

  it("renders the login form slot", () => {
    render(<LoginPage />);

    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("renders a link to register", () => {
    render(<LoginPage />);

    const registerLink = screen.getByText(/create one/i);
    expect(registerLink).toBeInTheDocument();
    expect(registerLink.closest("a")).toHaveAttribute("href", "/register");
  });
});
