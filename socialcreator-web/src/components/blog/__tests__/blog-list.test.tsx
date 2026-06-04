/**
 * Tests for BlogList component
 *
 * Verifies: post listing, empty state, pagination, featured post rendering
 * on first page, regular posts layout.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/components/__tests__/test-utils";
import { BlogList } from "../blog-list";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@socialcreator/types/blog", () => ({}));

vi.mock("../post-card", () => ({
  PostCard: ({ post, featured }: any) => (
    <div data-testid="post-card" data-featured={featured ? "true" : "false"}>
      {post.title}
    </div>
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

function createPost(slug: string, overrides: Record<string, any> = {}) {
  return {
    slug,
    title: `Post ${slug}`,
    excerpt: `Excerpt for ${slug}`,
    content: `Full content for ${slug}`,
    date: "2025-06-01T10:00:00Z",
    readTime: 5,
    author: { name: "Test Author", avatar: "/avatar.png" },
    tags: ["tag1"],
    coverImage: "/cover.jpg",
    featured: false,
    type: "long" as const,
    ...overrides,
  };
}

const mockPosts = [
  createPost("post-1"),
  createPost("post-2", { featured: true }),
  createPost("post-3"),
  createPost("post-4"),
  createPost("post-5"),
  createPost("post-6"),
  createPost("post-7"),
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("BlogList", () => {
  it("renders all posts when fewer than postsPerPage", () => {
    render(<BlogList posts={mockPosts.slice(0, 3)} />);
    const cards = screen.getAllByTestId("post-card");
    expect(cards).toHaveLength(3);
  });

  it("renders the empty state when there are no posts", () => {
    render(<BlogList posts={[]} />);
    expect(screen.getByText("Aucun article pour le moment")).toBeInTheDocument();
    expect(
      screen.getByText("Revenez bientôt pour découvrir nos nouveaux articles."),
    ).toBeInTheDocument();
  });

  it("renders the empty state emoji", () => {
    render(<BlogList posts={[]} />);
    expect(screen.getByText("📝")).toBeInTheDocument();
  });

  it("renders featured post with featured prop on first page", () => {
    render(<BlogList posts={mockPosts} />);
    const featuredCards = screen.getAllByTestId("post-card");
    // Post 2 (featured) should render with featured=true
    const featuredEl = featuredCards.find((c) => c.getAttribute("data-featured") === "true");
    expect(featuredEl).toBeInTheDocument();
    expect(featuredEl).toHaveTextContent("Post post-2");
  });

  it("renders pagination when there are more posts than postsPerPage", () => {
    render(<BlogList posts={mockPosts} />);
    // 7 posts, 6 per page = 2 pages
    expect(screen.getByLabelText("Page précédente")).toBeInTheDocument();
    expect(screen.getByLabelText("Page suivante")).toBeInTheDocument();
  });

  it("does not render pagination when all posts fit on one page", () => {
    render(<BlogList posts={mockPosts.slice(0, 3)} />);
    expect(screen.queryByLabelText("Page précédente")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Page suivante")).not.toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    render(<BlogList posts={mockPosts} />);
    expect(screen.getByLabelText("Page précédente")).toBeDisabled();
  });

  it("navigates to next page when clicking next", async () => {
    const user = userEvent.setup();
    render(<BlogList posts={mockPosts} />);

    // Page 1 shows 6 posts (post-1 through post-6)
    expect(screen.getAllByTestId("post-card")).toHaveLength(6);

    await user.click(screen.getByLabelText("Page suivante"));

    // Page 2 shows 1 post (post-7)
    const cards = screen.getAllByTestId("post-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Post post-7");
  });

  it("disables next button on last page", async () => {
    const user = userEvent.setup();
    render(<BlogList posts={mockPosts} />);

    await user.click(screen.getByLabelText("Page suivante"));

    expect(screen.getByLabelText("Page suivante")).toBeDisabled();
  });

  it("re-enables previous button after navigating forward", async () => {
    const user = userEvent.setup();
    render(<BlogList posts={mockPosts} />);

    expect(screen.getByLabelText("Page précédente")).toBeDisabled();

    await user.click(screen.getByLabelText("Page suivante"));

    expect(screen.getByLabelText("Page précédente")).not.toBeDisabled();
  });

  it("renders 'Articles Récents' heading when there are featured posts on page 1", () => {
    render(<BlogList posts={mockPosts} />);
    expect(screen.getByText("Articles Récents")).toBeInTheDocument();
  });

  it("does not render 'Articles Récents' when there are no featured posts", () => {
    const nonFeaturedPosts = mockPosts.map((p) => ({ ...p, featured: false }));
    render(<BlogList posts={nonFeaturedPosts} />);
    expect(screen.queryByText("Articles Récents")).not.toBeInTheDocument();
  });

  it("renders page number buttons", () => {
    render(<BlogList posts={mockPosts} />);
    // 2 pages, buttons with "1" and "2"
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("highlights the current page button", () => {
    render(<BlogList posts={mockPosts} />);
    const page1Btn = screen.getByText("1");
    expect(page1Btn).toHaveClass("bg-primary");
  });
});
