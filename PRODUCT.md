# Product

## Register

product

## Users

Social media managers, content creators, and marketing agencies who manage multi-platform publishing. They're power users managing 3-20+ social accounts across 8 platforms (Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Threads, Pinterest). Their daily context is a workflow of reviewing AI-generated drafts, approving content, scheduling posts, and monitoring analytics across profiles. They need speed and oversight — not more noise.

## Product Purpose

AI-powered social media content generation and publishing platform. Agents generate platform-adapted content (text posts, video clips, cross-posts) via Claude Sonnet, with human-in-the-loop approval before publishing. Covers 8 platforms via official APIs with frequency caps, immutable audit logs, and quota management per plan tier. Success means the user trusts the AI enough to review faster than they'd create from scratch, while keeping full editorial control.

## Brand Personality

Editorial, restrained, sophisticated. Three words: **quietly capable**. The brand voice is that of a premium tool for professionals — it doesn't shout features or flash saturated CTAs. It communicates through generous whitespace, thoughtful typography (lightweight serif display + clean sans body), and atmospheric color moments (soft pastel orbs) rather than chromatic branding. The design system is inspired by ElevenLabs' editorial restraint.

## Anti-references

- **SaaS-cream UIs**: Pastel-blue-and-white cookie-cutter dashboards with gradient CTAs. SocialCreator is editorial, not transactional.
- **Bold/disruptive branding**: No neon accents, no bold display type, no saturated CTA colors.
- **Dark dev-tool aesthetic**: No dark-on-dark terminal vibes. The canvas is off-white, the ink is warm near-black.
- **Card-grid monoculture**: Avoid uniform card grids as the only layout pattern. Vary presentation rhythm.
- **Gradient text / glassmorphism**: Decorative effects that add visual noise without meaning.

## Design Principles

1. **Editorial restraint** — Every element earns its place. Fewer colors, lighter weights, more whitespace. The brand's visual voltage comes from photography and atmosphere, not chromatic saturation.
2. **Ink on canvas** — The interaction model is ink (warm near-black `#292524`) on off-white canvas (`#f5f5f5`). The primary action is an ink pill — no accent color needed.
3. **Atmospheric, not chromatic** — Color exists as atmosphere (soft gradient orbs in mint/peach/lavender/sky/rose), not as functional surface fills. Never use gradient orbs as button fills or text colors.
4. **Generous editorial pacing** — 96px section rhythm, 1200px max content width. The layout breathes like a print magazine, not a data dashboard.
5. **Pill geometry** — Every CTA and badge uses pill rounding. Cards use softer geometry (16px rounding). This is the single shape signature.
6. **Lightweight display, clean body** — Display copy stays at weight 300 (EB Garamond as substitute for Waldenburg). Body is Inter at 400/500 with subtle +0.16px tracking for editorial readability.

## Accessibility & Inclusion

WCAG AA minimum. Reduced motion supported (implemented via `prefers-reduced-motion` override in globals.css). Focus-visible rings use the primary ink color with 2px offset. Skip-to-content link is first tabbable element. Color contrast not dependent on color alone — semantic meaning is carried by text labels and iconography alongside color indicators.
