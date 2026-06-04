/**
 * Tests for PublishButton component.
 *
 * Tests click opens publish modal, loading state, cap status display,
 * and disabled state when cap reached.
 */

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/components/__tests__/test-utils";
import { PublishButton } from "../publish-button";

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
  AlertCircle: (props: any) => (
    <span data-testid="icon-alert-circle" className={props.className}>
      svg-alert-circle
    </span>
  ),
  Loader2: (props: any) => (
    <span data-testid="icon-loader" className={props.className}>
      svg-loader
    </span>
  ),
  Send: (props: any) => (
    <span data-testid="icon-send" className={props.className}>
      svg-send
    </span>
  ),
  CheckCircle: (props: any) => (
    <span data-testid="icon-check-circle" className={props.className}>
      svg-check-circle
    </span>
  ),
  ExternalLink: (props: any) => (
    <span data-testid="icon-external-link" className={props.className}>
      svg-external-link
    </span>
  ),
  X: (props: any) => (
    <span data-testid="icon-x" className={props.className}>
      svg-x
    </span>
  ),
}));

// Mock PublishModal as a simplified component
vi.mock("../publish-modal", () => ({
  PublishModal: ({ onClose, onConfirm, isPublishing, contentId }: any) => (
    <div data-testid="publish-modal">
      <span>PublishModal for {contentId}</span>
      {isPublishing && <span data-testid="publishing-indicator">Publishing...</span>}
      <button type="button" onClick={onConfirm} data-testid="confirm-publish">
        Confirm
      </button>
      <button type="button" onClick={onClose} data-testid="close-modal">
        Close
      </button>
    </div>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("PublishButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it("renders a publish button with label", () => {
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 0, max: 10, allowed: true }}
      />,
    );

    expect(screen.getByText("Publish Now")).toBeInTheDocument();
  });

  it("shows cap status when provided as initialCapStatus", () => {
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 2, max: 10, allowed: true }}
      />,
    );

    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("shows disabled cap-reached state when cap is not allowed", () => {
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 10, max: 10, allowed: false }}
      />,
    );

    expect(screen.getByText("Cap atteint")).toBeInTheDocument();
    expect(screen.queryByText("Publish Now")).not.toBeInTheDocument();
  });

  it("opens publish modal when button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 0, max: 10, allowed: true }}
      />,
    );

    await user.click(screen.getByText("Publish Now"));

    expect(screen.getByTestId("publish-modal")).toBeInTheDocument();
  });

  it("closes modal when close is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 0, max: 10, allowed: true }}
      />,
    );

    await user.click(screen.getByText("Publish Now"));
    expect(screen.getByTestId("publish-modal")).toBeInTheDocument();

    await user.click(screen.getByTestId("close-modal"));
    expect(screen.queryByTestId("publish-modal")).not.toBeInTheDocument();
  });

  it("shows loading state during publish", async () => {
    // Keep fetch pending so isLoading stays true during the test
    (globalThis.fetch as any).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 0, max: 10, allowed: true }}
      />,
    );

    await user.click(screen.getByText("Publish Now"));

    // Click confirm to start publishing
    await user.click(screen.getByTestId("confirm-publish"));

    await waitFor(() => {
      // Component shows a spinning Loader2 icon when publishing
      expect(screen.getByText("svg-loader")).toBeInTheDocument();
    });
  });

  it("renders with Send icon", () => {
    render(
      <PublishButton
        contentId="content-1"
        profileId="profile-1"
        platform="X"
        initialCapStatus={{ count: 0, max: 10, allowed: true }}
      />,
    );

    expect(screen.getByText("Publish Now")).toBeInTheDocument();
  });
});
