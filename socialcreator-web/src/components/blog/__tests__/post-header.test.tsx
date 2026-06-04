/**
 * Tests for PostHeader component
 *
 * Verifies: title, excerpt, meta information, author, tags, back link,
 * read time, post type badge.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PostHeader } from "../post-header";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} data-testid="next-image" {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "2 months ago"),
}));

vi.mock("date-fns/locale", () => ({
  fr: {},
}));

vi.mock("@socialcreator/types/blog", () => ({}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const basePost = {
  slug: "test-post",
  title: "Understanding Social Media Algorithms",
  excerpt: "A deep dive into how social media algorithms work and how to leverage them.",
  content: "Full content of the blog post.",
  date: "2025-06-15T10:00:00Z",
  readTime: 8,
  author: {
    name: "Jane Smith",
    avatar: "/avatars/jane.jpg",
  },
  tags: ["algorithms", "social-media", "marketing"],
  coverImage: "/covers/algorithms.jpg",
  featured: false,
  type: "long" as const,
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("PostHeader", () => {
  it("renders the post title", () => {
    render(<PostHeader post={basePost} />);
    expect(screen.getByText("Understanding Social Media Algorithms")).toBeInTheDocument();
  });

  it("renders the post excerpt", () => {
    render(<PostHeader post={basePost} />);
    expect(
      screen.getByText(
        "A deep dive into how social media algorithms work and how to leverage them.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the author name", () => {
    render(<PostHeader post={basePost} />);
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders the author role label", () => {
    render(<PostHeader post={basePost} />);
    expect(screen.getByText("Auteur")).toBeInTheDocument();
  });

  it("renders the author avatar", () => {
    render(<PostHeader post={basePost} />);
    const avatar = screen.getByAltText("Jane Smith");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute("src", "/avatars/jane.jpg");
  });

  it("renders the read time with French label", () => {
    render(<PostHeader post={basePost} />);
    expect(screen.getByText("8 min de lecture")).toBeInTheDocument();
  });

  it("renders the post type badge for short posts", () => {
    render(<PostHeader post={{ ...basePost, type: "short" }} />);
    expect(screen.getByText("⚡ Quick Read")).toBeInTheDocument();
  });

  it("renders the post type badge for long posts", () => {
    render(<PostHeader post={{ ...basePost, type: "long" }} />);
    expect(screen.getByText("📖 Guide Complet")).toBeInTheDocument();
  });

  it("renders all tag links", () => {
    render(<PostHeader post={basePost} />);
    expect(screen.getByText("algorithms")).toBeInTheDocument();
    expect(screen.getByText("social-media")).toBeInTheDocument();
    expect(screen.getByText("marketing")).toBeInTheDocument();
  });

  it("renders tag links with correct href", () => {
    render(<PostHeader post={basePost} />);
    const algoLink = screen.getByText("algorithms").closest("a");
    expect(algoLink).toHaveAttribute("href", "/blog?tag=algorithms");
  });

  it("renders the back to blog link", () => {
    render(<PostHeader post={basePost} />);
    expect(screen.getByText("Retour au blog")).toBeInTheDocument();
  });

  it("renders the back link with correct href", () => {
    render(<PostHeader post={basePost} />);
    const backLink = screen.getByText("Retour au blog").closest("a");
    expect(backLink).toHaveAttribute("href", "/blog");
  });

  it("renders the breadcrumb navigation", () => {
    render(<PostHeader post={basePost} />);
    // Static "Blog" breadcrumb item
    expect(screen.getByText("Blog")).toBeInTheDocument();
  });
});
