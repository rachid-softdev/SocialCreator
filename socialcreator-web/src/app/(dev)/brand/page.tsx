import { notFound } from "next/navigation";
import { DevBadge } from "@/components/dev/DevBadge";

const colors = [
  {
    name: "Ink",
    value: "#0c0a09",
    variable: "--color-ink",
    usage: "Background dark, primary text",
  },
  {
    name: "Primary",
    value: "#292524",
    variable: "--color-primary",
    usage: "Brand accent, buttons",
  },
  { name: "Canvas", value: "#f5f5f5", variable: "--color-canvas", usage: "Background light" },
  {
    name: "Canvas Soft",
    value: "#fafafa",
    variable: "--color-canvas-soft",
    usage: "Subtle backgrounds",
  },
  {
    name: "Surface Card",
    value: "#ffffff",
    variable: "--color-surface-card",
    usage: "Card backgrounds",
  },
  {
    name: "Hairline",
    value: "#e7e5e4",
    variable: "--color-hairline",
    usage: "Borders and dividers",
  },
  { name: "Body", value: "#4e4e4e", variable: "--color-body", usage: "Body text" },
  { name: "Muted", value: "#6b6559", variable: "--color-muted", usage: "Secondary text" },
] as const;

const gradients = [
  { name: "Mint", value: "#a7e5d3", variable: "--color-gradient-mint" },
  { name: "Lavender", value: "#c8b8e0", variable: "--color-gradient-lavender" },
  { name: "Peach", value: "#f4c5a8", variable: "--color-gradient-peach" },
  { name: "Sky", value: "#a8c8e8", variable: "--color-gradient-sky" },
  { name: "Rose", value: "#e8b8c4", variable: "--color-gradient-rose" },
] as const;

const typography = [
  {
    name: "Display Mega",
    class: "text-display-mega",
    font: "Spectral",
    sample: "The quick brown fox",
  },
  { name: "Display XL", class: "text-display-xl", font: "Spectral", sample: "The quick brown fox" },
  { name: "Display LG", class: "text-display-lg", font: "Spectral", sample: "The quick brown fox" },
  { name: "Display MD", class: "text-display-md", font: "Spectral", sample: "The quick brown fox" },
  { name: "Display SM", class: "text-display-sm", font: "Spectral", sample: "The quick brown fox" },
  { name: "Title LG", class: "text-title-lg", font: "Inter", sample: "The quick brown fox" },
  { name: "Title MD", class: "text-title-md", font: "Inter", sample: "The quick brown fox" },
  { name: "Title SM", class: "text-title-sm", font: "Inter", sample: "The quick brown fox" },
  {
    name: "Body MD",
    class: "text-body-md",
    font: "Inter",
    sample: "The quick brown fox jumps over the lazy dog",
  },
  {
    name: "Body Strong",
    class: "text-body-strong",
    font: "Inter",
    sample: "The quick brown fox jumps over the lazy dog",
  },
  {
    name: "Caption",
    class: "text-caption",
    font: "Inter",
    sample: "The quick brown fox jumps over the lazy dog",
  },
  {
    name: "Caption Uppercase",
    class: "text-caption-uppercase",
    font: "Inter",
    sample: "The quick brown fox",
  },
] as const;

export default function BrandPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-display-md text-ink">Brand Page</h1>
        <DevBadge />
      </div>

      <section className="mb-12">
        <h2 className="text-title-sm text-ink mb-4">Core Palette</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {colors.map((c) => (
            <div
              key={c.name}
              className="rounded-xl border border-hairline bg-surface-card overflow-hidden"
            >
              <div className="h-16 w-full" style={{ backgroundColor: c.value }} />
              <div className="p-3">
                <p className="text-body-strong text-ink">{c.name}</p>
                <p className="text-caption text-muted font-mono">{c.value}</p>
                <p className="text-caption text-muted-soft mt-0.5">{c.variable}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-title-sm text-ink mb-4">Gradient Orbs</h2>
        <div className="flex gap-4">
          {gradients.map((g) => (
            <div key={g.name} className="flex flex-col items-center gap-2">
              <div
                className="h-16 w-16 rounded-full shadow-soft"
                style={{ backgroundColor: g.value }}
              />
              <span className="text-caption text-muted">{g.name}</span>
              <span className="text-caption text-muted-soft font-mono">{g.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-title-sm text-ink mb-4">Typography</h2>
        <div className="space-y-6">
          {typography.map((t) => (
            <div key={t.name} className="border-b border-hairline pb-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-caption text-muted">{t.name}</span>
                <span className="text-caption text-muted-soft font-mono">{t.font}</span>
              </div>
              <p className={`${t.class} text-ink`}>{t.sample}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-title-sm text-ink mb-4">CSS Variables</h2>
        <div className="rounded-xl border border-hairline bg-surface-card p-5">
          <pre className="text-caption text-muted overflow-x-auto whitespace-pre-wrap font-mono">
            {`:root {
  --color-primary: #292524;
  --color-primary-active: #0c0a09;
  --color-ink: #0c0a09;
  --color-canvas: #f5f5f5;
  --color-canvas-soft: #fafafa;
  --color-surface-card: #ffffff;
  --color-hairline: #e7e5e4;
  --color-body: #4e4e4e;
  --color-muted: #6b6559;
  --color-on-primary: #ffffff;
  --color-on-dark: #ffffff;
  --color-gradient-mint: #a7e5d3;
  --color-gradient-lavender: #c8b8e0;
  --color-gradient-peach: #f4c5a8;
  --color-gradient-sky: #a8c8e8;
  --color-gradient-rose: #e8b8c4;
  --color-semantic-error: #dc2626;
  --color-semantic-success: #16a34a;
  --font-display: Spectral, serif;
  --font-sans: Inter, system-ui, sans-serif;
}`}
          </pre>
        </div>
      </section>
    </div>
  );
}
