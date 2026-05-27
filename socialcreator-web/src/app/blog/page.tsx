import { ArrowRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BlogList } from "@/components/blog/blog-list";
import { postsData } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — SocialCreator | Conseils & Astuces pour les Réseaux Sociaux",
  description:
    "Découvrez nos articles sur la création de contenu, les stratégies réseaux sociaux, l'IA et les tendances marketing. Des tips concrets pourgrow your audience.",
  openGraph: {
    title: "Blog SocialCreator — Conseils pour les Réseaux Sociaux",
    description:
      "Articles, guides et tips pour maîtriser les réseaux sociaux avec l'IA. De la stratégie à l'exécution.",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog SocialCreator",
    description: "Conseils et stratégies pour créer du contenu réseaux sociaux performant.",
  },
};

export default function BlogPage() {
  const { posts } = postsData();

  // Sort by date descending
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="min-h-screen bg-canvas">
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

      {/* Hero */}
      <section className="relative overflow-hidden bg-surface-card border-b border-hairline">
        <div className="absolute inset-0 bg-gradient-to-br from-canvas-soft via-canvas to-canvas-soft opacity-50" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-gradient-mint/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-20 w-72 h-72 bg-gradient-lavender/20 rounded-full blur-3xl" />

        <div className="relative max-w-content mx-auto px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-pill bg-canvas-soft px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-caption text-body-strong">
                {posts.length} articles pour booster ta présence
              </span>
            </div>
            <h1 className="font-display text-display-mega text-ink leading-tight mb-6">
              Le Blog des Créateurs
              <br />
              <span className="text-gradient-peach">de Contenu</span>
            </h1>
            <p className="text-body-lg text-muted max-w-2xl leading-relaxed">
              Conseils pratiques, stratégies testées et tendances pour créer des réseaux sociaux qui
              cartonnent. Sans blabla, que du concret.
            </p>
          </div>
        </div>
      </section>

      {/* Blog grid */}
      <main className="max-w-content mx-auto px-6 py-12 md:py-16">
        <BlogList posts={sortedPosts} postsPerPage={6} />
      </main>

      {/* CTA Section */}
      <section className="bg-surface-dark text-on-dark">
        <div className="max-w-content mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="font-display text-display-lg text-on-dark mb-4">
            Prêt à créer du contenu qui engage ?
          </h2>
          <p className="text-body-lg text-on-dark-soft mb-8 max-w-xl mx-auto">
            SocialCreator te permet de générer des posts IA-optimisés en quelques clics. Teste
            gratuitement.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-pill bg-on-dark text-surface-dark px-8 py-3 text-button font-medium hover:bg-gradient-mint hover:text-ink transition-all"
          >
            Commencer gratuitement
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
