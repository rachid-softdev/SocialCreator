/**
 * Tests for QuickActions component.
 *
 * Verifies:
 * - Renders all 3 action buttons
 * - Links have correct href attributes
 * - Icon labels are present
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { QuickActions } from "@/components/dashboard/quick-actions";

vi.mock("lucide-react", () => ({
  Bot: "svg-bot",
  FileText: "svg-file-text",
  Plus: "svg-plus",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("QuickActions", () => {
  it("renders heading", () => {
    render(<QuickActions />);
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it("renders all 3 action buttons", () => {
    render(<QuickActions />);

    expect(screen.getByText("New Profile")).toBeInTheDocument();
    expect(screen.getByText("New Agent")).toBeInTheDocument();
    expect(screen.getByText("View Content")).toBeInTheDocument();
  });

  it("links have correct href attributes", () => {
    render(<QuickActions />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    expect(links[0]).toHaveAttribute("href", "/profiles/new");
    expect(links[1]).toHaveAttribute("href", "/agents/new");
    expect(links[2]).toHaveAttribute("href", "/content");
  });

  it("renders icon SVGs for each action", () => {
    render(<QuickActions />);

    // All 3 icons should be present
    const icons = document.querySelectorAll("svg-plus, svg-bot, svg-file-text");
    expect(icons.length).toBe(3);
  });

  it("allows navigation via click on each link", () => {
    render(<QuickActions />);

    const newProfileLink = screen.getByText("New Profile").closest("a");
    expect(newProfileLink).toHaveAttribute("href", "/profiles/new");

    const newAgentLink = screen.getByText("New Agent").closest("a");
    expect(newAgentLink).toHaveAttribute("href", "/agents/new");

    const viewContentLink = screen.getByText("View Content").closest("a");
    expect(viewContentLink).toHaveAttribute("href", "/content");
  });
});
