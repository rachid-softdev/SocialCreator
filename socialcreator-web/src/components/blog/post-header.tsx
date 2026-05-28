import type { BlogPost } from "@socialcreator/types/blog";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PostHeaderProps {
  post: BlogPost;
}

export function PostHeader({ post }: PostHeaderProps) {
  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-6 text-caption text-muted">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au blog</span>
        </Link>
        <span>/</span>
        <span className="text-muted-soft">Blog</span>
      </nav>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map((tag) => (
          <Link
            key={tag}
            href={`/blog?tag=${tag}`}
            className="rounded-pill bg-canvas-soft px-3 py-1 text-caption text-body hover:bg-canvas transition-colors"
          >
            {tag}
          </Link>
        ))}
      </div>

      {/* Title */}
      <h1 className="font-display text-display-xl text-ink leading-tight mb-6">{post.title}</h1>

      {/* Excerpt */}
      <p className="text-body-lg text-muted leading-relaxed mb-6 max-w-3xl">{post.excerpt}</p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-6 text-body-sm text-muted">
        <div className="flex items-center gap-3">
          <Image
            src={post.author.avatar}
            alt={post.author.name}
            width={44}
            height={44}
            className="rounded-full ring-2 ring-hairline"
          />
          <div>
            <div className="text-body-strong text-ink">{post.author.name}</div>
            <div className="text-caption text-muted-soft">Auteur</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" />
          <span>{formatDistanceToNow(new Date(post.date), { addSuffix: true, locale: fr })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>{post.readTime} min de lecture</span>
        </div>
        <span
          className={`inline-flex items-center rounded-pill px-3 py-0.5 text-caption font-medium ${
            post.type === "short"
              ? "bg-gradient-mint/20 text-body-strong"
              : "bg-gradient-lavender/20 text-body-strong"
          }`}
        >
          {post.type === "short" ? "⚡ Quick Read" : "📖 Guide Complet"}
        </span>
      </div>
    </div>
  );
}
