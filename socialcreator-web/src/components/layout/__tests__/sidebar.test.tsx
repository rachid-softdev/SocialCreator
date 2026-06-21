/**
 * Tests for Sidebar component
 *
 * Verifies:
 * - Renders navigation items
 * - Active link highlighting
 * - User avatar/name display
 * - Admin link conditional on role
 * - Sign out button
 * - Notification bell rendering
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { Sidebar } from "../sidebar";

// ── Hoisted mocks ────────────────────────────────────────────────────

const mockPathname = vi.hoisted(() => vi.fn(() => "/dashboard"));
const mockSignOut = vi.hoisted(() => vi.fn());
const mockUseAuthStore = vi.hoisted(() => vi.fn());
const mockUseUIStore = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

vi.mock("next-auth/react", () => ({
  signOut: mockSignOut,
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img {...props} alt={props.alt || ""} src={props.src || "https://placehold.co/36"} />
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

vi.mock("@/lib/stores", () => ({
  useAuthStore: mockUseAuthStore,
  useUIStore: mockUseUIStore,
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(" "),
}));

// Mock all lucide-react icons used by Sidebar
vi.mock("lucide-react", () => ({
  BarChart3: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-bar-chart3" {...props} />
  ),
  Bot: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-bot" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-calendar" {...props} />
  ),
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  CreditCard: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-credit-card" {...props} />
  ),
  FileText: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-file-text" {...props} />
  ),
  History: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-history" {...props} />,
  LayoutDashboard: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-layout-dashboard" {...props} />
  ),
  LogOut: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-log-out" {...props} />,
  Settings: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-settings" {...props} />
  ),
  Shield: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-shield" {...props} />,
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-sparkles" {...props} />
  ),
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-users" {...props} />,
  Keyboard: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-keyboard" {...props} />
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-search" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default store mocks
    mockUseUIStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = { sidebar: "open", toggleSidebar: vi.fn() };
      return selector(state);
    });

    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = { user: null };
      return selector(state);
    });
  });

  it("renders all navigation items", () => {
    render(<Sidebar />);

    const navItems = [
      "Dashboard",
      "Profiles",
      "Agents",
      "Content",
      "Calendar",
      "Queue",
      "History",
      "Analytics",
      "Settings",
      "Billing",
    ];

    for (const item of navItems) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("highlights the active link based on pathname", () => {
    mockPathname.mockReturnValue("/agents");

    render(<Sidebar />);

    const agentsLink = screen.getByText("Agents").closest("a");
    expect(agentsLink).toHaveAttribute("aria-current", "page");
  });

  it("does not highlight inactive links", () => {
    mockPathname.mockReturnValue("/dashboard");

    render(<Sidebar />);

    const agentsLink = screen.getByText("Agents").closest("a");
    expect(agentsLink).not.toHaveAttribute("aria-current", "page");
  });

  it("renders user avatar and name when provided via prop", () => {
    render(<Sidebar user={{ name: "John Doe", image: "https://example.com/avatar.jpg" }} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByAltText("John Doe")).toBeInTheDocument();
  });

  it("renders user initial when no image is provided", () => {
    render(<Sidebar user={{ name: "Jane", image: null }} />);

    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("renders 'U' when no user is provided", () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = { user: null };
      return selector(state);
    });

    render(<Sidebar />);

    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("shows admin link when user role is ADMIN", () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        user: { id: "1", email: "admin@test.com", name: "Admin", image: null, role: "ADMIN" },
      };
      return selector(state);
    });

    render(<Sidebar />);

    // "Admin" appears in both user name display and admin link
    expect(screen.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);
  });

  it("hides admin link when user role is not ADMIN", () => {
    mockUseAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        user: { id: "1", email: "user@test.com", name: "User", image: null, role: "USER" },
      };
      return selector(state);
    });

    render(<Sidebar />);

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("renders sign out button that calls signOut", async () => {
    render(<Sidebar />);

    const user = userEvent.setup();
    await user.click(screen.getByText("Sign out"));

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("renders notification bell", () => {
    render(<Sidebar />);

    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });
});
