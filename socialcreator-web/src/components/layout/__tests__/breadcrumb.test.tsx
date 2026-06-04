/**
 * Tests for Breadcrumb component
 *
 * Verifies:
 * - Renders breadcrumb items
 * - Last item is not a link
 * - Separator between items
 * - Handles empty items gracefully
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { Breadcrumb } from "../breadcrumb";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("@socialcreator/utils", () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="chevron-right" {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("Breadcrumb", () => {
  it("renders breadcrumb items with links", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "Profile" },
        ]}
      />,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders last item as plain text (not a link)", () => {
    render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Profile" }]} />);

    // Last item should be a span (or not wrapped in a link)
    const lastItem = screen.getByText("Profile");
    expect(lastItem.tagName).toBe("SPAN");
  });

  it("renders intermediate items as links", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "Profile" },
        ]}
      />,
    );

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("renders separators between items", () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "Profile" },
        ]}
      />,
    );

    const chevrons = container.querySelectorAll("[data-testid='chevron-right']");
    // Two separators for 3 items
    expect(chevrons).toHaveLength(2);
  });

  it("handles empty items array gracefully", () => {
    const { container } = render(<Breadcrumb items={[]} />);

    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
    expect(nav?.children.length).toBe(0);
  });

  it("handles single item", () => {
    render(<Breadcrumb items={[{ label: "Home" }]} />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    // No separator for single item
    expect(screen.queryByTestId("chevron-right")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <Breadcrumb items={[{ label: "Home", href: "/" }]} className="custom-class" />,
    );

    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("custom-class");
  });
});
