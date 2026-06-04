/**
 * Tests for ReadingProgress component
 *
 * Verifies: initial progress is 0%, progress bar renders with correct
 * structure, and scroll updates the progress transform.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/components/__tests__/test-utils";
import { ReadingProgress } from "../reading-progress";

// ── Fixtures ─────────────────────────────────────────────────────────────

/**
 * Helper to simulate page scroll dimensions and scroll position.
 * jsdom does not implement layout, so we manually set scrollY and
 * documentElement scrollHeight/clientHeight.
 */
function setupScrollEnvironment(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(window, "scrollY", {
    value: 0,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: scrollHeight,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(document.documentElement, "clientHeight", {
    value: clientHeight,
    writable: true,
    configurable: true,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("ReadingProgress", () => {
  beforeEach(() => {
    setupScrollEnvironment(2000, 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the progress bar container", () => {
    const { container } = render(<ReadingProgress />);
    const progressBar = container.firstChild as HTMLElement;
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.className).toContain("fixed");
    expect(progressBar.className).toContain("top-0");
  });

  it("renders the inner progress element", () => {
    const { container } = render(<ReadingProgress />);
    const wrapper = container.firstChild as HTMLElement;
    const inner = wrapper.firstChild as HTMLElement;
    expect(inner).toBeInTheDocument();
    expect(inner.className).toContain("h-full");
  });

  it("initially has scaleX(0) transform (0% progress)", () => {
    const { container } = render(<ReadingProgress />);
    const wrapper = container.firstChild as HTMLElement;
    const inner = wrapper.firstChild as HTMLElement;
    expect(inner).toHaveStyle("transform: scaleX(0)");
  });

  it("updates progress on scroll event", async () => {
    const { container } = render(<ReadingProgress />);

    // Simulate scrolling halfway
    Object.defineProperty(window, "scrollY", {
      value: 500,
      writable: true,
      configurable: true,
    });

    window.dispatchEvent(new Event("scroll", { bubbles: true }));

    const wrapper = container.firstChild as HTMLElement;
    const inner = wrapper.firstChild as HTMLElement;
    // scrollable height = 2000 - 1000 = 1000, scrollTop = 500, progress = 50%
    await waitFor(() => {
      expect(inner).toHaveStyle("transform: scaleX(0.5)");
    });
  });

  it("clamps progress at 100% when scrolled past end", async () => {
    const { container } = render(<ReadingProgress />);

    Object.defineProperty(window, "scrollY", {
      value: 2000, // More than scrollable area
      writable: true,
      configurable: true,
    });

    window.dispatchEvent(new Event("scroll", { bubbles: true }));

    const wrapper = container.firstChild as HTMLElement;
    const inner = wrapper.firstChild as HTMLElement;
    await waitFor(() => {
      expect(inner).toHaveStyle("transform: scaleX(1)");
    });
  });

  it("clamps progress at 0% when scrolled above top", () => {
    const { container } = render(<ReadingProgress />);

    Object.defineProperty(window, "scrollY", {
      value: -50,
      writable: true,
      configurable: true,
    });

    window.dispatchEvent(new Event("scroll", { bubbles: true }));

    const wrapper = container.firstChild as HTMLElement;
    const inner = wrapper.firstChild as HTMLElement;
    expect(inner).toHaveStyle("transform: scaleX(0)");
  });

  it("handles zero scrollable height (no overflow)", () => {
    setupScrollEnvironment(500, 500);

    const { container } = render(<ReadingProgress />);

    Object.defineProperty(window, "scrollY", {
      value: 100,
      writable: true,
      configurable: true,
    });

    window.dispatchEvent(new Event("scroll", { bubbles: true }));

    const wrapper = container.firstChild as HTMLElement;
    const inner = wrapper.firstChild as HTMLElement;
    expect(inner).toHaveStyle("transform: scaleX(0)");
  });

  it("removes scroll event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ReadingProgress />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
