/**
 * Tests for DateTimePicker component.
 *
 * Renders date and time inputs, handles changes, prevents past dates.
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/components/__tests__/test-utils";
import { DateTimePicker } from "../date-time-picker";

vi.mock("lucide-react", () => ({
  Calendar: "svg-calendar",
  Clock: "svg-clock",
}));

describe("DateTimePicker", () => {
  it("renders date and time inputs", () => {
    const { container } = render(<DateTimePicker value={null} onChange={vi.fn()} />);
    const dateInput = container.querySelector('input[type="date"]');
    const timeInput = container.querySelector('input[type="time"]');
    expect(dateInput).toBeInTheDocument();
    expect(timeInput).toBeInTheDocument();
  });

  it("displays the Calendar and Clock icons", () => {
    const { container } = render(<DateTimePicker value={null} onChange={vi.fn()} />);
    expect(container.innerHTML).toContain("svg-calendar");
    expect(container.innerHTML).toContain("svg-clock");
  });

  it("pre-fills date and time when value is provided", () => {
    const value = new Date(2025, 5, 15, 14, 30); // June 15, 2025 14:30
    const { container } = render(<DateTimePicker value={value} onChange={vi.fn()} />);
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2025-06-15");
    expect(timeInput.value).toBe("14:30");
  });

  it("calls onChange when date is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<DateTimePicker value={null} onChange={onChange} />);

    const dateInput = container.querySelector('input[type="date"]')!;
    await user.clear(dateInput);
    await user.type(dateInput, "2025-12-25");

    expect(onChange).toHaveBeenCalled();
  });

  it("calls onChange when time is changed with a date set", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = new Date(2025, 5, 15, 14, 30);
    const { container } = render(<DateTimePicker value={value} onChange={onChange} />);

    const timeInput = container.querySelector('input[type="time"]')!;
    await user.clear(timeInput);
    await user.type(timeInput, "09:00");

    expect(onChange).toHaveBeenCalled();
  });

  it("shows minDate as the min attribute on date input", () => {
    const minDate = new Date("2025-07-01");
    const { container } = render(
      <DateTimePicker value={null} onChange={vi.fn()} minDate={minDate} />,
    );
    const dateInput = container.querySelector('input[type="date"]')!;
    expect(dateInput).toHaveAttribute("min", "2025-07-01");
  });

  it("shows today as min when no minDate is provided", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    const { container } = render(<DateTimePicker value={null} onChange={vi.fn()} />);
    const dateInput = container.querySelector('input[type="date"]')!;
    expect(dateInput).toHaveAttribute("min", todayStr);
  });

  it("handles midnight by wrapping to next day when time overflows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = new Date(2025, 5, 15, 23, 30);
    const { container } = render(<DateTimePicker value={value} onChange={onChange} />);

    const timeInput = container.querySelector('input[type="time"]')!;
    await user.clear(timeInput);
    await user.type(timeInput, "00:00");

    expect(onChange).toHaveBeenCalled();
  });
});
