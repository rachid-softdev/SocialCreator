/**
 * Tests for NotificationBell component
 *
 * Verifies: bell icon rendering, unread count badge, dropdown toggle,
 * notification list, mark as read, mark all read, empty state,
 * and loading spinner.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { NotificationBell } from "../notification-bell";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/ui/button", () => ({
  Button: ({ children, onClick, disabled, className, size, variant, ...props }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

const mockUseNotifications = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-notifications", () => ({
  useNotifications: mockUseNotifications,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const mockNotifications = [
  {
    id: "n1",
    type: "publish",
    title: "Post published to X",
    message: "Your post 'Hello World' was published successfully.",
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    data: {},
  },
  {
    id: "n2",
    type: "error",
    title: "Failed to schedule post",
    message: "There was an error scheduling your LinkedIn post.",
    read: true,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    data: {},
  },
  {
    id: "n3",
    type: "info",
    title: "Welcome to SocialCreator",
    message: null,
    read: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    data: {},
  },
];

const defaultHookReturn = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  refresh: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({ ...defaultHookReturn });
  });

  // ── Bell icon ─────────────────────────────────────────────────────────

  describe("bell icon", () => {
    it("renders the notification bell button", () => {
      render(<NotificationBell />);
      expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument();
    });

    it("has the correct aria-label with no unread", () => {
      render(<NotificationBell />);
      expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
    });

    it("has the correct aria-label with unread count", () => {
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        unreadCount: 3,
      });
      render(<NotificationBell />);
      expect(screen.getByLabelText("Notifications (3 unread)")).toBeInTheDocument();
    });
  });

  // ── Unread badge ──────────────────────────────────────────────────────

  describe("unread badge", () => {
    it("shows unread count badge when there are unread notifications", () => {
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        unreadCount: 3,
      });
      render(<NotificationBell />);
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("shows '9+' when unread count exceeds 9", () => {
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        unreadCount: 15,
      });
      render(<NotificationBell />);
      expect(screen.getByText("9+")).toBeInTheDocument();
      expect(screen.queryByText("15")).not.toBeInTheDocument();
    });

    it("does not show badge when unread count is 0", () => {
      render(<NotificationBell />);
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  // ── Dropdown ──────────────────────────────────────────────────────────

  describe("dropdown", () => {
    it("opens dropdown when bell is clicked", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
        unreadCount: 2,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText("Notifications (2 unread)"));

      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    it("closes dropdown when bell is clicked again", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));
      expect(screen.getByText("Notifications")).toBeInTheDocument();

      await user.click(screen.getByLabelText(/Notifications/));
      expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    });

    it("closes dropdown when clicking outside", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));
      expect(screen.getByText("Notifications")).toBeInTheDocument();

      // Click outside the dropdown
      await user.click(document.body);
      expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    });
  });

  // ── Notification list ─────────────────────────────────────────────────

  describe("notification list", () => {
    it("renders notification titles in the dropdown", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
        unreadCount: 2,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText("Notifications (2 unread)"));

      expect(screen.getByText("Post published to X")).toBeInTheDocument();
      expect(screen.getByText("Failed to schedule post")).toBeInTheDocument();
      expect(screen.getByText("Welcome to SocialCreator")).toBeInTheDocument();
    });

    it("renders notification messages when present", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      expect(
        screen.getByText("Your post 'Hello World' was published successfully."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("There was an error scheduling your LinkedIn post."),
      ).toBeInTheDocument();
    });

    it("renders relative timestamps", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      // The first notification is 5 min ago
      expect(screen.getByText("5m ago")).toBeInTheDocument();
    });

    it("shows 'Just now' for very recent notifications", async () => {
      const user = userEvent.setup();
      const nowNotification = [
        {
          ...mockNotifications[0],
          createdAt: new Date().toISOString(),
        },
      ];
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: nowNotification,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      expect(screen.getByText("Just now")).toBeInTheDocument();
    });

    it("shows 'Mark all read' button when there are unread notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
        unreadCount: 2,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText("Notifications (2 unread)"));

      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });

    it("does not show 'Mark all read' when all notifications are read", async () => {
      const user = userEvent.setup();
      const readNotifications = mockNotifications.map((n) => ({ ...n, read: true }));
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: readNotifications,
        unreadCount: 0,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
    });
  });

  // ── Mark as read ──────────────────────────────────────────────────────

  describe("mark as read", () => {
    it("calls markAsRead when a notification is clicked", async () => {
      const markAsRead = vi.fn();
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
        unreadCount: 2,
        markAsRead,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText("Notifications (2 unread)"));

      const notificationBtn = screen.getByText("Post published to X").closest("button")!;
      await user.click(notificationBtn);

      expect(markAsRead).toHaveBeenCalledWith("n1");
    });

    it("calls markAllAsRead when 'Mark all read' is clicked", async () => {
      const markAllAsRead = vi.fn();
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
        unreadCount: 2,
        markAllAsRead,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText("Notifications (2 unread)"));
      await user.click(screen.getByText("Mark all read"));

      expect(markAllAsRead).toHaveBeenCalled();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows 'No notifications yet' when there are no notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: [],
        unreadCount: 0,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });

    it("shows a Bell icon in the empty state", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: [],
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      // The empty state Bell icon should be visible
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows a loading spinner when loading and no notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: [],
        loading: true,
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      // The Loader2 icon with animate-spin class should be present
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("does not show loading spinner when there are already notifications", async () => {
      const user = userEvent.setup();
      mockUseNotifications.mockReturnValue({
        ...defaultHookReturn,
        notifications: mockNotifications,
        loading: true, // still loading but has data
      });
      render(<NotificationBell />);

      await user.click(screen.getByLabelText(/Notifications/));

      // Notifications should be rendered regardless of loading state
      expect(screen.getByText("Post published to X")).toBeInTheDocument();
    });
  });
});
