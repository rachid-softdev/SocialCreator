/**
 * Tests for TodayScheduleList component
 *
 * Verifies:
 * - Renders sorted events for today
 * - Empty state when no events for today
 * - Time formatting (HH:mm)
 * - Platform badges
 * - Truncated text content
 * - Events are sorted by time ascending
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { TodayScheduleList } from "../today-schedule-list";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Calendar: ({ className }: any) => (
    <span data-testid="icon-calendar" className={className}>
      svg-calendar
    </span>
  ),
}));

// ── Helper ────────────────────────────────────────────────────────────

function todayAt(hours: number, minutes: number): string {
  const now = new Date();
  now.setHours(hours, minutes, 0, 0);
  return now.toISOString();
}

// ── Fixtures ──────────────────────────────────────────────────────────

const todayEvents = [
  {
    id: "event-1",
    title: "Morning Post",
    textContent: "Good morning everyone! This is a test post for today's schedule.",
    platform: "X",
    status: "SCHEDULED",
    scheduledAt: todayAt(9, 0),
  },
  {
    id: "event-2",
    title: "Afternoon Update",
    textContent: "Afternoon update for our followers with some exciting news.",
    platform: "INSTAGRAM",
    status: "SCHEDULED",
    scheduledAt: todayAt(14, 30),
  },
  {
    id: "event-3",
    title: "Evening Summary",
    textContent: "Evening summary of today's activities and what to expect tomorrow.",
    platform: "LINKEDIN",
    status: "DRAFT",
    scheduledAt: todayAt(18, 0),
  },
];

const nonTodayEvents = [
  {
    id: "event-past",
    title: "Yesterday",
    textContent: "Yesterday's post",
    platform: "X",
    status: "PUBLISHED",
    scheduledAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  },
  {
    id: "event-future",
    title: "Tomorrow",
    textContent: "Tomorrow's post",
    platform: "FACEBOOK",
    status: "SCHEDULED",
    scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
  },
];

// ── Tests ─────────────────────────────────────────────────────────────

describe("TodayScheduleList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the section title", () => {
    render(<TodayScheduleList events={todayEvents} />);

    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
  });

  it("renders all today events sorted by time", () => {
    render(<TodayScheduleList events={todayEvents} />);

    const timeElements = screen.getAllByText(/^\d{2}:\d{2}$/);
    expect(timeElements.length).toBe(3);
  });

  it("renders platform badges for each event", () => {
    render(<TodayScheduleList events={todayEvents} />);

    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("INSTAGRAM")).toBeInTheDocument();
    expect(screen.getByText("LINKEDIN")).toBeInTheDocument();
  });

  it("renders event text content truncated", () => {
    render(<TodayScheduleList events={todayEvents} />);

    expect(screen.getByText(/Good morning everyone/)).toBeInTheDocument();
    expect(screen.getByText(/Afternoon update/)).toBeInTheDocument();
  });

  it("sorts events by time ascending", () => {
    render(<TodayScheduleList events={todayEvents} />);

    const timeElements = screen.getAllByText(/^\d{2}:\d{2}$/);
    const times = timeElements.map((el) => el.textContent);

    // Times should be sorted: 09:00, 14:30, 18:00
    expect(times).toEqual(["09:00", "14:30", "18:00"]);
  });

  it("shows empty state with calendar icon when no events for today", () => {
    render(<TodayScheduleList events={nonTodayEvents} />);

    expect(screen.getByText("No items scheduled for today")).toBeInTheDocument();
    expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
  });

  it("does not show non-today events", () => {
    render(<TodayScheduleList events={[...todayEvents, ...nonTodayEvents]} />);

    // Should only show 3 today events, not the non-today ones
    const timeElements = screen.getAllByText(/^\d{2}:\d{2}$/);
    expect(timeElements.length).toBe(3);
  });

  it("shows empty state when events array is empty", () => {
    render(<TodayScheduleList events={[]} />);

    expect(screen.getByText("No items scheduled for today")).toBeInTheDocument();
  });

  it("shows empty state when all events are non-today", () => {
    render(<TodayScheduleList events={nonTodayEvents} />);

    expect(screen.getByText("No items scheduled for today")).toBeInTheDocument();
  });

  it("truncates text longer than 80 characters", () => {
    const longTextEvent = {
      id: "event-long",
      title: "Long Post",
      textContent:
        "This is an extremely long text that should definitely be truncated because it " +
        "exceeds the eighty character maximum limit that is set in the component for " +
        "display purposes within the list.",
      platform: "X",
      status: "SCHEDULED",
      scheduledAt: todayAt(12, 0),
    };

    render(<TodayScheduleList events={[longTextEvent]} />);

    // The text should be truncated with ...
    const textElement = screen.getByText(/\.\.\.$/);
    expect(textElement).toBeInTheDocument();
  });

  it("renders 'Untitled' when textContent and title are empty", () => {
    const blankEvent = {
      id: "event-blank",
      title: "",
      textContent: "",
      platform: "X",
      status: "DRAFT",
      scheduledAt: todayAt(10, 0),
    };

    render(<TodayScheduleList events={[blankEvent]} />);

    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });
});
