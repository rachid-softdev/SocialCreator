/**
 * Tests for Pagination component
 *
 * Verifies: page buttons, ellipsis, prev/next buttons, aria attributes,
 * "Showing X to Y of Z items" text, page number text, hidden when totalPages <= 1,
 * and getPageNumbers utility function.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { Pagination } from "../pagination";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── getPageNumbers utility (replicated from component) ───────────────────

/**
 * Replicates the internal getPageNumbers function from the Pagination component
 * for pure utility testing.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | -1)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | -1)[] = [];
  pages.push(1);

  if (currentPage > 3) {
    pages.push(-1);
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push(-1);
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

// ── Tests: getPageNumbers utility ────────────────────────────────────────

describe("getPageNumbers", () => {
  it("returns pages 1-5 when totalPages is 5", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns pages 1-7 when totalPages is 7", () => {
    expect(getPageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns correct sequence for first page with many pages", () => {
    const result = getPageNumbers(1, 20);
    expect(result[0]).toBe(1);
    expect(result).toContain(-1); // ellipsis somewhere
    expect(result[result.length - 1]).toBe(20);
  });

  it("returns correct sequence for a middle page", () => {
    const result = getPageNumbers(10, 20);
    // Expected: [1, -1, 9, 10, 11, -1, 20]
    expect(result).toEqual([1, -1, 9, 10, 11, -1, 20]);
  });

  it("returns correct sequence for the last page", () => {
    const result = getPageNumbers(20, 20);
    // Expected: [1, -1, 19, 20]
    expect(result).toEqual([1, -1, 19, 20]);
  });

  it("returns correct sequence for page 2 with many pages", () => {
    const result = getPageNumbers(2, 20);
    // Expected: [1, 2, 3, -1, 20]
    expect(result).toEqual([1, 2, 3, -1, 20]);
  });

  it("returns correct sequence for page 3 with many pages", () => {
    const result = getPageNumbers(3, 20);
    // Expected: [1, 2, 3, 4, -1, 20]
    expect(result).toEqual([1, 2, 3, 4, -1, 20]);
  });

  it("returns correct sequence for page totalPages-1", () => {
    const result = getPageNumbers(19, 20);
    // Expected: [1, -1, 18, 19, 20]
    expect(result).toEqual([1, -1, 18, 19, 20]);
  });
});

// ── Tests: Pagination component ─────────────────────────────────────────

describe("Pagination", () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 50,
    pageSize: 10,
    onPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page buttons 1-5 when totalPages <= 7", () => {
    render(<Pagination {...defaultProps} />);
    // Use getAllByText for "1" since it may appear in page label text too
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows ellipsis when there are many pages", () => {
    render(<Pagination {...defaultProps} totalPages={20} currentPage={10} />);
    // Should have ... markers
    const ellipsis = screen.getAllByText("...");
    expect(ellipsis.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Previous button with aria-label", () => {
    // Use currentPage=2 so Previous is enabled
    render(<Pagination {...defaultProps} currentPage={2} />);
    const prevBtn = screen.getByLabelText("Previous page");
    expect(prevBtn).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
  });

  it("disables Previous button on first page", () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  it("renders Next button with aria-label", () => {
    render(<Pagination {...defaultProps} />);
    const nextBtn = screen.getByLabelText("Next page");
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn).not.toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(<Pagination {...defaultProps} currentPage={5} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
  });

  it("calls onPageChange with page number when clicking a page button", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />);

    await user.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with currentPage + 1 when clicking Next", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} currentPage={2} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange with currentPage - 1 when clicking Previous", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText("Previous page"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("sets aria-current='page' on the current page button", () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    const page3Btn = screen.getByLabelText("Page 3");
    expect(page3Btn).toHaveAttribute("aria-current", "page");
  });

  it("does not set aria-current on non-current page buttons", () => {
    render(<Pagination {...defaultProps} currentPage={3} />);
    const page1Btn = screen.getByLabelText("Page 1");
    expect(page1Btn).not.toHaveAttribute("aria-current");
  });

  it("returns null (hidden) when totalPages <= 1", () => {
    const { container } = render(<Pagination {...defaultProps} totalPages={1} />);
    expect(container.innerHTML).toBe("");
  });

  it('renders correct "Showing X to Y of Z items" text', () => {
    render(<Pagination {...defaultProps} currentPage={2} totalItems={50} pageSize={10} />);
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 11 to 20 of 50 items");
  });

  it('renders correct "Showing" text for first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} totalItems={50} pageSize={10} />);
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 1 to 10 of 50 items");
  });

  it('renders correct "Showing" text for last page with fewer items', () => {
    render(<Pagination {...defaultProps} currentPage={5} totalItems={47} pageSize={10} />);
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 41 to 47 of 47 items");
  });

  it("renders 'Page X of Y' text", () => {
    render(<Pagination {...defaultProps} currentPage={3} totalPages={5} />);
    expect(screen.getByText("Page 3 of 5")).toBeInTheDocument();
  });

  it("renders Previous/Next buttons with aria-label attributes", () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByLabelText("Previous page")).toBeInTheDocument();
    expect(screen.getByLabelText("Next page")).toBeInTheDocument();
  });

  it("renders arrow icons for Previous and Next buttons", () => {
    const { container } = render(<Pagination {...defaultProps} />);
    // lucide ChevronLeft and ChevronRight render as SVGs
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("ellipsis items display '...' text", () => {
    render(<Pagination {...defaultProps} totalPages={20} currentPage={10} />);
    const ellipsisItems = screen.getAllByText("...");
    expect(ellipsisItems.length).toBeGreaterThanOrEqual(1);
  });

  it("each page button has correct aria-label", () => {
    render(<Pagination {...defaultProps} totalPages={3} />);
    expect(screen.getByLabelText("Page 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 3")).toBeInTheDocument();
  });

  it("does not call onPageChange when clicking Previous on first page", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} currentPage={1} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText("Previous page"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("does not call onPageChange when clicking Next on last page", async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText("Next page"));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
