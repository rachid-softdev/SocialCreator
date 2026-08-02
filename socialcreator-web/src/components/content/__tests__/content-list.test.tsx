/**
 * Tests for ContentList component.
 *
 * Tests rendering of content items, empty state, filter tabs,
 * and view mode toggle.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContent } from "@/components/__tests__/test-fixtures";
import { render, screen } from "@/components/__tests__/test-utils";
import { ContentList } from "../content-list";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "💼" },
]);

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

const mockStoreWithSetState = vi.hoisted(() => {
  const store = { items: [], updateItem: vi.fn(), selectItem: vi.fn() };
  const useStore = (selector: any) => selector(store);
  useStore.setState = (updates: any) => Object.assign(store, updates);
  useStore.getState = () => store;
  return useStore;
});

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@/lib/stores", () => ({
  useContentStore: mockStoreWithSetState,
  useUIStore: (selector: any) => selector({ openModal: vi.fn() }),
}));

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
  CONTENT_STATUS_LABELS: mockStatusLabels,
  CONTENT_STATUS_COLORS: mockStatusColors,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatDateTime: vi.fn(() => "Jun 1, 2025"),
}));

vi.mock("lucide-react", () => ({
  Filter: "svg-filter",
  LayoutGrid: "svg-layout-grid",
  List: "svg-list",
  X: "svg-x",
  Check: "svg-check",
  Clock: "svg-clock",
  Eye: "svg-eye",
  Send: "svg-send",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ── Test data ────────────────────────────────────────────────────────────

const mockContents = [
  createContent({
    id: "content-1",
    textContent: "Draft post for testing",
    platform: "X",
    status: "DRAFT",
    hashtags: ["test"],
    createdAt: new Date("2025-06-01T10:00:00Z"),
    updatedAt: new Date("2025-06-01T10:00:00Z"),
  }),
  createContent({
    id: "content-2",
    textContent: "Approved post ready to publish",
    platform: "INSTAGRAM",
    status: "APPROVED",
    hashtags: ["social"],
    createdAt: new Date("2025-06-02T10:00:00Z"),
    updatedAt: new Date("2025-06-02T10:00:00Z"),
  }),
  createContent({
    id: "content-3",
    textContent: "Scheduled post for later",
    platform: "LINKEDIN",
    status: "SCHEDULED",
    hashtags: ["marketing"],
    createdAt: new Date("2025-06-03T10:00:00Z"),
    updatedAt: new Date("2025-06-03T10:00:00Z"),
    scheduledPublishAt: new Date("2025-06-15T14:00:00Z"),
  }),
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("ContentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a list of content items", () => {
    render(<ContentList contents={mockContents} />);

    expect(screen.getByText("Draft post for testing")).toBeInTheDocument();
    expect(screen.getByText("Approved post ready to publish")).toBeInTheDocument();
    expect(screen.getByText("Scheduled post for later")).toBeInTheDocument();
  });

  it("renders filter tabs when showFilters is true (default)", () => {
    render(<ContentList contents={mockContents} />);

    expect(screen.getByText("All")).toBeInTheDocument();
    // "Draft" and "Approved" appear in both filter tabs and status badges
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("hides filter tabs when showFilters is false", () => {
    render(<ContentList contents={mockContents} showFilters={false} />);

    expect(screen.queryByText("All")).not.toBeInTheDocument();
    // "Draft" appears as a status badge even when filters are hidden;
    // check for "All" which is unique to filter tabs instead
  });

  it("shows empty state message when contents array is empty", () => {
    render(<ContentList contents={[]} />);

    expect(screen.getByText("No content yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Generated content from your agents will appear here. Run an agent to create content.",
      ),
    ).toBeInTheDocument();
  });

  it("shows 'No content matches your filters' when filtered results are empty", async () => {
    const user = userEvent.setup();
    // Single item that has status DRAFT
    const singleDraft = [mockContents[0]!];
    render(<ContentList contents={singleDraft} />);

    // Click on "Approved" filter — none of the items are Approved
    await user.click(screen.getByText("Approved"));

    expect(screen.getByText("No content matches your filters.")).toBeInTheDocument();
  });

  it("renders view mode toggle buttons", () => {
    const { container } = render(<ContentList contents={mockContents} />);

    const toggleButtons = container.querySelectorAll('button[class*="p-1.5"]');
    expect(toggleButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders grid view by default", () => {
    const { container } = render(<ContentList contents={mockContents} />);

    // Grid view renders items in a grid container
    expect(container.querySelector(".grid")).toBeInTheDocument();
  });

  it("renders platform badges for each content item", () => {
    render(<ContentList contents={mockContents} />);

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
  });

  it("renders status badges for each content item", () => {
    render(<ContentList contents={mockContents} />);

    // "Draft" appears in both filter tabs and status badges
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
    // "Approved" appears in both filter tab and status badge
    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("filters content by status when status filter tab is clicked", async () => {
    const user = userEvent.setup();
    render(<ContentList contents={mockContents} />);

    // "Draft" appears in both filter tabs and status badges; click the first match (filter tab)
    const draftFilter = screen.getAllByText("Draft")[0]!;
    await user.click(draftFilter);

    expect(screen.getByText("Draft post for testing")).toBeInTheDocument();
    // Other items should not be visible (filtered out or other tab not shown)
    expect(screen.queryByText("Approved post ready to publish")).not.toBeInTheDocument();
  });

  it("uses statusFilter prop when provided externally", () => {
    render(<ContentList contents={mockContents} statusFilter="DRAFT" />);

    expect(screen.getByText("Draft post for testing")).toBeInTheDocument();
    expect(screen.queryByText("Approved post ready to publish")).not.toBeInTheDocument();
  });

  it("filters content by searchQuery prop", () => {
    render(<ContentList contents={mockContents} searchQuery="approved" />);

    expect(screen.getByText("Approved post ready to publish")).toBeInTheDocument();
    expect(screen.queryByText("Draft post for testing")).not.toBeInTheDocument();
  });

  it("matches searchQuery against hashtags", () => {
    render(<ContentList contents={mockContents} searchQuery="test" />);

    expect(screen.getByText("Draft post for testing")).toBeInTheDocument();
  });

  it("renders with empty array showing the empty state even when store has no items", () => {
    render(<ContentList contents={[]} />);

    expect(screen.getByText("No content yet")).toBeInTheDocument();
  });
});
