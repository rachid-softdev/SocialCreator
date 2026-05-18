export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: { name: string; avatar: string };
  tags: string[];
  readTime: number;
  coverImage: string;
  featured: boolean;
  type: "short" | "long";
}

export interface BlogPostsData {
  posts: BlogPost[];
}