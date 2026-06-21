import React from "react";
import { describe, expect, it } from "vitest";
import {
  AgentCardSkeleton,
  AgentListSkeleton,
  ChartSkeleton,
  ContentCardSkeleton,
  ContentListSkeleton,
  FormSkeleton,
  LoadingSpinner,
  PageLoadingSkeleton,
  ProfileCardSkeleton,
  ProfileListSkeleton,
  SidebarSkeleton,
  Skeleton,
  StatsGridSkeleton,
  TableSkeleton,
  VideoCardSkeleton,
} from "../skeleton";
import { render } from "./test-utils";

describe("@socialcreator/ui - Skeleton", () => {
  it("should render a basic skeleton with pulse animation", () => {
    const { container, cleanup } = render(<Skeleton className="h-10 w-20" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("rounded-md");
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-20");
    cleanup();
  });
});

describe("@socialcreator/ui - ProfileCardSkeleton", () => {
  it("should render without error", () => {
    const { container, cleanup } = render(<ProfileCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("@socialcreator/ui - AgentCardSkeleton", () => {
  it("should render without error", () => {
    const { container, cleanup } = render(<AgentCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("@socialcreator/ui - ContentCardSkeleton", () => {
  it("should render without error", () => {
    const { container, cleanup } = render(<ContentCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("@socialcreator/ui - VideoCardSkeleton", () => {
  it("should render without error", () => {
    const { container, cleanup } = render(<VideoCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("@socialcreator/ui - ContentListSkeleton", () => {
  it("should render default count of 5 items", () => {
    const { container, cleanup } = render(<ContentListSkeleton />);
    // Each ContentCardSkeleton has a border-hairline class
    const items = container.querySelectorAll('[class*="border-hairline"]');
    expect(items.length).toBe(5);
    cleanup();
  });

  it("should render custom count", () => {
    const { container, cleanup } = render(<ContentListSkeleton count={3} />);
    const items = container.querySelectorAll('[class*="border-hairline"]');
    expect(items.length).toBe(3);
    cleanup();
  });
});

describe("@socialcreator/ui - ProfileListSkeleton", () => {
  it("should render default count of 6 items", () => {
    const { container, cleanup } = render(<ProfileListSkeleton />);
    // Each ProfileCardSkeleton has a border-hairline class
    const items = container.querySelectorAll('[class*="border-hairline"]');
    expect(items.length).toBe(6);
    cleanup();
  });
});

describe("@socialcreator/ui - AgentListSkeleton", () => {
  it("should render default count of 4 items", () => {
    const { container, cleanup } = render(<AgentListSkeleton />);
    const items = container.querySelectorAll('[class*="border-hairline"]');
    expect(items.length).toBe(4);
    cleanup();
  });
});

describe("@socialcreator/ui - StatsGridSkeleton", () => {
  it("should render 4 stat card skeletons", () => {
    const { container, cleanup } = render(<StatsGridSkeleton />);
    // Renders 4 stat card divs, each with an animate-pulse skeleton
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(8); // 2 skeletons per card x 4 cards
    cleanup();
  });
});

describe("@socialcreator/ui - ChartSkeleton", () => {
  it("should render 12 bar placeholders", () => {
    const { container, cleanup } = render(<ChartSkeleton />);
    const bars = container.querySelectorAll('[class*="rounded-t"]');
    expect(bars.length).toBe(12);
    cleanup();
  });
});

describe("@socialcreator/ui - FormSkeleton", () => {
  it("should render skeleton fields", () => {
    const { container, cleanup } = render(<FormSkeleton />);
    // Should contain some skeleton divs
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    cleanup();
  });
});

describe("@socialcreator/ui - TableSkeleton", () => {
  it("should render default 5 rows x 4 columns", () => {
    const { container, cleanup } = render(<TableSkeleton />);
    // Header row + 5 data rows = 6 flex containers
    // Each of the 6 flex containers has `flex p-4 gap-4`
    const rows = container.querySelectorAll('[class*="flex"]');
    expect(rows.length).toBeGreaterThanOrEqual(6);
    cleanup();
  });

  it("should render custom rows and columns", () => {
    const { container, cleanup } = render(<TableSkeleton rows={2} columns={3} />);
    const skeletonDivs = container.querySelectorAll(".animate-pulse");
    // 2 data rows + 1 header = 3 rows, each with 3 skeleton = 9 skeleton divs
    expect(skeletonDivs.length).toBe(9);
    cleanup();
  });
});

describe("@socialcreator/ui - SidebarSkeleton", () => {
  it("should render navigation items", () => {
    const { container, cleanup } = render(<SidebarSkeleton />);
    // Should have 6 nav items
    const navItems = container.querySelectorAll(".space-y-2 > *");
    expect(navItems.length).toBe(6);
    cleanup();
  });
});

describe("@socialcreator/ui - LoadingSpinner", () => {
  it("should render with default (md) size", () => {
    const { container, cleanup } = render(<LoadingSpinner />);
    const spinner = container.firstElementChild as HTMLElement;
    expect(spinner.className).toContain("animate-spin");
    expect(spinner.className).toContain("h-8");
    expect(spinner.className).toContain("w-8");
    cleanup();
  });

  it("should render with sm size", () => {
    const { container, cleanup } = render(<LoadingSpinner size="sm" />);
    const spinner = container.firstElementChild as HTMLElement;
    expect(spinner.className).toContain("h-4");
    expect(spinner.className).toContain("w-4");
    cleanup();
  });

  it("should render with lg size", () => {
    const { container, cleanup } = render(<LoadingSpinner size="lg" />);
    const spinner = container.firstElementChild as HTMLElement;
    expect(spinner.className).toContain("h-12");
    expect(spinner.className).toContain("w-12");
    cleanup();
  });
});

describe("@socialcreator/ui - PageLoadingSkeleton", () => {
  it("should render the full page skeleton without error", () => {
    const { container, cleanup } = render(<PageLoadingSkeleton />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    cleanup();
  });
});
