/**
 * Tests for SchedulePanel component.
 *
 * Tests date picker, timezone selection, validation,
 * schedule and cancel actions.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { SchedulePanel } from "../schedule-panel";

// ── Hoisted mocks ────────────────────────────────────────────────────────

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  formatDateTime: vi.fn(() => "Jun 15, 2025, 2:00 PM"),
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: "svg-alert-circle",
  Calendar: "svg-calendar",
  Clock: "svg-clock",
  Loader2: "svg-loader",
  X: "svg-x",
  Globe: "svg-globe",
}));

// Mock DateTimePicker
vi.mock("../date-time-picker", () => ({
  DateTimePicker: ({ value, onChange, minDate }: any) => (
    <div data-testid="date-time-picker">
      <input
        type="date"
        data-testid="mock-date-input"
        value={value ? value.toISOString().split("T")[0] : ""}
        onChange={(e) => {
          if (e.target.value) {
            onChange(new Date(`${e.target.value}T12:00:00Z`));
          } else {
            onChange(null);
          }
        }}
        min={minDate ? minDate.toISOString().split("T")[0] : undefined}
      />
      <span>DateTimePicker</span>
    </div>
  ),
}));

// Mock TimezoneSelect
vi.mock("../timezone-select", () => ({
  TimezoneSelect: ({ value, onChange }: any) => (
    <select data-testid="timezone-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="UTC">UTC</option>
      <option value="America/New_York">America/New_York</option>
    </select>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("SchedulePanel", () => {
  const onScheduled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("shows schedule form in idle state", () => {
    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    expect(screen.getByText("Schedule Publication")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("renders DateTimePicker component", () => {
    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    expect(screen.getByTestId("date-time-picker")).toBeInTheDocument();
  });

  it("renders TimezoneSelect component", () => {
    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    expect(screen.getByTestId("timezone-select")).toBeInTheDocument();
  });

  it("schedule button is disabled when no date is selected", () => {
    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    const scheduleButton = screen.getByText("Schedule");
    expect(scheduleButton).toBeDisabled();
  });

  it("schedule button is enabled when a date is selected", async () => {
    const user = userEvent.setup();
    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    // Set a date via the mocked DateTimePicker
    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");

    const scheduleButton = screen.getByText("Schedule");
    expect(scheduleButton).not.toBeDisabled();
  });

  it("calls schedule API and fires onScheduled on success", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    // Set date and timezone
    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");

    const tzSelect = screen.getByTestId("timezone-select");
    await user.selectOptions(tzSelect, "America/New_York");

    // Click schedule
    await user.click(screen.getByText("Schedule"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/content/content-1/schedule",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("scheduledPublishAt"),
      }),
    );

    await waitFor(() => {
      expect(onScheduled).toHaveBeenCalled();
    });
  });

  it("shows scheduled state after successful scheduling", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");

    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Scheduled for publication")).toBeInTheDocument();
    });

    // Shows formatted date and timezone
    expect(screen.getByText(/Jun 15, 2025, 2:00 PM/)).toBeInTheDocument();
  });

  it("shows cancel schedule button in scheduled state", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");

    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Cancel Schedule")).toBeInTheDocument();
    });
  });

  it("calls cancel API when Cancel Schedule is clicked", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    // Schedule first
    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");
    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Cancel Schedule")).toBeInTheDocument();
    });

    // Cancel
    await user.click(screen.getByText("Cancel Schedule"));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/content/content-1/schedule",
      expect.objectContaining({ method: "DELETE" }),
    );

    await waitFor(() => {
      expect(onScheduled).toHaveBeenCalledTimes(2);
    });
  });

  it("shows initial scheduled state when initialSchedule has data", () => {
    render(
      <SchedulePanel
        contentId="content-1"
        initialSchedule={{
          scheduledPublishAt: "2025-12-25T14:00:00.000Z",
          scheduledTimezone: "America/New_York",
        }}
        onScheduled={onScheduled}
      />,
    );

    expect(screen.getByText("Scheduled for publication")).toBeInTheDocument();
    expect(screen.getByText("Cancel Schedule")).toBeInTheDocument();
  });

  it("shows error message when schedule API fails", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Past dates not allowed" }),
    });

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");

    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Past dates not allowed")).toBeInTheDocument();
    });
  });

  it("shows submitting state while scheduling", async () => {
    const user = userEvent.setup();
    // Never-resolving promise to keep submitting state
    (globalThis.fetch as any).mockImplementationOnce(() => new Promise(() => {}));

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");

    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Scheduling...")).toBeInTheDocument();
    });
  });

  it("shows cancelling state while cancelling", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockImplementationOnce(() => new Promise(() => {}));

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    // Schedule first
    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");
    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Cancel Schedule")).toBeInTheDocument();
    });

    // Try to cancel (will hang)
    await user.click(screen.getByText("Cancel Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Cancelling schedule...")).toBeInTheDocument();
    });
  });

  it("shows error when cancel API fails", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Cannot cancel: already published" }),
      });

    render(
      <SchedulePanel contentId="content-1" initialSchedule={null} onScheduled={onScheduled} />,
    );

    const dateInput = screen.getByTestId("mock-date-input");
    await user.type(dateInput, "2025-12-25");
    await user.click(screen.getByText("Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Cancel Schedule")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Cancel Schedule"));

    await waitFor(() => {
      expect(screen.getByText("Cannot cancel: already published")).toBeInTheDocument();
    });
  });
});
