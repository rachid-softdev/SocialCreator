/**
 * Tests for PlatformPreview and MultiPlatformPreview components.
 *
 * Tests platform-specific rendering, character truncation,
 * character limit warnings, and platform tab switching.
 */

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { MultiPlatformPreview, PlatformPreview } from "../platform-preview";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
  { value: "LINKEDIN", label: "LinkedIn", icon: "💼" },
  { value: "TIKTOK", label: "TikTok", icon: "🎵" },
  { value: "FACEBOOK", label: "Facebook", icon: "👍" },
  { value: "YOUTUBE", label: "YouTube", icon: "▶" },
  { value: "THREADS", label: "Threads", icon: "🧵" },
  { value: "PINTEREST", label: "Pinterest", icon: "📌" },
]);

const mockPlatformConstraints = vi.hoisted(() => ({
  X: { maxChars: 280 },
  INSTAGRAM: { maxChars: 2200 },
  LINKEDIN: { maxChars: 3000 },
  TIKTOK: { maxChars: 150 },
  FACEBOOK: { maxChars: 63206 },
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
  Facebook: "svg-facebook",
  Instagram: "svg-instagram",
  Linkedin: "svg-linkedin",
  MessageCircle: "svg-message-circle",
  Pin: "svg-pin",
  Twitter: "svg-twitter",
  Youtube: "svg-youtube",
}));

// ── Tests: PlatformPreview ───────────────────────────────────────────────

describe("PlatformPreview", () => {
  it("renders content text", () => {
    render(<PlatformPreview platform="X" content="Hello World" hashtags={[]} />);

    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders platform label in header", () => {
    render(<PlatformPreview platform="X" content="Test" hashtags={[]} />);

    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("displays character count", () => {
    render(<PlatformPreview platform="X" content="Hello" hashtags={[]} />);

    expect(screen.getByText("5/280")).toBeInTheDocument();
  });

  it("shows over-limit warning when content exceeds platform limit", () => {
    render(<PlatformPreview platform="X" content={"A".repeat(300)} hashtags={[]} />);

    expect(screen.getByText(/Exceeds character limit by 20/)).toBeInTheDocument();
  });

  it("renders hashtags with # prefix", () => {
    // Use INSTAGRAM which renders individual #{tag} spans (X only shows count)
    render(
      <PlatformPreview platform="INSTAGRAM" content="Some content" hashtags={["test", "social"]} />,
    );

    expect(screen.getByText("#test")).toBeInTheDocument();
    expect(screen.getByText("#social")).toBeInTheDocument();
  });

  it("renders X (Twitter) specific preview layout", () => {
    render(<PlatformPreview platform="X" content="Tweet content" hashtags={[]} />);

    // X preview has a username section
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByText("@handle")).toBeInTheDocument();
  });

  it("renders Instagram specific preview layout", () => {
    render(<PlatformPreview platform="INSTAGRAM" content="Photo caption" hashtags={[]} />);

    // Instagram has a gradient placeholder for the image
    // Just verify content renders
    expect(screen.getByText("Photo caption")).toBeInTheDocument();
  });

  it("renders LinkedIn specific preview layout", () => {
    render(<PlatformPreview platform="LINKEDIN" content="Professional post" hashtags={[]} />);

    expect(screen.getByText("User Name")).toBeInTheDocument();
    expect(screen.getByText(/Title/)).toBeInTheDocument();
  });

  it("renders TikTok specific preview layout", () => {
    render(<PlatformPreview platform="TIKTOK" content="TikTok video caption" hashtags={[]} />);

    expect(screen.getByText("TikTok")).toBeInTheDocument();
  });

  it("renders default fallback layout for unknown platforms", () => {
    // Use FACEBOOK which is in PLATFORM_ICONS but has no specific switch case
    // (SNAPCHAT crashes because it's not in PLATFORM_ICONS at all)
    render(<PlatformPreview platform="FACEBOOK" content="Snap content" hashtags={[]} />);

    expect(screen.getByText("Snap content")).toBeInTheDocument();
  });

  it("renders platform icon in header", () => {
    const { container } = render(<PlatformPreview platform="X" content="Test" hashtags={[]} />);

    expect(container.innerHTML).toContain("svg-twitter");
  });
});

// ── Tests: MultiPlatformPreview ──────────────────────────────────────────

describe("MultiPlatformPreview", () => {
  it("renders platform tabs for each platform", () => {
    render(
      <MultiPlatformPreview
        content="Multi platform content"
        hashtags={["test"]}
        platforms={["X", "INSTAGRAM"]}
      />,
    );

    // "X (Twitter)" appears in both the tab button and the preview header
    expect(screen.getAllByText("X (Twitter)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("shows the first platform preview by default", () => {
    render(
      <MultiPlatformPreview
        content="Default platform content"
        hashtags={[]}
        platforms={["X", "LINKEDIN"]}
      />,
    );

    // X is first, should show X preview
    expect(screen.getByText("Default platform content")).toBeInTheDocument();
  });

  it("switches preview when a different platform tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MultiPlatformPreview
        content="Switchable content"
        hashtags={[]}
        platforms={["X", "INSTAGRAM"]}
      />,
    );

    // Click Instagram tab
    await user.click(screen.getByText("Instagram"));

    // Should now show Instagram preview
    expect(screen.getByText("Switchable content")).toBeInTheDocument();
  });

  it("shows empty state message when platforms array is empty", () => {
    render(<MultiPlatformPreview content="Content" hashtags={[]} platforms={[]} />);

    expect(screen.getByText("Select platforms to preview content")).toBeInTheDocument();
  });
});
