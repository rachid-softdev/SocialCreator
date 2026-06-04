/**
 * Tests for OAuthButton component
 *
 * Verifies:
 * - Renders children text
 * - Click triggers onClick prop
 * - Loading shows disabled state with spinner
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { OAuthButton } from "../oauth-button";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="lucide-loader2" {...props} />
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("OAuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children text", () => {
    render(<OAuthButton onClick={vi.fn()}>Continue with Google</OAuthButton>);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();

    render(<OAuthButton onClick={handleClick}>Sign in with Google</OAuthButton>);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows loading spinner and disables button when isLoading is true", () => {
    render(
      <OAuthButton onClick={vi.fn()} isLoading>
        Continue with Google
      </OAuthButton>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("lucide-loader2")).toBeInTheDocument();
  });

  it("renders children when loading (spinner replaces icon, text remains)", () => {
    render(
      <OAuthButton onClick={vi.fn()} isLoading>
        Signing in...
      </OAuthButton>,
    );

    expect(screen.getByText("Signing in...")).toBeInTheDocument();
    expect(screen.getByTestId("lucide-loader2")).toBeInTheDocument();
  });

  it("renders with variant outline class when specified", () => {
    render(
      <OAuthButton onClick={vi.fn()} variant="outline">
        Continue
      </OAuthButton>,
    );

    // Should have the outline variant styles
    const button = screen.getByRole("button");
    expect(button.className).toContain("border");
  });
});
