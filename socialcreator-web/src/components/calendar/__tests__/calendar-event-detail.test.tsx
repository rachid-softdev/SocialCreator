/**
 * Tests for CalendarEventDetail component
 *
 * Verifies:
 * - Renders popover with event text content
 * - Displays platform and status badges
 * - Shows formatted scheduled time
 * - Expanded state for long content
 * - Outside click closes the popover
 * - Escape key closes the popover
 * - Link to content editor
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/components/__tests__/test-utils";
import { CalendarEventDetail } from "../calendar-event-detail";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ExternalLink: ({ className }: any) => (
    <span data-testid="icon-external-link" className={className}>
      svg-external-link
    </span>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="next-link">
      {children}
    </a>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────

const baseEvent = {
  id: "event-1",
  title: "Test Event",
  textContent: "This is the content of the event for testing purposes.",
  platform: "X",
  status: "SCHEDULED",
  scheduledAt: "2025-07-15T14:30:00Z",
};

const longTextContent =
  "This is a very long text content that exceeds the maximum preview character limit " +
  "of one hundred characters. It should be truncated with an ellipsis and a show more button " +
  "should appear to allow expanding the full content. This text is intentionally long.";

const longEvent = {
  ...baseEvent,
  id: "event-2",
  textContent: longTextContent,
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("CalendarEventDetail", () => {
  const onClose = vi.fn();
  const position = { top: 100, left: 200 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the event text content", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    expect(
      screen.getByText("This is the content of the event for testing purposes."),
    ).toBeInTheDocument();
  });

  it("renders the platform badge", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("renders the status badge", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    expect(screen.getByText("SCHEDULED")).toBeInTheDocument();
  });

  it("renders formatted scheduled time", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    // format with date-fns: "MMM d, yyyy 'at' h:mm a"
    expect(screen.getByText(/Jul 15, 2025/)).toBeInTheDocument();
  });

  it("renders link to content editor with correct href", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    const link = screen.getByTestId("next-link");
    expect(link).toHaveAttribute("href", "/content/event-1");
  });

  it("renders external link icon", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    expect(screen.getByTestId("icon-external-link")).toBeInTheDocument();
  });

  it("renders 'View full content' link text", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    expect(screen.getByText("View full content")).toBeInTheDocument();
  });

  it("truncates long text and shows 'Show more' button", () => {
    render(<CalendarEventDetail event={longEvent} onClose={onClose} position={position} />);

    expect(screen.getByText("Show more")).toBeInTheDocument();
    // The text should end with ...
    const textElement = screen.getByText(/\.\.\.$/);
    expect(textElement).toBeInTheDocument();
  });

  it("expands content when 'Show more' is clicked", async () => {
    const user = userEvent.setup();
    render(<CalendarEventDetail event={longEvent} onClose={onClose} position={position} />);

    await user.click(screen.getByText("Show more"));

    // After expansion, full text should be visible
    expect(screen.getByText(longTextContent)).toBeInTheDocument();
    // Button should now say "Show less"
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("collapses content when 'Show less' is clicked", async () => {
    const user = userEvent.setup();
    render(<CalendarEventDetail event={longEvent} onClose={onClose} position={position} />);

    await user.click(screen.getByText("Show more"));
    expect(screen.getByText("Show less")).toBeInTheDocument();

    await user.click(screen.getByText("Show less"));
    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("does not show expand button for short text", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    expect(screen.queryByText("Show more")).not.toBeInTheDocument();
    expect(screen.queryByText("Show less")).not.toBeInTheDocument();
  });

  it("calls onClose when clicking outside the popover", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    // Click outside the popover
    act(() => {
      const mousedownEvent = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(mousedownEvent);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the popover", async () => {
    const user = userEvent.setup();
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    // Click inside the popover
    const text = screen.getByText("This is the content of the event for testing purposes.");
    await user.click(text);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("positions the popover at the given coordinates", () => {
    render(
      <CalendarEventDetail
        event={baseEvent}
        onClose={onClose}
        position={{ top: 150, left: 300 }}
      />,
    );

    const popover = screen
      .getByText("This is the content of the event for testing purposes.")
      .closest(".absolute");
    expect(popover).toBeInTheDocument();
  });

  it("renders 'Untitled' when textContent and title are empty", () => {
    const blankEvent = {
      ...baseEvent,
      textContent: "",
      title: "",
    };

    render(<CalendarEventDetail event={blankEvent} onClose={onClose} position={position} />);

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("renders status with correct color for SCHEDULED", () => {
    render(<CalendarEventDetail event={baseEvent} onClose={onClose} position={position} />);

    const statusBadge = screen.getByText("SCHEDULED");
    expect(statusBadge.className).toContain("blue");
  });

  it("renders status with correct color for FAILED", () => {
    const failedEvent = { ...baseEvent, status: "FAILED" };

    render(<CalendarEventDetail event={failedEvent} onClose={onClose} position={position} />);

    const statusBadge = screen.getByText("FAILED");
    expect(statusBadge.className).toContain("red");
  });

  it("renders status with correct color for PUBLISHED", () => {
    const publishedEvent = { ...baseEvent, status: "PUBLISHED" };

    render(<CalendarEventDetail event={publishedEvent} onClose={onClose} position={position} />);

    const statusBadge = screen.getByText("PUBLISHED");
    expect(statusBadge.className).toContain("green");
  });
});
