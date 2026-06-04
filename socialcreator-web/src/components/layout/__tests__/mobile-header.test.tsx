/**
 * Tests for MobileHeader component
 *
 * Verifies:
 * - Renders hamburger menu button
 * - Menu opens/closes via sidebar
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { MobileHeader } from "../mobile-header";

// ── Module-level mocks ───────────────────────────────────────────────

vi.mock("lucide-react", () => ({
  Menu: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-menu" {...props} />,
}));

// Mock Sidebar to control isOpen and onClose
const mockSidebarIsOpen = vi.hoisted(() => ({ current: false }));
const mockSidebarOnClose = vi.hoisted(() => vi.fn());

vi.mock("../sidebar", () => ({
  Sidebar: ({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
    mockSidebarIsOpen.current = isOpen ?? false;
    // Store onClose ref so tests can call it
    mockSidebarOnClose.mockImplementation(onClose ?? (() => {}));
    return <div data-testid="sidebar" data-open={isOpen} />;
  },
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("MobileHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSidebarIsOpen.current = false;
  });

  it("renders hamburger menu button with SocialCreator title", () => {
    render(<MobileHeader />);

    expect(screen.getByLabelText("Open navigation menu")).toBeInTheDocument();
    expect(screen.getByText("SocialCreator")).toBeInTheDocument();
  });

  it("opens sidebar when hamburger menu is clicked", async () => {
    render(<MobileHeader />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open navigation menu"));

    // Sidebar should receive isOpen=true
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-open", "true");
  });

  it("renders sidebar component with user prop", () => {
    const testUser = {
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
    };

    render(<MobileHeader user={testUser} />);

    // Sidebar should be rendered
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("passes onClose to sidebar that closes the menu", async () => {
    render(<MobileHeader />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Open navigation menu"));

    // At this point sidebar should be open
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-open", "true");

    // Now simulate the sidebar's onClose being called
    // mockSidebarOnClose's implementation was set to the component's onClose
    mockSidebarOnClose();
    // onClose sets isOpen to false, which should cause the sidebar to close
    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toHaveAttribute("data-open", "false");
    });
  });

  it("renders header with sticky positioning", () => {
    const { container } = render(<MobileHeader />);

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("sticky");
  });
});
