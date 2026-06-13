---
target: all pages
total_score: 22
p0_count: 0
p1_count: 2
p2_count: 5
timestamp: 2026-06-13T14-44-57Z
slug: socialcreator-web-src-app
---
# Critique Report: SocialCreator Web App (All Pages)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton loaders exist on video page; login uses "Loading..." text. No inline form validation feedback visible in code. |
| 2 | Match System / Real World | 2 | **Settings page entirely in French while rest of app is English** — jars the user mid-flow. Mixed-language experience breaks trust. |
| 3 | User Control and Freedom | 3 | Breadcrumbs on profile/agent detail pages; sign-out works. No visible undo for destructive actions. |
| 4 | Consistency and Standards | 2 | **`text-title-lg` used in 7 files but undefined** — falls through to no styling. **`shadow-soft` used in 3 files, undefined** — hover effects are inert. Code uses `window.location.href` (full reload) instead of Next.js `useRouter` on the video page. |
| 5 | Error Prevention | 2 | Error boundaries in place. No visible confirmation for destructive actions, no autosave. |
| 6 | Recognition Rather Than Recall | 3 | Sidebar uses icon+label pairs (good). Breadcrumbs appear on ~4 of 30+ app pages — user must memorize where they are elsewhere. |
| 7 | Flexibility and Efficiency | 1 | **No keyboard shortcuts anywhere.** No bulk selection or batch actions visible. No command palette. One-item-at-a-time workflows only. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean editorial aesthetic overall. The gradient orbs are well-executed atmosphere. Some pages (settings, profile detail) are denser than needed. |
| 9 | Error Recovery | 2 | Error boundaries present. No visible error recovery guidance or "try again" actions in the error boundaries seen. |
| 10 | Help and Documentation | 1 | **No help system, contextual tooltips, onboarding tours, or documentation link visible in any page code reviewed.** |
| **Total** | | **22/40** | **Acceptable** — significant improvements needed before users feel fluent. |

## Anti-Patterns Verdict

**Does this look AI-generated?** No. The ElevenLabs editorial design system gives the app a distinctive, intentional identity. There's no gradient text, no glassmorphism, no numbered section markers, no hero-metric template. The detector scan returned **zero automatic findings** — the codebase avoids the common AI slop tells. The product-specific slop tests also pass reasonably.

**Where it does feel half-finished:** missing utility tokens (`text-title-lg`, `shadow-soft`) mean pages render incorrectly. The language split (EN/FR) undermines professionalism.

## Overall Impression

This is a well-intentioned, aesthetically coherent SaaS app with a strong design system foundation. The editorial restraint is a welcome departure from the standard blue-gradient SaaS template. The gradient orbs on login, pricing, and homepage are atmospheric without being distracting.

**The single biggest opportunity:** polish and consistency. Fix the language split, missing utility classes, and floating shadow tokens.

## Priority Issues

### [P1] Language inconsistency: Settings page in French, rest of app in English
- **What**: The settings page uses French throughout. Rest of app is English.
- **Why it matters**: Mixed languages break trust and confuse users.
- **Fix**: Internationalize or pick one language.
- **Suggested command**: `/impeccable clarify settings`

### [P1] Missing utility classes: `text-title-lg` and `shadow-soft` used but never defined
- **What**: Used across 10+ files but don't exist in globals.css or tailwind config. No visual effect at runtime.
- **Why it matters**: Pages render with broken styling - invisible bugs.
- **Fix**: Add missing utility definitions.
- **Suggested command**: `/impeccable polish`

### [P2] Display font weight conflict: Tailwind says 400, globals.css says 300
- **What**: DESIGN.md and globals.css specify weight 300 for display. tailwind.config.ts overrides to 400.
- **Why it matters**: Brand consistency - the editorial signature is weight 300.
- **Fix**: Update tailwind config to weight 300.
- **Suggested command**: `/impeccable polish`

### [P2] Muted color mismatch: #777169 vs #6b6559
- **What**: Tailwind config has muted: "#777169" but globals.css has --color-muted: "#6b6559".
- **Fix**: Align tailwind config to globals.css value.
- **Suggested command**: `/impeccable polish`

### [P2] No keyboard shortcuts or power-user features
- **What**: No command palette, no bulk selection, no keyboard nav for sidebar.
- **Suggested command**: `/impeccable delight`

### [P2] window.location.href used instead of Next.js useRouter on video page
- **Fix**: Convert to useRouter or Link component.
- **Suggested command**: `/impeccable polish`

### [P3] "New Video" button links to /profiles instead of an upload page
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts, no bulk actions, no command palette. High abandonment risk.

**Jordan (First-Timer)**: Language mix confusing. No visible help or documentation anywhere.

**Sam (Accessibility)**: Focus-visible rings + skip-to-content present (good). No ARIA live regions for loading states. Need screen reader testing.

## Minor Observations
- Pricing FAQ uses `<details>` HTML element with plain "▼" character
- Gradient orb opacity stacking: wrapper + inner both apply opacity
- EB Garamond weight 300 not loaded (loaded weights: 400, 500, 600)
- Suspense fallback on login shows bare "Loading..." text
- Breadcrumbs appear on ~4 of 30+ pages - inconsistent

## Questions to Consider
- English + French? Intentional bilingual product or unfinished i18n?
- Power user path? Zero shortcuts for a content-volume tool.
- Consistent breadcrumbs everywhere?
