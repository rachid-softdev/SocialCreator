/**
 * Tests for SearchBar component
 *
 * Verifies: input renders, displays placeholder, onChange callback fires
 * after debounce, clear button appears and clears value,
 * search icon is present.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/components/__tests__/test-utils";
import { SearchBar } from "../search-bar";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the search input", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders the default placeholder text", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders a custom placeholder when provided", () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Find posts..." />);
    expect(screen.getByPlaceholderText("Find posts...")).toBeInTheDocument();
  });

  it("displays the initial value", () => {
    render(<SearchBar value="initial" onChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("initial");
  });

  it("renders the search icon", () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show clear button when value is empty", () => {
    render(<SearchBar value="" onChange={() => {}} />);
    // The clear button uses X icon; it should not be in the DOM
    const buttons = screen.queryAllByRole("button");
    const clearBtn = buttons.find((btn) => btn.closest(".absolute"));
    expect(clearBtn).toBeUndefined();
  });

  it("shows clear button when value is non-empty", () => {
    render(<SearchBar value="test" onChange={() => {}} />);
    // There should be a button for clearing
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("clears the input when clear button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchBar value="test" onChange={onChange} />);

    const clearBtn = screen.getByRole("button");
    await user.click(clearBtn);

    // onChange should be called with empty string
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("fires onChange after debounce when user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SearchBar value="" onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "hello");

    // Advance timers past the 300ms debounce
    vi.advanceTimersByTime(350);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("hello");
    });
  });

  it("updates local value when external value changes", () => {
    const { rerender } = render(<SearchBar value="old" onChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("old");

    rerender(<SearchBar value="new" onChange={() => {}} />);
    expect(input.value).toBe("new");
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <SearchBar value="" onChange={() => {}} className="custom-class" />,
    );
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("custom-class");
  });
});
