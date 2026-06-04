/**
 * Tests for CGUConsentForm component
 *
 * Verifies:
 * - Renders consent terms text
 * - Renders checkbox and confirm button
 * - Loading state disables submit button
 * - Error state displays alert
 * - Submit with unchecked checkbox shows error
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { CGUConsentForm } from "../cgu-consent-form";

// ── Module-level mocks ───────────────────────────────────────────────

const mockUseRouter = vi.hoisted(() => vi.fn(() => ({ push: vi.fn() })));

vi.mock("next/navigation", () => ({
  useRouter: mockUseRouter,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("CGUConsentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the consent terms text", () => {
    render(<CGUConsentForm />);

    expect(screen.getByText(/TERMS OF SERVICE ACCEPTANCE/i)).toBeInTheDocument();
  });

  it("renders checkbox and accept button", () => {
    render(<CGUConsentForm />);

    expect(screen.getByLabelText(/I confirm that I own/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept and Continue" })).toBeInTheDocument();
  });

  it("submit button is disabled when checkbox is unchecked", () => {
    render(<CGUConsentForm />);

    const submitButton = screen.getByRole("button", { name: "Accept and Continue" });
    expect(submitButton).toBeDisabled();
  });

  it("shows loading state when submitting", async () => {
    const mockFetch = vi.fn();
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ hasProfile: true }),
              }),
            1000,
          );
        }),
    );
    vi.stubGlobal("fetch", mockFetch);

    render(<CGUConsentForm />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/I confirm that I own/i));
    await user.click(screen.getByRole("button", { name: "Accept and Continue" }));

    expect(screen.getByRole("button", { name: "Accepting..." })).toBeDisabled();

    vi.unstubAllGlobals();
  });

  it("shows error when API call fails", async () => {
    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<CGUConsentForm />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/I confirm that I own/i));
    await user.click(screen.getByRole("button", { name: "Accept and Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");

    vi.unstubAllGlobals();
  });

  it("submit button becomes enabled when checkbox is checked", async () => {
    render(<CGUConsentForm />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/I confirm that I own/i));

    const submitButton = screen.getByRole("button", { name: "Accept and Continue" });
    expect(submitButton).toBeEnabled();
  });
});
