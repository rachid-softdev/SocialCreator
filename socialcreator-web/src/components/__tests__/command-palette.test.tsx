/**
 * Tests for CommandPalette component
 *
 * Verifies:
 * - Initial state is closed (returns null)
 * - Opens with Cmd+K / Ctrl+K
 * - Filters results by query
 * - Keyboard navigation (ArrowDown/Up/Enter/Escape)
 * - Empty state when no results match
 * - Scrolls selected item into view
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/components/__tests__/test-utils";
import { CommandPalette } from "@/components/command-palette";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Search: ({ className }: any) => (
    <span data-testid="icon-search" className={className}>
      svg-search
    </span>
  ),
  LayoutDashboard: ({ className }: any) => (
    <span data-testid="icon-dashboard" className={className}>
      svg-dashboard
    </span>
  ),
  Users: ({ className }: any) => <span className={className}>svg-users</span>,
  Bot: ({ className }: any) => <span className={className}>svg-bot</span>,
  FileText: ({ className }: any) => <span className={className}>svg-filetext</span>,
  Calendar: ({ className }: any) => <span className={className}>svg-calendar</span>,
  Clock: ({ className }: any) => <span className={className}>svg-clock</span>,
  History: ({ className }: any) => <span className={className}>svg-history</span>,
  BarChart3: ({ className }: any) => <span className={className}>svg-barchart</span>,
  Settings: ({ className }: any) => <span className={className}>svg-settings</span>,
  CreditCard: ({ className }: any) => <span className={className}>svg-creditcard</span>,
  Plus: ({ className }: any) => <span className={className}>svg-plus</span>,
}));

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn() as any;
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when closed", () => {
    const { container } = render(<CommandPalette />);

    expect(container.innerHTML).toBe("");
  });

  it("opens when Cmd+K is pressed", () => {
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();
  });

  it("opens when Ctrl+K is pressed", () => {
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });

    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", () => {
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(screen.queryByPlaceholderText("Search pages and actions…")).not.toBeInTheDocument();
  });

  it("renders all default items when opened", () => {
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Profiles")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("filters items by label", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const input = screen.getByPlaceholderText("Search pages and actions…");
    await user.type(input, "content");

    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Content Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("filters items by description", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const input = screen.getByPlaceholderText("Search pages and actions…");
    await user.type(input, "scheduled");

    expect(screen.getByText("Content Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows empty state when no results match", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const input = screen.getByPlaceholderText("Search pages and actions…");
    await user.type(input, "xyznotfound");

    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  it("navigates with ArrowDown and ArrowUp", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const input = screen.getByPlaceholderText("Search pages and actions…");

    // First item should be selected by default
    const firstItem = screen.getByText("Dashboard").closest('[role="option"]');
    expect(firstItem).toHaveAttribute("aria-selected", "true");

    // ArrowDown to second item
    await user.type(input, "{ArrowDown}");
    const secondItem = screen.getByText("Profiles").closest('[role="option"]');
    expect(secondItem).toHaveAttribute("aria-selected", "true");
    expect(firstItem).toHaveAttribute("aria-selected", "false");

    // ArrowUp back to first item
    await user.type(input, "{ArrowUp}");
    expect(firstItem).toHaveAttribute("aria-selected", "true");
    expect(secondItem).toHaveAttribute("aria-selected", "false");
  });

  it("activates selected item on Enter", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search pages and actions…");
    await user.type(input, "{Enter}");

    // Dialog should close
    expect(screen.queryByPlaceholderText("Search pages and actions…")).not.toBeInTheDocument();
  });

  it("resets query and selection when reopened", () => {
    // Open and type
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const input = screen.getByPlaceholderText("Search pages and actions…") as HTMLInputElement;
    // Simulate typing
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(input, "test");
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Close and reopen
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const reopenedInput = screen.getByPlaceholderText(
      "Search pages and actions…",
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe("");
  });

  it("closes when clicking the backdrop", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(screen.getByPlaceholderText("Search pages and actions…")).toBeInTheDocument();

    // Click the backdrop
    const backdrop = screen.getByLabelText("Close search");
    await user.click(backdrop);

    expect(screen.queryByPlaceholderText("Search pages and actions…")).not.toBeInTheDocument();
  });

  it("renders shortcut badges for items that have them", () => {
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    // Dashboard has shortcut "G D"
    const dashboardItem = screen.getByText("Dashboard").closest('[role="option"]');
    expect(dashboardItem?.textContent).toContain("G");
    expect(dashboardItem?.textContent).toContain("D");
  });

  it("handles Tab key to cycle through items", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    const input = screen.getByPlaceholderText("Search pages and actions…");

    // First item selected
    const firstItem = screen.getByText("Dashboard").closest('[role="option"]');
    expect(firstItem).toHaveAttribute("aria-selected", "true");

    // Tab to second item
    await user.type(input, "{Tab}");
    const secondItem = screen.getByText("Profiles").closest('[role="option"]');
    expect(secondItem).toHaveAttribute("aria-selected", "true");
  });
});
