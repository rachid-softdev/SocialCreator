/**
 * Tests for LoginForm component
 *
 * Verifies:
 * - Renders email/password inputs and sign in button
 * - Shows error message on failed login
 * - Calls signIn("credentials") on submit with email/password
 * - Loading state disables submit button
 * - "Signing in..." text appears when loading
 * - Google OAuth button calls signIn("google")
 * - Error alert has role="alert"
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { LoginForm } from "../login-form";

// ── Module-level mocks ───────────────────────────────────────────────

const mockSignIn = vi.hoisted(() => vi.fn());
const mockUseRouter = vi.hoisted(() => vi.fn(() => ({ push: vi.fn() })));
const mockUseSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams("")));

vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter,
  useSearchParams: mockUseSearchParams,
}));

vi.mock("next-auth/react", () => ({
  signIn: mockSignIn,
}));

vi.mock("@/components/auth/oauth-button", () => ({
  OAuthButton: ({
    children,
    onClick,
    isLoading,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    isLoading?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={isLoading} data-testid="oauth-button">
      {children}
    </button>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password inputs and sign in button", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("shows error message on failed login", async () => {
    mockSignIn.mockResolvedValueOnce({ error: "Invalid credentials" });

    render(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("calls signIn('credentials') on submit with email and password", async () => {
    const mockFetch = vi.hoisted(() => vi.fn());
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ cguAccepted: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockSignIn.mockResolvedValueOnce({ error: null });

    render(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "test@example.com",
      password: "correct-password",
    });

    vi.unstubAllGlobals();
  });

  it("shows loading state and disables submit button during submission", async () => {
    // Keep signIn pending to test loading state
    mockSignIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ error: null }), 1000);
        }),
    );

    render(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    // Button should show "Signing in..." and be disabled
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
  });

  it('shows "Signing in..." text when loading', async () => {
    mockSignIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ error: null }), 1000);
        }),
    );

    render(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText("Signing in...")).toBeInTheDocument();
  });

  it("calls signIn('google') when Google OAuth button is clicked", async () => {
    render(<LoginForm />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("oauth-button"));

    expect(mockSignIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/api/auth/cgu-redirect",
    });
  });

  it("error alert has role='alert'", async () => {
    mockSignIn.mockResolvedValueOnce({ error: "Invalid credentials" });

    render(<LoginForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
