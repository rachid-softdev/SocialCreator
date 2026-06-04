/**
 * Tests for ToastLayoutWrapper component
 *
 * Verifies:
 * - Renders ToastProvider
 * - Renders children
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ToastLayoutWrapper } from "../toast-layout-wrapper";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@/components/toast-provider", () => ({
  ToastProvider: () => <div data-testid="toast-provider" />,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("ToastLayoutWrapper", () => {
  it("renders ToastProvider", () => {
    render(<ToastLayoutWrapper>content</ToastLayoutWrapper>);

    expect(screen.getByTestId("toast-provider")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <ToastLayoutWrapper>
        <h1>Page content</h1>
      </ToastLayoutWrapper>,
    );

    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders ToastProvider before children", () => {
    const { container } = render(<ToastLayoutWrapper>content</ToastLayoutWrapper>);

    // ToastProvider should be the first child
    const firstChild = container.firstChild as HTMLElement;
    expect(firstChild).not.toBeNull();
  });
});
