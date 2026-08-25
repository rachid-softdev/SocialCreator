import Link from "next/link";
import { notFound } from "next/navigation";
import { DevBadge } from "@/components/dev/DevBadge";

const links = [
  {
    title: "Publisher Sandbox",
    description: "Test content adaptation across all 8 platforms",
    href: "/dev/pages/publishers",
    gradient: "from-gradient-mint to-gradient-lavender",
  },
  {
    title: "Agent Playground",
    description: "Create test agents, inspect prompts and run outputs",
    href: "/dev/pages/agents",
    gradient: "from-gradient-lavender to-gradient-peach",
  },
  {
    title: "404 Preview",
    description: "Preview the not-found page state",
    href: "/dev/404-preview",
    gradient: "from-gradient-peach to-gradient-rose",
  },
  {
    title: "Brand Page",
    description: "Color palette, typography, and CSS variables",
    href: "/dev/brand",
    gradient: "from-gradient-mint to-gradient-sky",
  },
] as const;

const states = [
  {
    label: "Loading",
    preview: <div className="h-8 w-32 animate-pulse rounded bg-surface-strong" />,
  },
  { label: "Empty", preview: <p className="text-caption text-muted">No content yet</p> },
  {
    label: "Success",
    preview: <span className="text-body-sm text-semantic-success font-medium">Published</span>,
  },
  {
    label: "Error",
    preview: (
      <span className="text-body-sm text-semantic-error font-medium">Failed to publish</span>
    ),
  },
] as const;

export default function DevHubPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-display-md text-ink">Developer Hub</h1>
        <DevBadge />
      </div>

      <section className="mb-12">
        <h2 className="text-title-sm text-ink mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-xl border border-hairline bg-surface-card p-5 hover:shadow-card-hover transition-all"
            >
              <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${link.gradient} mb-3`} />
              <h3 className="text-body-strong text-ink group-hover:text-primary transition-colors">
                {link.title}
              </h3>
              <p className="text-caption text-muted mt-1">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-title-sm text-ink mb-4">State Previews</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {states.map((state) => (
            <div
              key={state.label}
              className="rounded-xl border border-hairline bg-surface-card p-4 flex flex-col items-center gap-3"
            >
              {state.preview}
              <span className="text-caption text-muted">{state.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
