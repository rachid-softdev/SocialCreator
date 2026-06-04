/**
 * Tests for RegisterForm component
 *
 * Verifies:
 * - Renders registration fields (name, email, password, confirm password)
 * - Submit validates required fields and shows errors
 * - Loading state disables submit button
 * - Error display on registration failure
 * - Google OAuth button integration
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/components/__tests__/test-utils";
import { RegisterForm } from "../register-form";

// ── Module-level mocks ───────────────────────────────────────────────

const mockSignIn = vi.hoisted(() => vi.fn());
const mockUseRouter = vi.hoisted(() => vi.fn(() => ({ push: vi.fn() })));

vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter,
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

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all registration fields and the submit button", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("shows error when name is empty on submit", async () => {
    const { container } = render(<RegisterForm />);

    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required");
  });

  it("shows error when email is invalid on submit", async () => {
    const { container } = render(<RegisterForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter a valid email address",
    );
  });

  it("shows error when password is too short", async () => {
    const { container } = render(<RegisterForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 8 characters",
    );
  });

  it("shows error when passwords do not match", async () => {
    const { container } = render(<RegisterForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "different-password");
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match");
  });

  it("disables submit button and shows 'Creating account...' during loading", async () => {
    const mockFetch = vi.fn();
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({}),
              }),
            1000,
          );
        }),
    );
    vi.stubGlobal("fetch", mockFetch);

    mockSignIn.mockResolvedValueOnce({ error: null });

    render(<RegisterForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
    vi.unstubAllGlobals();
  });

  it("shows error alert when registration API fails", async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Email already in use" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<RegisterForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use");
    vi.unstubAllGlobals();
  });

  it("calls signIn('google') when Google OAuth button is clicked", async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("oauth-button"));

    expect(mockSignIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/onboarding/cgu",
    });
  });
});
