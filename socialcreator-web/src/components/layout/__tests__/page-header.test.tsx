/**
 * Tests for PageHeader component
 *
 * Verifies:
 * - Renders title and optional description
 * - Renders optional action buttons slot
 * - Applies custom className
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PageHeader } from "../page-header";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(" "),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("PageHeader", () => {
  it("renders the title as an h1", () => {
    render(<PageHeader title="Dashboard" />);

    const heading = screen.getByRole("heading", { level: 1, name: "Dashboard" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<PageHeader title="Settings" description="Manage your account settings" />);

    expect(screen.getByText("Manage your account settings")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(<PageHeader title="Dashboard" />);

    expect(screen.queryByText(/Manage/)).not.toBeInTheDocument();
  });

  it("renders action elements when provided", () => {
    render(<PageHeader title="Users" actions={<button type="button">Add User</button>} />);

    expect(screen.getByRole("button", { name: "Add User" })).toBeInTheDocument();
  });

  it("does not render actions slot when not provided", () => {
    render(<PageHeader title="Dashboard" />);

    // No actions div should exist
    const heading = screen.getByRole("heading", { level: 1 });
    const actionsContainer = heading.closest("div")?.querySelector(".flex.items-center.gap-3");
    expect(actionsContainer).toBeNull();
  });

  it("applies custom className to the container", () => {
    const { container } = render(<PageHeader title="Dashboard" className="my-custom-class" />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain("my-custom-class");
  });

  it("renders multiple action elements", () => {
    render(
      <PageHeader
        title="Analytics"
        actions={
          <>
            <button type="button">Export</button>
            <button type="button">Filter</button>
          </>
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
  });
});
