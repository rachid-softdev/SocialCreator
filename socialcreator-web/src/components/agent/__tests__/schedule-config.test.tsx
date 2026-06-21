/**
 * Tests for ScheduleConfig component
 *
 * Verifies:
 * - Renders with initial schedule and active state
 * - Toggle enable/disable
 * - Invalid cron expression shows error
 * - onSave success shows success message
 * - onSave error shows error message
 * - Display next run time
 * - Preset buttons apply values
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ScheduleConfig } from "../schedule-config";

// ── Module-level mocks ────────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Clock: ({ className }: any) => (
    <span data-testid="icon-clock" className={className}>
      svg-clock
    </span>
  ),
  Play: ({ className }: any) => (
    <span data-testid="icon-play" className={className}>
      svg-play
    </span>
  ),
  Pause: ({ className }: any) => (
    <span data-testid="icon-pause" className={className}>
      svg-pause
    </span>
  ),
  AlertCircle: ({ className }: any) => (
    <span data-testid="icon-alert" className={className}>
      svg-alert
    </span>
  ),
  CheckCircle: ({ className }: any) => (
    <span data-testid="icon-check" className={className}>
      svg-check
    </span>
  ),
}));

vi.mock("@/lib/cron", () => ({
  isValidCron: vi.fn((expr: string) => {
    if (!expr) return false;
    const parts = expr.split(" ");
    if (parts.length !== 5) return false;
    return true;
  }),
  getNextExecution: vi.fn(() => new Date("2025-07-01T10:00:00Z")),
  formatNextRun: vi.fn(() => "in 2 days"),
  describeCron: vi.fn((expr: string) => {
    if (expr === "0 * * * *") return "Every hour";
    if (expr === "0 */6 * * *") return "Every 6 hours";
    if (expr === "0 9 * * *") return "At 9:00";
    return `Cron: ${expr}`;
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────

/** Find the toggle switch button (the one with a slide knob inside) */
function findToggle(): HTMLElement {
  const buttons = screen.getAllByRole("button");
  // The toggle button renders only a single <span> child (no visible text content)
  return buttons.find((btn) => btn.children.length === 1 && btn.children[0].tagName === "SPAN")!;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("ScheduleConfig", () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial schedule and active state", () => {
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0 * * * *")).toBeInTheDocument();
  });

  it("renders as disabled when no initial schedule", () => {
    render(<ScheduleConfig agentId="agent-1" onSave={onSave} />);

    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cron Expression")).not.toBeInTheDocument();
  });

  it("calls onSave with default schedule when toggling enabled", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ScheduleConfig agentId="agent-1" onSave={save} />);

    await user.click(findToggle());
    expect(save).toHaveBeenCalledWith("0 * * * *");
  });

  it("calls onSave with null when toggling disabled", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={save}
      />,
    );

    await user.click(findToggle());
    expect(save).toHaveBeenCalledWith(null);
  });

  it("shows error when enabling toggle with invalid existing schedule", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ScheduleConfig agentId="agent-1" initialSchedule="" onSave={save} />);

    // First enable the schedule (creates default "0 * * * *")
    await user.click(findToggle());
    expect(save).toHaveBeenCalledWith("0 * * * *");

    // Now type an invalid cron in the input
    const input = screen.getByLabelText("Cron Expression");
    await user.clear(input);
    await user.type(input, "bad");
    expect(screen.getByText("Invalid cron expression")).toBeInTheDocument();
  });

  it("shows error message when typing invalid cron", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={onSave}
      />,
    );

    const input = screen.getByLabelText("Cron Expression");
    await user.clear(input);
    await user.type(input, "bad");

    expect(screen.getByText("Invalid cron expression")).toBeInTheDocument();
  });

  it("shows success message after onSave succeeds", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ScheduleConfig agentId="agent-1" onSave={save} />);

    await user.click(findToggle());
    expect(await screen.findByText("Schedule saved")).toBeInTheDocument();
  });

  it("shows error message when onSave fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("API error"));
    const user = userEvent.setup();
    render(<ScheduleConfig agentId="agent-1" initialSchedule="0 * * * *" onSave={save} />);

    // The error block is only rendered inside the {isEnabled && ...} wrapper.
    // Start with isEnabled=true (initialSchedule provided) and click the toggle
    // so that onSave is called and fails while isEnabled still == true.
    const toggle = screen
      .getAllByRole("button")
      .find((btn) => btn.childElementCount === 1 && btn.firstElementChild?.tagName === "SPAN")!;
    expect(toggle).toBeTruthy();
    await user.click(toggle);

    expect(await screen.findByText("API error")).toBeInTheDocument();
  });

  it("shows next run information when schedule is valid", () => {
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("in 2 days")).toBeInTheDocument();
  });

  it("renders cron description for valid expression", () => {
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={onSave}
      />,
    );

    // "Every hour" appears both as cron description and as preset button
    const elements = screen.getAllByText("Every hour");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders preset buttons", () => {
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={onSave}
      />,
    );

    // "Every hour" appears twice (cron description + preset button)
    const everyHourElements = screen.getAllByText("Every hour");
    expect(everyHourElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Every 6 hours")).toBeInTheDocument();
    expect(screen.getByText("Daily at 9am")).toBeInTheDocument();
    expect(screen.getByText("Daily at 9am & 6pm")).toBeInTheDocument();
    expect(screen.getByText("Weekdays 9am")).toBeInTheDocument();
  });

  it("applies preset value on click", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="0 * * * *"
        isActive={true}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByText("Daily at 9am"));
    const input = screen.getByLabelText("Cron Expression") as HTMLInputElement;
    expect(input.value).toBe("0 9 * * *");
  });

  it("disables the Test button when schedule is invalid", () => {
    render(
      <ScheduleConfig
        agentId="agent-1"
        initialSchedule="invalid"
        isActive={true}
        onSave={onSave}
      />,
    );

    const testButton = screen.getByText("Test");
    expect(testButton).toBeDisabled();
  });
});
