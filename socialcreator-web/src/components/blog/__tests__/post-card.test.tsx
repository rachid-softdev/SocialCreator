/**
 * Tests for PostCard component
 *
 * Verifies: title, excerpt, date, author name, read time, tags, featured
 * badge, Quick Read badge, and the "Read more" / post link.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/components/__tests__/test-utils";
import { PostCard } from "../post-card";

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
  title: "Test Blog Post Title",
  excerpt: "This is a short excerpt for the blog post card.",
  content: "Full content of the blog post.",
  date: "2025-06-01T10:00:00Z",
  readTime: 5,
  author: {
    name: "John Doe",
    avatar: "/avatars/john.jpg",
  },
  tags: ["tech", "marketing", "social-media", "extra-tag"],
  coverImage: "/covers/test.jpg",
  type: "long" as const,
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("PostCard (non-featured)", () => {
  it("renders the post title", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    expect(screen.getByText("Test Blog Post Title")).toBeInTheDocument();
  });

  it("renders the post excerpt", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    expect(screen.getByText("This is a short excerpt for the blog post card.")).toBeInTheDocument();
  });

  it("renders the author name", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders the read time", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    expect(screen.getByText("5 min")).toBeInTheDocument();
  });

  it("renders tag badges (up to 3)", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    expect(screen.getByText("tech")).toBeInTheDocument();
    expect(screen.getByText("marketing")).toBeInTheDocument();
    expect(screen.getByText("social-media")).toBeInTheDocument();
    // 4th tag should not be rendered
    expect(screen.queryByText("extra-tag")).not.toBeInTheDocument();
  });

  it("renders a link to the post URL", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/blog/test-post");
  });

  it("renders the cover image with correct alt", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    const images = screen.getAllByTestId("next-image");
    const coverImage = images[0];
    expect(coverImage).toHaveAttribute("alt", "Test Blog Post Title");
  });

  it("renders the author avatar image", () => {
    render(<PostCard post={{ ...basePost, featured: false }} />);
    const images = screen.getAllByTestId("next-image");
    const avatarImage = images.find((img) => img.getAttribute("src") === "/avatars/john.jpg");
    expect(avatarImage).toBeInTheDocument();
  });

  it("renders Quick Read badge for short posts", () => {
    render(<PostCard post={{ ...basePost, featured: false, type: "short" }} />);
    expect(screen.getByText("Quick Read")).toBeInTheDocument();
  });

  it("does not render Quick Read badge for long posts", () => {
    render(<PostCard post={{ ...basePost, featured: false, type: "long" }} />);
    expect(screen.queryByText("Quick Read")).not.toBeInTheDocument();
  });
});

describe("PostCard (featured)", () => {
  it("renders the featured badge", () => {
    render(<PostCard post={{ ...basePost, featured: true }} featured />);
    expect(screen.getByText("⭐ Article Vedette")).toBeInTheDocument();
  });

  it("renders the post title in featured mode", () => {
    render(<PostCard post={{ ...basePost, featured: true }} featured />);
    expect(screen.getByText("Test Blog Post Title")).toBeInTheDocument();
  });

  it("renders the excerpt in featured mode", () => {
    render(<PostCard post={{ ...basePost, featured: true }} featured />);
    expect(screen.getByText("This is a short excerpt for the blog post card.")).toBeInTheDocument();
  });

  it("renders tag badges in featured mode (up to 3)", () => {
    render(<PostCard post={{ ...basePost, featured: true }} featured />);
    expect(screen.getByText("tech")).toBeInTheDocument();
    expect(screen.getByText("marketing")).toBeInTheDocument();
    expect(screen.getByText("social-media")).toBeInTheDocument();
  });

  it("renders a link to the post URL in featured mode", () => {
    render(<PostCard post={{ ...basePost, featured: true }} featured />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/blog/test-post");
  });

  it("renders author name in featured mode", () => {
    render(<PostCard post={{ ...basePost, featured: true }} featured />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });
});
