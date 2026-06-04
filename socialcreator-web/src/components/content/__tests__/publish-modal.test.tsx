/**
 * Tests for PublishModal component.
 *
 * Tests modal open/close, success/error states, cap warning display,
 * and confirm/cancel actions.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PublishModal } from "../publish-modal";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPlatforms = vi.hoisted(() => [{ value: "X", label: "X (Twitter)", icon: "𝕏" }]);

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: "svg-alert-circle",
  CheckCircle: "svg-check-circle",
  ExternalLink: "svg-external-link",
  Loader2: "svg-loader",
  X: "svg-x",
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("PublishModal", () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with confirm title", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    expect(screen.getByText("Confirm Publication")).toBeInTheDocument();
  });

  it("renders platform info section", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(screen.getByText(/This content will be published to X/)).toBeInTheDocument();
  });

  it("renders cancel and publish now buttons", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Publish Now")).toBeInTheDocument();
  });

  it("calls onConfirm when Publish Now is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    await user.click(screen.getByText("Publish Now"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows loading state and disables buttons when isPublishing is true", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={true}
      />,
    );

    expect(screen.getByText("Publishing...")).toBeInTheDocument();
    // Cancel and Publish Now buttons should NOT be in footer when publishing
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish Now")).not.toBeInTheDocument();
  });

  it("shows success state when result.success is true", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        result={{ success: true, postId: "post-123", postUrl: "https://example.com/post" }}
      />,
    );

    expect(screen.getByText("Published successfully!")).toBeInTheDocument();
    expect(screen.getByText("View post")).toBeInTheDocument();
  });

  it("shows success state without view post link when postUrl is missing", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        result={{ success: true, postId: "post-123" }}
      />,
    );

    expect(screen.getByText("Published successfully!")).toBeInTheDocument();
    expect(screen.queryByText("View post")).not.toBeInTheDocument();
  });

  it("shows error state when result exists but success is false", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        result={{ success: false, error: "API rate limit exceeded" }}
      />,
    );

    expect(screen.getByText("Publication failed")).toBeInTheDocument();
    expect(screen.getByText("API rate limit exceeded")).toBeInTheDocument();
  });

  it("shows close and retry buttons in error state", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        result={{ success: false, error: "Error occurred" }}
      />,
    );

    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows cap warning when near daily limit", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        capStatus={{ count: 8, max: 10, allowed: true }}
      />,
    );

    expect(screen.getByText(/You're approaching your daily limit/)).toBeInTheDocument();
    expect(screen.getByText("8/10 posts published today")).toBeInTheDocument();
  });

  it("does not show cap warning when below 75% threshold", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        capStatus={{ count: 5, max: 10, allowed: true }}
      />,
    );

    expect(screen.queryByText(/You're approaching your daily limit/)).not.toBeInTheDocument();
  });

  it("shows remaining count when cap warning is expanded", async () => {
    const user = userEvent.setup();
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
        capStatus={{ count: 8, max: 10, allowed: true }}
      />,
    );

    // Click the warning to expand
    await user.click(screen.getByText(/You're approaching your daily limit/));

    expect(screen.getByText("2 publications remaining today")).toBeInTheDocument();
  });

  it("renders with dialog role and aria-modal", () => {
    render(
      <PublishModal
        contentId="content-1"
        platform="X"
        onClose={onClose}
        onConfirm={onConfirm}
        isPublishing={false}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
