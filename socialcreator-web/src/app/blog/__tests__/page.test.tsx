// @vitest-environment jsdom
/**
 * Smoke tests for the Blog page (src/app/blog/page.tsx)
 *
 * Verifies:
 * - The page renders without crashing
 * - Key sections (hero, blog grid) are present
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlogPage from "../page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/blog", () => ({
  postsData: () => ({
    posts: [
      {
        slug: "test-post",
        title: "Test Blog Post",
        excerpt: "This is a test excerpt",
        date: "2025-01-15",
        author: { name: "Test Author", avatar: "/avatar.jpg" },
        coverImage: "/cover.jpg",
        tags: ["social-media"],
        content: "<p>Test content</p>",
        readingTime: { text: "5 min read", minutes: 5, time: 300, words: 1000 },
      },
    ],
  }),
}));

vi.mock("@/components/blog/blog-list", () => ({
  BlogList: ({ posts }: { posts: unknown[] }) => (
    <div data-testid="blog-list" data-posts-count={posts.length} />
  ),
}));

describe("BlogPage", () => {
  it("renders without crashing", () => {
    render(<BlogPage />);

    expect(screen.getByText(/le blog des créateurs/i)).toBeInTheDocument();
  });

  it("displays the post count badge", () => {
    render(<BlogPage />);

    expect(screen.getByText(/1 article/i)).toBeInTheDocument();
  });

  it("renders the blog list with posts", () => {
    render(<BlogPage />);

    const blogList = screen.getByTestId("blog-list");
    expect(blogList).toBeInTheDocument();
    expect(blogList).toHaveAttribute("data-posts-count", "1");
  });

  it("renders the CTA section", () => {
    render(<BlogPage />);

    expect(screen.getByText(/prêt à créer du contenu/i)).toBeInTheDocument();
  });
});
