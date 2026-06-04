/**
 * Tests for ContentEditor component.
 *
 * Tests textarea for content editing, character count display,
 * save/cancel buttons, hashtag management, and preview toggle.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContent } from "@/components/__tests__/test-fixtures";
import { render, screen } from "@/components/__tests__/test-utils";
import { ContentEditor } from "../content-editor";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
]);

const mockPlatformConstraints = vi.hoisted(() => ({
  X: { maxChars: 280 },
  INSTAGRAM: { maxChars: 2200 },
  LINKEDIN: { maxChars: 3000 },
}));

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
}));

vi.mock("@socialcreator/types/agent", () => ({
  PLATFORM_CONSTRAINTS: mockPlatformConstraints,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  Calendar: "svg-calendar",
  Eye: "svg-eye",
  Hash: "svg-hash",
  Save: "svg-save",
  Send: "svg-send",
  X: "svg-x",
}));

// Mock MultiPlatformPreview
vi.mock("../platform-preview", () => ({
  MultiPlatformPreview: ({ content, hashtags }: any) => (
    <div data-testid="multi-platform-preview">
      Preview: {content} - hashtags: {hashtags.join(",")}
    </div>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("ContentEditor", () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a textarea with the content text", () => {
    const content = createContent({ textContent: "Original content text" });
    const { container } = render(
      <ContentEditor content={content} onSave={onSave} onCancel={onCancel} />,
    );

    const textarea = container.querySelector("textarea")!;
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Original content text");
  });

  it("displays character count", () => {
    const content = createContent({ textContent: "Original content text" });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    // "Original content text" is 21 chars, maxChars for X is 280
    // React splits "{a}/{b}" into separate text nodes, so use regex
    expect(screen.getByText(/21\/280/)).toBeInTheDocument();
  });

  it("renders a cancel button", () => {
    const content = createContent();
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const content = createContent();
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders the platform label in the header", () => {
    const content = createContent();
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("renders hashtags with remove buttons", () => {
    const content = createContent({ hashtags: ["test", "marketing"] });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText("#test")).toBeInTheDocument();
    expect(screen.getByText("#marketing")).toBeInTheDocument();
  });

  it("shows character limit error when over limit", () => {
    const content = createContent({ textContent: "A".repeat(300), platform: "X" });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    // Should show over-limit error (300 - 280 = 20 chars over)
    expect(screen.getByText("Content exceeds platform limit by 20 characters")).toBeInTheDocument();
  });

  it("shows Save Draft and Publish Now buttons for DRAFT status", () => {
    const content = createContent({ status: "DRAFT" });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText("Save Draft")).toBeInTheDocument();
    expect(screen.getByText("Publish Now")).toBeInTheDocument();
  });

  it("shows Save Changes button for non-DRAFT status", () => {
    const content = createContent({ status: "APPROVED" });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText("Save Changes")).toBeInTheDocument();
    expect(screen.queryByText("Save Draft")).not.toBeInTheDocument();
  });

  it("toggles preview when Show Preview / Hide Preview button is clicked", async () => {
    const user = userEvent.setup();
    const content = createContent();
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    // Initially, no preview shown
    expect(screen.queryByTestId("multi-platform-preview")).not.toBeInTheDocument();

    // Click "Show Preview"
    await user.click(screen.getByText("Show Preview"));
    expect(screen.getByTestId("multi-platform-preview")).toBeInTheDocument();

    // Click "Hide Preview"
    await user.click(screen.getByText("Hide Preview"));
    expect(screen.queryByTestId("multi-platform-preview")).not.toBeInTheDocument();
  });

  it("disables save buttons when isSaving is true", () => {
    const content = createContent();
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} isSaving={true} />);

    const saveDraftButton = screen.getByText("Saving...");
    expect(saveDraftButton).toBeDisabled();
  });

  it("adds a new hashtag when entered and add button clicked", async () => {
    const user = userEvent.setup();
    const content = createContent({ hashtags: [] });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    const hashtagInput = screen.getByPlaceholderText("Add hashtag...");
    await user.type(hashtagInput, "newtag");
    // Find the add-hashtag button next to the input
    const addButton = hashtagInput.parentElement?.querySelector("button")!;
    await user.click(addButton);

    expect(screen.getByText("#newtag")).toBeInTheDocument();
  });

  it("renders a schedule button for DRAFT content", () => {
    const content = createContent({ status: "DRAFT" });
    render(<ContentEditor content={content} onSave={onSave} onCancel={onCancel} />);

    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("renders the platform icon in the header", () => {
    const content = createContent();
    const { container } = render(
      <ContentEditor content={content} onSave={onSave} onCancel={onCancel} />,
    );

    // Platform icon is rendered as emoji text from PLATFORMS
    expect(container.innerHTML).toContain("𝕏");
  });
});
