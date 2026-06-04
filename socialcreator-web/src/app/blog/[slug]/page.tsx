import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/blog/post-card";
import { PostContent } from "@/components/blog/post-content";
import { PostHeader } from "@/components/blog/post-header";
import { ReadingProgress } from "@/components/blog/reading-progress";
import {
  getPostBySlug,
  getRelatedPosts,
  generateStaticParams as getStaticParams,
} from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Article non trouvé — SocialCreator" };
  }

  return {
    title: `${post.title} — SocialCreator Blog`,
    description: post.excerpt,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: [post.author.name],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(slug, post.tags, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "SocialCreator",
    },
    keywords: post.tags.join(", "),
  };

  return (
    <div className="min-h-screen bg-canvas">
      <ReadingProgress />
      <script
        type="application/ld+json"
        /* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, safe static content */
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Public header */}
      <header className="bg-surface-card border-b border-hairline sticky top-0 z-30">
        <div className="max-w-content mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-on-primary font-display text-title-sm">S</span>
            </div>
            <span className="font-display text-title-md text-ink">SocialCreator</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/blog" className="text-body-sm font-medium text-primary">
              Blog
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-pill bg-primary text-on-primary px-4 py-2 text-button hover:bg-primary-active transition-colors"
            >
              Commencer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Cover image */}
      <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden">
        <Image
          src={post.coverImage}
          alt={post.title}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-surface-dark/30" />
      </div>

      {/* Article content */}
      <main className="max-w-content mx-auto px-6 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Main content */}
          <article className="lg:col-span-8">
            <PostHeader post={post} />
            <PostContent content={post.content} />
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Table of contents - placeholder */}
            <div className="sticky top-24 bg-surface-card rounded-xl p-6 shadow-card">
              <h3 className="text-title-sm text-ink mb-4">Dans cet article</h3>
              <p className="text-caption text-muted">
                Les liens dans l&apos;article te permettront de naviguer facilement.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="bg-surface-card border-t border-hairline py-12 md:py-16">
          <div className="max-w-content mx-auto px-6">
            <h2 className="font-display text-display-md text-ink mb-8">Articles Similaires</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Navigation */}
      <section className="bg-canvas-soft border-t border-hairline py-12">
        <div className="max-w-content mx-auto px-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-body-sm text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à tous les articles</span>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-surface-dark text-on-dark">
        <div className="max-w-content mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="font-display text-display-lg text-on-dark mb-4">
            Tu as aimé cet article ?
          </h2>
          <p className="text-body-lg text-on-dark-soft mb-8 max-w-xl mx-auto">
            Découvre comment SocialCreator peut t&apos;aider à créer du contenu similaire pour tes
            réseaux sociaux, automatiquement.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-pill bg-on-dark text-surface-dark px-8 py-3 text-button font-medium hover:bg-gradient-mint hover:text-ink transition-all"
          >
            Essayer gratuitement
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-card border-t border-hairline py-8">
        <div className="max-w-content mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <span className="text-on-primary font-display text-caption">S</span>
            </div>
            <span className="text-caption text-muted">
              © 2025 SocialCreator. Tous droits réservés.
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-caption text-muted hover:text-ink transition-colors">
              Accueil
            </Link>
            <Link href="/blog" className="text-caption text-body-strong">
              Blog
            </Link>
            <Link
              href="/login"
              className="text-caption text-muted hover:text-ink transition-colors"
            >
              Connexion
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
