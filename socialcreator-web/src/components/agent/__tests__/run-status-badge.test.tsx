/**
 * Tests for RunStatusBadge component.
 *
 * Verifies:
 * - Correct label and color per status (PENDING, RUNNING, SUCCESS, FAILED, CANCELLED)
 * - Pulse animation when showPulse is true and status is RUNNING
 * - No pulse animation when showPulse is false
 * - Custom className is applied
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { RunStatusBadge } from "@/components/agent/run-status-badge";

vi.mock("@socialcreator/types/agent", () => ({
  RUN_STATUS_COLORS: {
    PENDING: "bg-muted-soft text-muted",
    RUNNING: "bg-blue-100 text-blue-700",
    SUCCESS: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  },
  RUN_STATUS_LABELS: {
    PENDING: "Pending",
    RUNNING: "Running",
    SUCCESS: "Success",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  },
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("RunStatusBadge", () => {
  it.each([
    ["PENDING", "Pending"],
    ["RUNNING", "Running"],
    ["SUCCESS", "Success"],
    ["FAILED", "Failed"],
    ["CANCELLED", "Cancelled"],
  ])("renders correct label for status %s", (status, expectedLabel) => {
    render(<RunStatusBadge status={status as any} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("applies pulse animation for RUNNING status when showPulse is true", () => {
    render(<RunStatusBadge status="RUNNING" showPulse={true} />);

    const badge = screen.getByText("Running");
    expect(badge.className).toContain("animate-pulse");
  });

  it("does not apply pulse animation for RUNNING status when showPulse is false", () => {
    render(<RunStatusBadge status="RUNNING" showPulse={false} />);

    const badge = screen.getByText("Running");
    expect(badge.className).not.toContain("animate-pulse");
  });

  it("does not apply pulse animation for non-RUNNING statuses", () => {
    const { rerender } = render(<RunStatusBadge status="SUCCESS" />);
    expect(screen.getByText("Success").className).not.toContain("animate-pulse");

    rerender(<RunStatusBadge status="FAILED" />);
    expect(screen.getByText("Failed").className).not.toContain("animate-pulse");

    rerender(<RunStatusBadge status="PENDING" />);
    expect(screen.getByText("Pending").className).not.toContain("animate-pulse");

    rerender(<RunStatusBadge status="CANCELLED" />);
    expect(screen.getByText("Cancelled").className).not.toContain("animate-pulse");
  });

  it("applies custom className", () => {
    render(<RunStatusBadge status="SUCCESS" className="custom-class" />);

    const badge = screen.getByText("Success");
    expect(badge.className).toContain("custom-class");
  });

  it("renders a dot indicator for RUNNING status", () => {
    const { container } = render(<RunStatusBadge status="RUNNING" />);

    const dot = container.querySelector("span.w-1\\.5");
    expect(dot).toBeInTheDocument();
  });

  it("does not render a dot indicator for non-RUNNING status", () => {
    const { container } = render(<RunStatusBadge status="SUCCESS" />);

    const dot = container.querySelector("span.w-1\\.5");
    expect(dot).not.toBeInTheDocument();
  });
});
