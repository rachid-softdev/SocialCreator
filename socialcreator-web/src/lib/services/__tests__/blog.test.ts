/**
 * Tests for blog service (blog.ts)
 *
 * Covers postsData, getAllPosts, getPostBySlug, getRelatedPosts,
 * getAllTags, getPostsByTag, and generateStaticParams.
 * Mocks the file system to control blog post data.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPostsData = {
  posts: [
    {
      slug: "first-post",
      title: "First Post",
      date: "2024-06-01",
      tags: ["react", "typescript"],
      excerpt: "First post excerpt",
      content: "# First Post\nContent here",
    },
    {
      slug: "second-post",
      title: "Second Post",
      date: "2024-05-15",
      tags: ["nextjs", "react"],
      excerpt: "Second post excerpt",
      content: "# Second Post\nMore content",
    },
    {
      slug: "third-post",
      title: "Third Post",
      date: "2024-06-10",
      tags: ["typescript", "testing"],
      excerpt: "Third post excerpt",
      content: "# Third Post\nTesting content",
    },
  ],
};

const emptyPostsData = { posts: [] };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReadFileSync = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    readFileSync: mockReadFileSync,
  },
  readFileSync: mockReadFileSync,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Blog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postsData", () => {
    it("should be a function", async () => {
      const { postsData } = await import("@/lib/services/blog");
      expect(typeof postsData).toBe("function");
    });

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

  describe("getAllPosts", () => {
    it("should be a function", async () => {
      const { getAllPosts } = await import("@/lib/services/blog");
      expect(typeof getAllPosts).toBe("function");
    });

    it("should return posts sorted by date descending", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getAllPosts } = await import("@/lib/services/blog");
      const posts = getAllPosts();

      expect(posts).toHaveLength(3);
      // Third post (June 10) should be first, then first post (June 1), then second (May 15)
      expect(posts[0].slug).toBe("third-post");
      expect(posts[1].slug).toBe("first-post");
      expect(posts[2].slug).toBe("second-post");
    });

    it("should return empty array when there are no posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(emptyPostsData));

      const { getAllPosts } = await import("@/lib/services/blog");
      const posts = getAllPosts();

      expect(posts).toHaveLength(0);
    });
  });

  describe("getPostBySlug", () => {
    it("should be a function", async () => {
      const { getPostBySlug } = await import("@/lib/services/blog");
      expect(typeof getPostBySlug).toBe("function");
    });

    it("should return the post matching the slug", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostBySlug } = await import("@/lib/services/blog");
      const post = getPostBySlug("first-post");

      expect(post).not.toBeNull();
      expect(post?.title).toBe("First Post");
      expect(post?.slug).toBe("first-post");
    });

    it("should return null when slug is not found", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostBySlug } = await import("@/lib/services/blog");
      const post = getPostBySlug("nonexistent-slug");

      expect(post).toBeNull();
    });

    it("should return null for empty slug", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostBySlug } = await import("@/lib/services/blog");
      const post = getPostBySlug("");

      expect(post).toBeNull();
    });
  });

  describe("getRelatedPosts", () => {
    it("should be a function", async () => {
      const { getRelatedPosts } = await import("@/lib/services/blog");
      expect(typeof getRelatedPosts).toBe("function");
    });

    it("should return related posts based on tag overlap, excluding current slug", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      // "first-post" has tags ["react", "typescript"]
      const related = getRelatedPosts("first-post", ["react", "typescript"], 3);

      // Should exclude first-post itself
      expect(related.find((p) => p.slug === "first-post")).toBeUndefined();
      // second-post matches "react", third-post matches "typescript"
      expect(related.length).toBeGreaterThanOrEqual(1);
    });

    it("should respect the limit parameter", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("first-post", ["react", "typescript"], 1);

      expect(related).toHaveLength(1);
    });

    it("should return posts with zero relevance score when no tags match", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("first-post", ["unmatched-tag"], 3);

      // No tags match, but all remaining posts are still returned with score 0
      expect(related).toHaveLength(2);
      expect(related.every((p) => (p as any).relevanceScore === 0)).toBe(true);
    });

    it("should return empty array when only one post exists (same slug)", async () => {
      const singlePostData = {
        posts: [mockPostsData.posts[0]],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(singlePostData));

      const { getRelatedPosts } = await import("@/lib/services/blog");
      const related = getRelatedPosts("first-post", ["react"], 3);

      expect(related).toHaveLength(0);
    });
  });

  describe("getAllTags", () => {
    it("should be a function", async () => {
      const { getAllTags } = await import("@/lib/services/blog");
      expect(typeof getAllTags).toBe("function");
    });

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

  describe("getPostsByTag", () => {
    it("should be a function", async () => {
      const { getPostsByTag } = await import("@/lib/services/blog");
      expect(typeof getPostsByTag).toBe("function");
    });

    it("should return posts filtered by tag", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostsByTag } = await import("@/lib/services/blog");
      const posts = getPostsByTag("react");

      expect(posts).toHaveLength(2);
      expect(posts.map((p) => p.slug)).toEqual(["first-post", "second-post"]);
    });

    it("should return empty array when tag has no posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { getPostsByTag } = await import("@/lib/services/blog");
      const posts = getPostsByTag("nonexistent");

      expect(posts).toHaveLength(0);
    });
  });

  describe("generateStaticParams", () => {
    it("should be a function", async () => {
      const { generateStaticParams } = await import("@/lib/services/blog");
      expect(typeof generateStaticParams).toBe("function");
    });

    it("should return slug params for all posts", async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(mockPostsData));

      const { generateStaticParams } = await import("@/lib/services/blog");
      const params = generateStaticParams();

      expect(params).toEqual([
        { slug: "first-post" },
        { slug: "second-post" },
        { slug: "third-post" },
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
