"use client";

import type { BlogPost } from "@socialcreator/types/blog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { PostCard } from "./post-card";

interface BlogListProps {
  posts: BlogPost[];
  initialPage?: number;
  postsPerPage?: number;
}

export function BlogList({ posts, initialPage = 1, postsPerPage = 6 }: BlogListProps) {
  const [page, setPage] = useState(initialPage);

  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (page - 1) * postsPerPage;
  const endIndex = startIndex + postsPerPage;
  const currentPosts = posts.slice(startIndex, endIndex);

  const featuredPosts = currentPosts.filter((p) => p.featured);
  const regularPosts = currentPosts.filter((p) => !p.featured);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="font-display text-display-sm text-ink mb-2">Aucun article pour le moment</h3>
        <p className="text-body text-muted">
          Revenez bientôt pour découvrir nos nouveaux articles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Featured post (first page only, if any) */}
      {page === 1 && featuredPosts.length > 0 && (
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredPosts.slice(0, 2).map((post) => (
              <PostCard key={post.slug} post={post} featured />
            ))}
          </div>
        </div>
      )}

      {/* Regular posts */}
      {(page === 1 ? regularPosts : [...featuredPosts, ...regularPosts]).length > 0 && (
        <div>
          {page === 1 && featuredPosts.length > 0 && (
            <h2 className="font-display text-display-md text-ink mb-6">Articles Récents</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(page === 1 ? regularPosts : [...featuredPosts, ...regularPosts]).map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-12">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-hairline text-muted hover:bg-surface-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                type="button"
                key={pageNum}
                onClick={() => goToPage(pageNum)}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-body-sm transition-colors ${
                  pageNum === page
                    ? "bg-primary text-on-primary"
                    : "text-muted hover:bg-surface-strong"
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-hairline text-muted hover:bg-surface-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Page suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
