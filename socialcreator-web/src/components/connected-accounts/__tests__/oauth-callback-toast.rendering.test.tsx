/**
 * Rendering test for OAuthCallbackToast component
 *
 * Verifies the component renders (returns null) and its effects
 * interact correctly with URL parameters.
 *
 * Note: Logic-level tests (error messages, toast contract) are in
 * oauth-callback-toast.test.ts — this file covers component lifecycle.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/components/__tests__/test-utils";
import { OAuthCallbackToast } from "../oauth-callback-toast";

// ── Module-level mocks ───────────────────────────────────────────────

const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("OAuthCallbackToast — rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<OAuthCallbackToast />);

    // Component returns null so container should be empty
    expect(container.innerHTML).toBe("");
  });

  it("calls toast.success when URL has connected=success", () => {
    // Set up window location with connected=success
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, search: "?connected=success" } as any;

    render(<OAuthCallbackToast />);

    expect(mockToastSuccess).toHaveBeenCalled();

    // Restore
    window.location = originalLocation as any;
  });

  it("does not throw when no URL params are present", () => {
    expect(() => render(<OAuthCallbackToast />)).not.toThrow();
  });

  it("returns null (renders nothing visible)", () => {
    const { container } = render(<OAuthCallbackToast />);

    // Component returns null so no DOM elements
    expect(container.firstChild).toBeNull();
  });
});
