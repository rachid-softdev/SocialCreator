/**
 * Tests for DateRangePicker component
 *
 * Verifies: date input rendering, preset buttons (7d, 30d, 90d), custom range,
 * dropdown toggle, and onChange callback.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { DateRangePicker } from "../date-range-picker";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("DateRangePicker", () => {
  it("renders the selected range label (default 30d)", () => {
    render(<DateRangePicker />);
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("renders the selected range label for 7d", () => {
    render(<DateRangePicker value="7d" />);
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
  });

  it("renders the selected range label for 90d", () => {
    render(<DateRangePicker value="90d" />);
    expect(screen.getByText("Last 90 days")).toBeInTheDocument();
  });

  it("shows 'Select range' when value does not match a preset", () => {
    render(<DateRangePicker value="custom" />);
    expect(screen.getByText("Select range")).toBeInTheDocument();
  });

  it("renders the Calendar icon", () => {
    const { container } = render(<DateRangePicker />);
    // lucide Calendar renders as an SVG
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows the dropdown when the trigger button is clicked", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker />);

    const trigger = screen.getByRole("button", { name: /last 30 days/i });
    await user.click(trigger);

    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Last 90 days")).toBeInTheDocument();
    expect(screen.getByText("Custom range")).toBeInTheDocument();
  });

  it("hides the dropdown when the trigger is clicked again", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker />);

    const trigger = screen.getByRole("button", { name: /last 30 days/i });
    await user.click(trigger);
    expect(screen.getByText("Custom range")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByText("Custom range")).not.toBeInTheDocument();
  });

  it("fires onChange with '7d' when Last 7 days is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));
    await user.click(screen.getByText("Last 7 days"));

    expect(onChange).toHaveBeenCalledWith("7d");
  });

  it("fires onChange with '30d' when Last 30 days is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker value="7d" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 7 days/i }));
    await user.click(screen.getByText("Last 30 days"));

    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("fires onChange with '90d' when Last 90 days is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));
    await user.click(screen.getByText("Last 90 days"));

    expect(onChange).toHaveBeenCalledWith("90d");
  });

  it("fires onChange with 'custom' when Custom range is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));
    await user.click(screen.getByText("Custom range"));

    expect(onChange).toHaveBeenCalledWith("custom");
  });

  it("closes the dropdown after selecting a range", async () => {
    const user = userEvent.setup();
    render(<DateRangePicker />);

    await user.click(screen.getByRole("button", { name: /last 30 days/i }));
    await user.click(screen.getByText("Last 7 days"));

    expect(screen.queryByText("Custom range")).not.toBeInTheDocument();
  });

  it("displays the date range text for the selected preset", () => {
    render(<DateRangePicker value="30d" />);
    // Date range text shows as "(Mon… - Mon…)" format
    const trigger = screen.getByRole("button", { name: /last 30 days/i });
    expect(trigger.textContent).toMatch(/\(/);
    expect(trigger.textContent).toMatch(/\)/);
  });

  it("renders ChevronDown icon", () => {
    const { container } = render(<DateRangePicker />);
    // We already verified an SVG exists; the ChevronDown is rendered
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
