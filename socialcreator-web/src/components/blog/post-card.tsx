import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Calendar } from "lucide-react";
import type { BlogPost } from "@socialcreator/types/blog";

interface PostCardProps {
  post: BlogPost;
  featured?: boolean;
}

export function PostCard({ post, featured = false }: PostCardProps) {
  const postUrl = `/blog/${post.slug}`;

  if (featured) {
    return (
      <article className="group relative overflow-hidden rounded-xl bg-surface-card shadow-card hover:shadow-card-hover transition-all duration-300">
        <Link href={postUrl} className="block">
          <div className="relative h-72 w-full overflow-hidden">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-dark/80 via-surface-dark/20 to-transparent" />
            {post.featured && (
              <div className="absolute top-4 left-4">
                <span className="inline-flex items-center gap-1 rounded-pill bg-primary px-3 py-1 text-caption font-medium text-on-primary">
                  ⭐ Article Vedette
                </span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill bg-surface-card/20 backdrop-blur-sm px-3 py-0.5 text-caption text-body-strong"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="font-display text-display-sm text-on-dark leading-tight mb-2">
                {post.title}
              </h2>
              <p className="text-body-sm text-on-dark/80 line-clamp-2">{post.excerpt}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border-t border-hairline/20">
            <div className="flex items-center gap-2">
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                width={32}
                height={32}
                className="rounded-full"
              />
              <span className="text-caption text-on-dark/80">{post.author.name}</span>
            </div>
            <div className="flex items-center gap-1 text-caption text-on-dark/60">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {formatDistanceToNow(new Date(post.date), { addSuffix: true, locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-caption text-on-dark/60">
              <Clock className="w-3.5 h-3.5" />
              <span>{post.readTime} min</span>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-surface-card shadow-card hover:shadow-card-hover transition-all duration-300 h-full">
      <Link href={postUrl} className="flex flex-col h-full">
        <div className="relative h-48 w-full overflow-hidden flex-shrink-0">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          {post.type === "short" && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center rounded-pill bg-gradient-mint/90 px-2.5 py-0.5 text-caption font-medium text-ink">
                Quick Read
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col flex-1 p-5">
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-canvas-soft px-2.5 py-0.5 text-caption text-body"
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="font-display text-display-sm text-ink leading-tight mb-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-body-sm text-muted line-clamp-3 flex-1">{post.excerpt}</p>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-hairline">
            <div className="flex items-center gap-2">
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                width={28}
                height={28}
                className="rounded-full"
              />
              <span className="text-caption text-muted">{post.author.name}</span>
            </div>
            <div className="flex items-center gap-3 text-caption text-muted-soft">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {formatDistanceToNow(new Date(post.date), { addSuffix: true, locale: fr })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{post.readTime} min</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
