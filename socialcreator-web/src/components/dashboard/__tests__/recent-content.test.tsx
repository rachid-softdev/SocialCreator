/**
 * Tests for RecentContent component.
 *
 * Verifies:
 * - Shows empty state when no content
 * - Renders content list with platform badges and status labels
 * - Shows time formatting for each content item
 * - Handles undefined contents gracefully
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { RecentContent } from "@/components/dashboard/recent-content";

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatDate: vi.fn(() => "Jun 1, 2025"),
}));

vi.mock("@socialcreator/types/profile", () => ({
  CONTENT_STATUS_COLORS: {
    DRAFT: "bg-gray-100 text-gray-800",
    APPROVED: "bg-green-100 text-green-800",
    SCHEDULED: "bg-blue-100 text-blue-800",
    PUBLISHED: "bg-purple-100 text-purple-800",
    FAILED: "bg-red-100 text-red-800",
  },
  CONTENT_STATUS_LABELS: {
    DRAFT: "Draft",
    APPROVED: "Approved",
    SCHEDULED: "Scheduled",
    PUBLISHED: "Published",
    FAILED: "Failed",
  },
  PLATFORMS: [
    { value: "X", icon: "𝕏", label: "X" },
    { value: "LINKEDIN", icon: "in", label: "LinkedIn" },
    { value: "INSTAGRAM", icon: "📷", label: "Instagram" },
  ],
}));

describe("RecentContent", () => {
  it("shows empty state when contents array is empty", () => {
    render(<RecentContent contents={[]} />);

    expect(screen.getByText("Recent Content")).toBeInTheDocument();
    expect(
      screen.getByText("No content yet. Create your first profile to get started."),
    ).toBeInTheDocument();
  });

  it("shows empty state when contents is undefined", () => {
    render(<RecentContent />);

    expect(screen.getByText("Recent Content")).toBeInTheDocument();
    expect(
      screen.getByText("No content yet. Create your first profile to get started."),
    ).toBeInTheDocument();
  });

  it("renders content items with platform badges and status labels", () => {
    const contents = [
      {
        id: "content-1",
        textContent: "My first post about marketing",
        platform: "X" as const,
        status: "PUBLISHED" as const,
        createdAt: new Date("2025-06-01T10:00:00Z"),
        hashtags: ["marketing"],
      },
      {
        id: "content-2",
        textContent: "LinkedIn post about growth",
        platform: "LINKEDIN" as const,
        status: "DRAFT" as const,
        createdAt: new Date("2025-06-02T10:00:00Z"),
        hashtags: [],
      },
    ];

    render(<RecentContent contents={contents as any} />);

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows formatted date for each content item", () => {
    const contents = [
      {
        id: "content-1",
        textContent: "Test post",
        platform: "X" as const,
        status: "DRAFT" as const,
        createdAt: new Date("2025-06-01T10:00:00Z"),
        hashtags: [],
      },
    ];

    render(<RecentContent contents={contents as any} />);

    expect(screen.getByText("Jun 1, 2025")).toBeInTheDocument();
  });

  it("shows profile name when available", () => {
    const contents = [
      {
        id: "content-1",
        textContent: "Test post",
        platform: "X" as const,
        status: "DRAFT" as const,
        createdAt: new Date("2025-06-01T10:00:00Z"),
        profileName: "Main Profile",
        hashtags: [],
      },
    ];

    render(<RecentContent contents={contents as any} />);

    expect(screen.getByText(/Main Profile/)).toBeInTheDocument();
  });

  it("handles content with empty textContent", () => {
    const contents = [
      {
        id: "content-1",
        textContent: "",
        platform: "X" as const,
        status: "DRAFT" as const,
        createdAt: new Date("2025-06-01T10:00:00Z"),
        profileName: "Main Profile",
        hashtags: [],
      },
    ];

    render(<RecentContent contents={contents as any} />);

    expect(screen.getByText("No content")).toBeInTheDocument();
  });
});
