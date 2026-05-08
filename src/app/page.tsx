import Link from "next/link";
import { GradientOrb } from "@/components/ui/gradient-orb";
import { FeatureCard } from "@/components/ui/feature-card";
import { NavTop } from "@/components/ui/nav-top";

export default function Home() {
  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#docs", label: "Docs" },
  ];

  const features = [
    {
      title: "AI-Powered Content",
      description: "Generate social media posts with Claude Sonnet 4. Your brand voice, automated.",
    },
    {
      title: "Multi-Platform",
      description: "Publish to Instagram, TikTok, LinkedIn, X, and more from one dashboard.",
    },
    {
      title: "Smart Scheduling",
      description: "AI schedules your content for optimal engagement times automatically.",
    },
  ];

  return (
    <main>
      <NavTop
        links={navLinks}
        cta={{ href: "/login", label: "Try Free" }}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-canvas px-xxl py-section">
        <div className="mx-auto max-w-content text-center">
          <GradientOrb color="mint" className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/4 blur-[80px]" />
          
          <h1 className="relative font-display text-display-mega text-ink">
            Social content,<br />written by AI.
          </h1>
          
          <p className="mx-auto mt-lg max-w-xl font-sans text-body-md text-body">
            SocialCreator uses AI agents to generate, schedule, and publish 
            social media content that sounds like you—on autopilot.
          </p>
          
          <div className="mt-xl flex justify-center gap-base">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-pill bg-primary px-xl py-0 text-button text-on-primary transition-colors hover:bg-primary-active"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="inline-flex h-10 items-center rounded-pill border border-hairline-strong px-xl py-0 text-button text-ink transition-colors hover:border-primary"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-canvas-soft px-xxl py-section">
        <div className="mx-auto max-w-content">
          <h2 className="font-display text-display-lg text-ink">
            Built for modern brands
          </h2>
          
          <div className="mt-xl grid grid-cols-1 gap-lg md:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title}>
                <h3 className="font-sans text-title-md text-ink">{feature.title}</h3>
                <p className="mt-sm font-sans text-body-md text-body">{feature.description}</p>
              </FeatureCard>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}