/**
 * Tests for AppShell component
 *
 * Verifies:
 * - Renders children within an ErrorBoundary
 * - Registers keyboard event listener for ? and Cmd+/
 * - Cleans up event listener on unmount
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/components/__tests__/test-utils";
import { AppShell } from "@/components/app-shell";

// ── Hoisted factories ─────────────────────────────────────────────────

const mockCommandPalette = vi.hoisted(() => vi.fn((_props: any) => null));
const mockKeyboardShortcuts = vi.hoisted(() => vi.fn((_props: any) => null));
const mockErrorBoundary = vi.hoisted(() => ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
));

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@/components/command-palette", () => ({
  CommandPalette: mockCommandPalette,
}));

vi.mock("@/components/keyboard-shortcuts", () => ({
  KeyboardShortcuts: mockKeyboardShortcuts,
}));

vi.mock("@/components/error-boundary", () => ({
  default: mockErrorBoundary,
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    expect(screen.getByText("Test child")).toBeInTheDocument();
  });

  it("renders CommandPalette", () => {
    render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    expect(mockCommandPalette).toHaveBeenCalled();
  });

  it("renders KeyboardShortcuts with open=false initially", () => {
    render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    expect(mockKeyboardShortcuts.mock.calls[0]![0]!).toMatchObject({ open: false });
  });

  it("attaches keydown listener on mount", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");

    const { unmount } = render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();
    addEventListenerSpy.mockRestore();
  });

  it("removes keydown listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it("opens keyboard shortcuts when ? key is pressed (not in input)", () => {
    render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    mockKeyboardShortcuts.mockClear();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    });

    const lastCall = mockKeyboardShortcuts.mock.calls.length - 1;
    expect(mockKeyboardShortcuts.mock.calls[lastCall]![0]!).toMatchObject({ open: true });
  });

  it("opens keyboard shortcuts when Cmd+/ is pressed", () => {
    render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    mockKeyboardShortcuts.mockClear();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    });

    const lastCall = mockKeyboardShortcuts.mock.calls.length - 1;
    expect(mockKeyboardShortcuts.mock.calls[lastCall]![0]!).toMatchObject({ open: true });
  });

  it("toggles keyboard shortcuts on repeated ? presses", () => {
    render(
      <AppShell>
        <p>Test child</p>
      </AppShell>,
    );

    mockKeyboardShortcuts.mockClear();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    });
    const callsAfterFirst = mockKeyboardShortcuts.mock.calls.length;
    expect(mockKeyboardShortcuts.mock.calls[callsAfterFirst - 1]![0]!).toMatchObject({
      open: true,
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    });
    expect(
      mockKeyboardShortcuts.mock.calls[mockKeyboardShortcuts.mock.calls.length - 1]![0]!,
    ).toMatchObject({ open: false });
  });

  it("does not toggle shortcuts when key is pressed inside an input element", () => {
    render(
      <AppShell>
        <input data-testid="test-input" />
      </AppShell>,
    );

    mockKeyboardShortcuts.mockClear();

    act(() => {
      const input = screen.getByTestId("test-input");
      // Dispatch on the input element — it bubbles to document with e.target === input
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "?",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    // open should remain false since target is an input, so KeyboardShortcuts should not have been called again
    expect(mockKeyboardShortcuts).not.toHaveBeenCalled();
  });
});
