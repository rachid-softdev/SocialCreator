/**
 * Tests for KeyboardShortcuts component
 *
 * Verifies:
 * - Returns null when open=false
 * - Renders dialog when open=true
 * - Closes on Escape key press
 * - Renders all shortcut groups (Navigation, Actions, General)
 * - Renders shortcut keys and descriptions
 * - Closes on backdrop click
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/components/__tests__/test-utils";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Keyboard: ({ className }: any) => (
    <span data-testid="icon-keyboard" className={className}>
      svg-keyboard
    </span>
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("KeyboardShortcuts", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when closed", () => {
    const { container } = render(<KeyboardShortcuts open={false} onClose={onClose} />);

    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog when open", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("renders the keyboard icon", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByTestId("icon-keyboard")).toBeInTheDocument();
  });

  it("renders all shortcut groups", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
  });

  it("renders shortcut descriptions for Navigation group", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Profiles")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it("renders shortcut descriptions for Actions group", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByText("Command palette")).toBeInTheDocument();
    expect(screen.getByText("Show this help")).toBeInTheDocument();
  });

  it("renders shortcut descriptions for General group", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByText("Navigate lists")).toBeInTheDocument();
    expect(screen.getByText("Select / Open")).toBeInTheDocument();
    expect(screen.getByText("Close modal")).toBeInTheDocument();
  });

  it("renders Esc close hint in the footer", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not respond to Escape when closed", () => {
    render(<KeyboardShortcuts open={false} onClose={onClose} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    const backdrop = screen.getByLabelText("Close keyboard shortcuts");
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders shortcut key combinations", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    // Check that kbd elements exist for various shortcuts
    const kbdElements = document.querySelectorAll("kbd");
    expect(kbdElements.length).toBeGreaterThan(0);

    // Should have at least one kbd with ⌘
    const cmdKbds = Array.from(kbdElements).filter((kbd) => kbd.textContent === "⌘");
    expect(cmdKbds.length).toBeGreaterThan(0);
  });

  it("applies correct aria attributes", () => {
    render(<KeyboardShortcuts open={true} onClose={onClose} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("cleans up event listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(<KeyboardShortcuts open={true} onClose={onClose} />);
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
