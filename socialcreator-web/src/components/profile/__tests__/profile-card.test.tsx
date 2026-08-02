/**
 * Tests for ProfileCard component
 *
 * Renders a profile card with name, avatar/initials, platform badges,
 * brand voice preview, stats, and action dropdown (edit/delete).
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { ProfileCard } from "../profile-card";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  MoreVertical: "svg-more-vertical",
  Pencil: "svg-pencil",
  Trash2: "svg-trash2",
  X: "svg-x",
}));

vi.mock("@/components/admin/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm, description, confirmLabel }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{description}</p>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          {confirmLabel || "Confirm"}
        </button>
        <button data-testid="cancel-btn" onClick={() => {}}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

const baseProfile = {
  id: "profile-1",
  name: "My Brand",
  avatarUrl: null,
  platforms: ["X", "TIKTOK"] as string[],
  brandVoice: "Friendly and professional tone",
  isActive: true,
  _count: { agents: 3, generatedContents: 12, connectedAccounts: 2 },
  // Prisma Profile fields we don't use
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: "user-1",
  webhookUrl: null,
};

const profileWithAvatar = {
  ...baseProfile,
  avatarUrl: "https://example.com/avatar.png",
  name: "Brand With Avatar",
};

const profileManyPlatforms = {
  ...baseProfile,
  platforms: ["X", "LINKEDIN", "INSTAGRAM", "TIKTOK", "FACEBOOK"] as string[],
};

const profileInactive = {
  ...baseProfile,
  isActive: false,
};

const profileLongVoice = {
  ...baseProfile,
  brandVoice: "A".repeat(150),
};

const profileNoCount = {
  ...baseProfile,
  _count: undefined,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ProfileCard", () => {
  it("renders the profile name", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    expect(screen.getByText("My Brand")).toBeInTheDocument();
  });

  it("renders initials when no avatar URL is provided", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    expect(screen.getByText("MB")).toBeInTheDocument();
  });

  it("renders an avatar image when avatarUrl is provided", () => {
    render(<ProfileCard profile={profileWithAvatar as any} />);
    const img = screen.getByAltText("Brand With Avatar");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("renders platform badges (up to 3)", () => {
    render(<ProfileCard profile={profileManyPlatforms as any} />);
    // First 3 platforms should show as badges, the rest as "+N"
    const plusBadge = screen.getByText("+2");
    expect(plusBadge).toBeInTheDocument();
  });

  it("renders platform badges when platforms <= 3", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    // 2 platforms, no +N badge
    expect(screen.queryByText(/^\+\d+/)).not.toBeInTheDocument();
  });

  it("renders stats from _count", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    expect(screen.getByText(/3 agents/)).toBeInTheDocument();
    expect(screen.getByText(/12 contents/)).toBeInTheDocument();
  });

  it("does not display stats when _count is undefined", () => {
    render(<ProfileCard profile={profileNoCount as any} />);
    expect(screen.queryByText(/agents/)).not.toBeInTheDocument();
  });

  it("renders brand voice preview truncated at 100 chars", () => {
    render(<ProfileCard profile={profileLongVoice as any} />);
    const displayed = screen.getByText(/A/);
    expect(displayed.textContent).toHaveLength(103); // 100 chars + "..."
    expect(displayed.textContent).toContain("...");
  });

  it("renders brand voice preview full when under 100 chars", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    expect(screen.getByText(/Friendly and professional tone/)).toBeInTheDocument();
  });

  it("shows inactive badge when profile is not active", () => {
    render(<ProfileCard profile={profileInactive as any} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("does not show inactive badge when profile is active", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("renders edit link in dropdown", async () => {
    render(<ProfileCard profile={baseProfile as any} />);
    // Click more button to open dropdown
    const moreButton = screen.getByRole("button");
    await userEvent.click(moreButton);

    const editLink = screen.getByText("Edit");
    expect(editLink).toBeInTheDocument();
    expect(editLink.closest("a")).toHaveAttribute("href", "/profiles/profile-1/edit");
  });

  it("renders delete button in dropdown and calls onDelete on confirm", async () => {
    const onDelete = vi.fn();

    render(<ProfileCard profile={baseProfile as any} onDelete={onDelete} />);

    // Click more button
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]!);

    // Click Delete
    const deleteBtn = screen.getByText("Delete");
    await userEvent.click(deleteBtn);

    // ConfirmDialog should appear
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    // Click confirm
    await userEvent.click(screen.getByTestId("confirm-btn"));
    expect(onDelete).toHaveBeenCalledWith("profile-1");
  });

  it("does not call onDelete when confirm is cancelled", async () => {
    const onDelete = vi.fn();

    render(<ProfileCard profile={baseProfile as any} onDelete={onDelete} />);

    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]!);

    const deleteBtn = screen.getByText("Delete");
    await userEvent.click(deleteBtn);

    // ConfirmDialog should appear
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    // Click cancel
    await userEvent.click(screen.getByTestId("cancel-btn"));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("links to the profile detail page", () => {
    render(<ProfileCard profile={baseProfile as any} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/profiles/profile-1");
  });
});
