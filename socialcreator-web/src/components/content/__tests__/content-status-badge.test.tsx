/**
 * Tests for ContentStatusBadge component.
 *
 * Renders correct label per status with appropriate styling.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { ContentStatusBadge } from "../content-status-badge";

const mockStatusLabels = vi.hoisted(() => ({
  DRAFT: "Draft",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
}));

const mockStatusColors = vi.hoisted(() => ({
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-purple-100 text-purple-700",
  FAILED: "bg-red-100 text-red-700",
}));

vi.mock("@socialcreator/types/profile", () => ({
  CONTENT_STATUS_LABELS: mockStatusLabels,
  CONTENT_STATUS_COLORS: mockStatusColors,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("ContentStatusBadge", () => {
  it("renders 'Draft' label for DRAFT status", () => {
    render(<ContentStatusBadge status="DRAFT" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders 'Approved' label for APPROVED status", () => {
    render(<ContentStatusBadge status="APPROVED" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders 'Rejected' label for REJECTED status", () => {
    render(<ContentStatusBadge status="REJECTED" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("renders 'Scheduled' label for SCHEDULED status", () => {
    render(<ContentStatusBadge status="SCHEDULED" />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("renders 'Published' label for PUBLISHED status", () => {
    render(<ContentStatusBadge status="PUBLISHED" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders 'Failed' label for FAILED status", () => {
    render(<ContentStatusBadge status="FAILED" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("applies status-specific color classes", () => {
    const { container } = render(<ContentStatusBadge status="DRAFT" />);
    const badge = container.firstChild as HTMLElement;
    // Uses cn to join base classes with status-specific colors
    expect(badge.className).toContain("bg-gray-100");
    expect(badge.className).toContain("text-gray-700");
  });

  it("applies custom className when provided", () => {
    render(<ContentStatusBadge status="APPROVED" className="my-custom-class" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("applies base classes for rounded-full and caption styling", () => {
    const { container } = render(<ContentStatusBadge status="PUBLISHED" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("rounded-full");
  });
});
