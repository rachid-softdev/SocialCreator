/**
 * Tests for GenerationResult component.
 *
 * Renders generated content with platform badge, text, hashtags,
 * character count, and edit link.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { GenerationResult } from "../generation-result";

const mockPlatforms = vi.hoisted(() => [
  { value: "X", label: "X (Twitter)", icon: "𝕏" },
  { value: "INSTAGRAM", label: "Instagram", icon: "📷" },
]);

vi.mock("@socialcreator/types/profile", () => ({
  PLATFORMS: mockPlatforms,
}));

vi.mock("@socialcreator/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ExternalLink: "svg-external-link",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("GenerationResult", () => {
  const mockContent = {
    id: "content-1",
    platform: "X" as const,
    textContent: "Check out our new feature! It's amazing for social media managers.",
    hashtags: ["socialmedia", "marketing", "productivity"],
    status: "DRAFT" as const,
  };

  it("renders the platform badge", () => {
    render(<GenerationResult content={mockContent} />);
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
  });

  it("renders the generated text content", () => {
    render(<GenerationResult content={mockContent} />);
    expect(
      screen.getByText("Check out our new feature! It's amazing for social media managers."),
    ).toBeInTheDocument();
  });

  it("displays character count", () => {
    render(<GenerationResult content={mockContent} />);
    const charCount = mockContent.textContent.length;
    expect(screen.getByText(`${charCount} chars`)).toBeInTheDocument();
  });

  it("renders hashtags with # prefix", () => {
    render(<GenerationResult content={mockContent} />);
    expect(screen.getByText("#socialmedia")).toBeInTheDocument();
    expect(screen.getByText("#marketing")).toBeInTheDocument();
    expect(screen.getByText("#productivity")).toBeInTheDocument();
  });

  it("renders an edit link navigating to /content/{id}", () => {
    render(<GenerationResult content={mockContent} />);
    const editLink = screen.getByText("Edit");
    expect(editLink).toBeInTheDocument();
    expect(editLink.closest("a")).toHaveAttribute("href", "/content/content-1");
  });

  it("displays the ExternalLink icon", () => {
    const { container } = render(<GenerationResult content={mockContent} />);
    expect(container.innerHTML).toContain("svg-external-link");
  });

  it("renders without crashing when hashtags are empty", () => {
    const contentWithoutHashtags = { ...mockContent, hashtags: [] };
    render(<GenerationResult content={contentWithoutHashtags} />);
    // Should still render text and platform badge
    expect(screen.getByText("X (Twitter)")).toBeInTheDocument();
    expect(
      screen.getByText("Check out our new feature! It's amazing for social media managers."),
    ).toBeInTheDocument();
  });

  it("renders with a different platform", () => {
    const instagramContent = { ...mockContent, platform: "INSTAGRAM" as const };
    render(<GenerationResult content={instagramContent} />);
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });
});
