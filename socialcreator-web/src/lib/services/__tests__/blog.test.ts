/**
 * Tests for blog service (blog.ts)
 *
 * Covers postsData, getAllPosts, getPostBySlug, getRelatedPosts,
 * getAllTags, getPostsByTag, and generateStaticParams.
 * Mocks the file system to control blog post data.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock data — must be defined before vi.mock() calls
// ---------------------------------------------------------------------------

const { mockPostsData, emptyPostsData, mockReadFileSync } = vi.hoisted(() => {
  const posts = [
    {
      slug: "third-post",
      title: "Third Post",
      date: "2024-06-10",
      tags: ["typescript", "testing"],
      excerpt: "Third post excerpt",
      content: "# Third Post\nTesting content",
      author: { name: "Author", avatar: "/avatar.png" },
      readTime: 3,
      coverImage: "/cover.jpg",
      featured: false,
      type: "short",
    },
    {
      slug: "first-post",
      title: "First Post",
      date: "2024-06-01",
      tags: ["react", "typescript"],
      excerpt: "First post excerpt",
      content: "# First Post\nContent here",
      author: { name: "Author", avatar: "/avatar.png" },
      readTime: 2,
      coverImage: "/cover.jpg",
      featured: true,
      type: "long",
    },
    {
      slug: "second-post",
      title: "Second Post",
      date: "2024-05-15",
      tags: ["nextjs", "react"],
      excerpt: "Second post excerpt",
      content: "# Second Post\nMore content",
      author: { name: "Author", avatar: "/avatar.png" },
      readTime: 4,
      coverImage: "/cover.jpg",
      featured: false,
      type: "short",
    },
  ];

  return {
    mockPostsData: { posts },
    emptyPostsData: { posts: [] },
    mockReadFileSync: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("node:fs", () => ({
  default: { readFileSync: mockReadFileSync },
  readFileSync: mockReadFileSync,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Blog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // postsData
  // ============================================

  describe("postsData", () => {
    it("should read and parse the JSON file", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { postsData } = await import("@/lib/services/blog");
      const result = postsData();

      expect(result).toEqual(mockPostsData);
    });

    it("should throw when JSON is malformed", async () => {
      mockReadFileSync.mockReturnValue("not valid json");

      const { postsData } = await import("@/lib/services/blog");
      expect(() => postsData()).toThrow();
    });
  });

  // ============================================
  // getAllPosts
  // ============================================

  describe("getAllPosts", () => {
    it("should return posts sorted by date descending (most recent first)", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getAllPosts } = await import("@/lib/services/blog");
      const posts = getAllPosts();

      // Dates: June 10 > June 1 > May 15
      expect(posts).toHaveLength(3);
      expect(posts[0]!.slug).toBe("third-post");
      expect(posts[1]!.slug).toBe("first-post");
      expect(posts[2]!.slug).toBe("second-post");
    });

    it("should return empty array when there are no posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(emptyPostsData));

      const { getAllPosts } = await import("@/lib/services/blog");
      const posts = getAllPosts();

      expect(posts).toHaveLength(0);
    });
  });

  // ============================================
  // getPostBySlug
  // ============================================

  describe("getPostBySlug", () => {
    it("should return the post matching the slug", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostBySlug } = await import("@/lib/services/blog");
      const post = getPostBySlug("first-post");

      expect(post).not.toBeNull();
      expect(post!.slug).toBe("first-post");
      expect(post!.title).toBe("First Post");
    });

    it("should return null when slug is not found", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostBySlug } = await import("@/lib/services/blog");
      const post = getPostBySlug("nonexistent-slug");

      expect(post).toBeNull();
    });

    it("should return null for empty slug string", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostBySlug } = await import("@/lib/services/blog");
      const post = getPostBySlug("");

      expect(post).toBeNull();
    });
  });

  // ============================================
  // getRelatedPosts
  // ============================================

  describe("getRelatedPosts", () => {
    it("should return related posts sorted by tag overlap, excluding the current slug", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      // "first-post" has tags ["react", "typescript"]
      // "second-post" matches "react" → score 1
      // "third-post" matches "typescript" → score 1
      const related = getRelatedPosts("first-post", ["react", "typescript"], 3);

      expect(related.find((p) => p.slug === "first-post")).toBeUndefined();
      expect(related).toHaveLength(2);
    });

    it("should respect the limit parameter (fewer posts than limit)", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("first-post", ["react", "typescript"], 1);

      expect(related).toHaveLength(1);
    });

    it("should return posts with zero relevanceScore when no tags match", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("first-post", ["unmatched-tag"], 3);

      expect(related).toHaveLength(2);
      for (const post of related) {
        expect(post).toHaveProperty("relevanceScore", 0);
      }
    });

    it("should return empty array when only the current post exists", async () => {
      const singlePostData = {
        posts: [mockPostsData.posts[0]],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(singlePostData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("third-post", ["react"], 3);

      expect(related).toHaveLength(0);
    });

    it("should sort by highest relevanceScore first", async () => {
      // Create posts with different tag overlaps
      const data = {
        posts: [
          {
            slug: "current",
            title: "Current",
            date: "2024-06-01",
            tags: ["a", "b", "c"],
            excerpt: "",
            content: "",
            author: { name: "A", avatar: "/a.png" },
            readTime: 1,
            coverImage: "/c.jpg",
            featured: false,
            type: "short" as const,
          },
          {
            slug: "high-match",
            title: "High Match",
            date: "2024-06-02",
            tags: ["a", "b", "c", "d"],
            excerpt: "",
            content: "",
            author: { name: "A", avatar: "/a.png" },
            readTime: 1,
            coverImage: "/c.jpg",
            featured: false,
            type: "short" as const,
          },
          {
            slug: "low-match",
            title: "Low Match",
            date: "2024-06-03",
            tags: ["a"],
            excerpt: "",
            content: "",
            author: { name: "A", avatar: "/a.png" },
            readTime: 1,
            coverImage: "/c.jpg",
            featured: false,
            type: "short" as const,
          },
        ],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(data));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("current", ["a", "b", "c"], 3);

      expect(related[0]!.slug).toBe("high-match"); // score 3
      expect(related[1]!.slug).toBe("low-match"); // score 1
    });
  });

  // ============================================
  // getAllTags
  // ============================================

  describe("getAllTags", () => {
    it("should return all unique tags sorted alphabetically", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getAllTags } = await import("@/lib/services/blog");
      const tags = getAllTags();

      expect(tags).toEqual(["nextjs", "react", "testing", "typescript"]);
    });

    it("should return empty array when there are no posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(emptyPostsData));

      const { getAllTags } = await import("@/lib/services/blog");
      const tags = getAllTags();

      expect(tags).toEqual([]);
    });
  });

  // ============================================
  // getPostsByTag
  // ============================================

  describe("getPostsByTag", () => {
    it("should return posts filtered by the given tag", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostsByTag } = await import("@/lib/services/blog");
      const posts = getPostsByTag("react");

      expect(posts).toHaveLength(2);
      expect(posts.map((p) => p.slug)).toEqual(["first-post", "second-post"]);
    });

    it("should return empty array when no posts have the tag", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostsByTag } = await import("@/lib/services/blog");
      const posts = getPostsByTag("nonexistent");

      expect(posts).toHaveLength(0);
    });
  });

  // ============================================
  // generateStaticParams
  // ============================================

  describe("generateStaticParams", () => {
    it("should return slug params for all posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { generateStaticParams } = await import("@/lib/services/blog");
      const params = generateStaticParams();

      expect(params).toEqual([
        { slug: "third-post" },
        { slug: "first-post" },
        { slug: "second-post" },
      ]);
    });

    it("should return empty array when there are no posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(emptyPostsData));

      const { generateStaticParams } = await import("@/lib/services/blog");
      const params = generateStaticParams();

      expect(params).toEqual([]);
    });
  });
});
