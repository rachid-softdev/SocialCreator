import fs from "node:fs";
import path from "node:path";
import type { BlogPost, BlogPostsData } from "@socialcreator/types/blog";

const postsFilePath = path.join(process.cwd(), "src/content/blog/posts.json");

export function postsData(): BlogPostsData {
  const fileContents = fs.readFileSync(postsFilePath, "utf8");
  return JSON.parse(fileContents) as BlogPostsData;
}

export function getAllPosts(): BlogPost[] {
  const { posts } = postsData();
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const { posts } = postsData();
  return posts.find((p) => p.slug === slug) ?? null;
}

export function getRelatedPosts(currentSlug: string, tags: string[], limit = 3): BlogPost[] {
  const { posts } = postsData();
  return posts
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({
      ...p,
      relevanceScore: p.tags.filter((t) => tags.includes(t)).length,
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

export function getAllTags(): string[] {
  const { posts } = postsData();
  const tags = new Set<string>();
  posts.forEach((p) => p.tags.forEach((t) => tags.add(t)));
  return Array.from(tags).sort();
}

export function getPostsByTag(tag: string): BlogPost[] {
  const { posts } = postsData();
  return posts.filter((p) => p.tags.includes(tag));
}

export function generateStaticParams() {
  const { posts } = postsData();
  return posts.map((post) => ({ slug: post.slug }));
}
