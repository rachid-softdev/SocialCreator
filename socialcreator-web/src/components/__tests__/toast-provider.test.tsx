/**
 * Tests for ToastProvider component
 *
 * Verifies:
 * - Renders Sonner Toaster with correct props
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ToastProvider } from "../toast-provider";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => (
    <div data-testid="sonner-toaster" data-props={JSON.stringify(props)} />
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("ToastProvider", () => {
  it("renders the Sonner Toaster component", () => {
    render(<ToastProvider />);

    expect(screen.getByTestId("sonner-toaster")).toBeInTheDocument();
  });

  it("passes position='bottom-right' to Sonner", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    const props = JSON.parse(toaster.getAttribute("data-props") || "{}");
    expect(props.position).toBe("bottom-right");
  });

  it("passes richColors=true to Sonner", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    const props = JSON.parse(toaster.getAttribute("data-props") || "{}");
    expect(props.richColors).toBe(true);
  });

  it("passes closeButton=true to Sonner", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    const props = JSON.parse(toaster.getAttribute("data-props") || "{}");
    expect(props.closeButton).toBe(true);
  });

  it("passes duration=5000 to Sonner", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    const props = JSON.parse(toaster.getAttribute("data-props") || "{}");
    expect(props.duration).toBe(5000);
  });

  it("passes toastOptions styling to Sonner", () => {
    render(<ToastProvider />);

    const toaster = screen.getByTestId("sonner-toaster");
    const props = JSON.parse(toaster.getAttribute("data-props") || "{}");
    expect(props.toastOptions).toBeDefined();
    expect(props.toastOptions.style).toBeDefined();
    expect(props.toastOptions.style.borderRadius).toBe("8px");
  });
});
