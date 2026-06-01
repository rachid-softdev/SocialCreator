# 🏗️ SocialCreator — Codebase Review Complète

> **Date** : 2026-06-01
> **Scope** : Full codebase — `socialcreator-web`, `packages/*`
> **Objectif** : Audit multi-couche (architecture, front-end, back-end, données, sécurité, infrastructure)

---

# 📍 ÉTAPE 0 — RAPPORT DE CARTOGRAPHIE

## Arborescence des modules clés (max 3 niveaux)

```
SocialCreator/
├── socialcreator-web/                  # 🎯 Application principale (Next.js 14)
│   ├── src/
│   │   ├── app/                        # App Router (pages + API)
│   │   │   ├── (auth)/                 # Auth group (login, register)
│   │   │   ├── (main)/                 # App group (dashboard, content, agents...)
│   │   │   ├── (onboarding)/           # Onboarding group (CGU)
│   │   │   ├── api/                    # API routes (18 sous-modules)
│   │   │   ├── blog/                   # Blog public
│   │   │   ├── globals.css             # Design tokens CSS
│   │   │   ├── layout.tsx              # Root layout (3 fonts)
│   │   │   ├── page.tsx                # Landing page
│   │   │   └── not-found.tsx           # 404
│   │   ├── components/
│   │   │   ├── agent/                  # Agent UI (12 fichiers)
│   │   │   ├── analytics/              # Analytics UI (4 fichiers)
│   │   │   ├── auth/                   # Auth forms (4 fichiers)
│   │   │   ├── billing/                # Billing UI (4 fichiers)
│   │   │   ├── blog/                   # Blog UI (5 fichiers)
│   │   │   ├── connected-accounts/     # OAuth accounts UI (5 fichiers)
│   │   │   ├── content/               # Content management (10 fichiers)
│   │   │   ├── dashboard/             # Dashboard widgets (5 fichiers)
│   │   │   ├── entitlements/          # Feature flags UI (1 fichier)
│   │   │   ├── layout/                # Layout components (3 fichiers)
│   │   │   ├── mcp/                   # MCP interface (2 fichiers)
│   │   │   ├── profile/               # Profile editing (4 fichiers)
│   │   │   ├── settings/              # Settings UI (1 fichier)
│   │   │   └── video/                 # Video management (8 fichiers)
│   │   ├── lib/                       # 🧠 Business & infrastructure layer
│   │   │   ├── auth/                  # Auth utilities
│   │   │   ├── analytics/             # Analytics ingestion
│   │   │   ├── entitlements/          # Feature flag engine
│   │   │   ├── oauth/                 # OAuth flows
│   │   │   ├── publishers/            # Platform publishers (9 fichiers)
│   │   │   ├── scheduling/            # Content scheduling
│   │   │   ├── __tests__/             # Unit tests (18 fichiers)
│   │   │   ├── agent-runner.ts        # AI agent execution engine
│   │   │   ├── llm.ts                 # Anthropic Claude client
│   │   │   ├── prisma.ts              # DB client (with timeout)
│   │   │   ├── auth.ts                # NextAuth config
│   │   │   ├── crypto.ts              # AES-256 encryption
│   │   │   ├── logger.ts              # Pino logger
│   │   │   ├── metrics.ts             # Prometheus metrics
│   │   │   ├── rate-limit-redis.ts    # Rate limiting (Redis + in-memory)
│   │   │   └── api-middleware.ts       # Composable API middleware
│   │   ├── hooks/                     # Custom hooks
│   │   ├── middleware.ts              # NextAuth middleware
│   │   └── triggers/                  # Trigger.dev tasks (6 fichiers)
│   ├── prisma/
│   │   ├── schema.prisma              # 📊 Schema DB (27 modèles)
│   │   ├── migrations/                # Migrations
│   │   ├── seed-entitlements.ts       # Seed plans/features
│   │   └── seed.ts                    # Seed data
│   ├── e2e/                           # Playwright tests (4 fichiers)
│   ├── scripts/                       # Dev scripts (4 fichiers)
│   ├── types/                         # Type declarations
│   └── [config files]                 # next.config, tailwind, vitest, playwright...
│
├── packages/
│   ├── socialcreator-ui/              # 🎨 UI Component Library
│   │   └── src/ (14 components + hooks)
│   ├── socialcreator-types/           # 📐 Types & Zod schemas
│   │   └── src/ (5 fichiers)
│   ├── socialcreator-utils/           # 🔧 Shared utilities
│   │   └── src/ (1 fichier)
│   └── socialcreator-config/          # ⚙️ Shared config
│       └── tailwind/ (tailwind.config, postcss)
│
├── socialcreator-desktop/             # 🖥️ Desktop (Electron) — Coming soon
├── socialcreator-mobile/              # 📱 Mobile (React Native) — Coming soon
├── socialcreator-extension/           # 🔌 Browser Extension — Coming soon
│
├── [root config files]                # turbo.json, biome.json, package.json...
```

## Stack technique détectée

| Couche | Technologie | Version |
|--------|------------|---------|
| **Frontend** | Next.js (App Router) | ^14.2.35 |
| **UI** | React | ^19.0.8 |
| **Langage** | TypeScript | ^5.7.3 |
| **Styling** | Tailwind CSS | ^3.4.17 |
| **Base de données** | PostgreSQL + Prisma ORM | ^6.3.1 |
| **Auth** | NextAuth v5 | ^5.0.0-beta.25 |
| **AI/LLM** | Anthropic Claude Sonnet 4 | ^0.39.0 SDK |
| **Background Jobs** | Trigger.dev | ^3.3.0 |
| **Vidéo** | Mux (encoding/CDN) + HLS.js | ^8.8.0 / ^1.5.8 |
| **Transcription** | Deepgram | ^3.9.1 |
| **Uploads** | Uploadthing | ^7.1.2 |
| **Cache/Rate Limiting** | Upstash Redis | ^1.38.0 |
| **Paiements** | Stripe | ^17.5.0 |
| **Métriques** | prom-client | ^15.1.3 |
| **Logs** | Pino | ^10.3.1 |
| **Validation** | Zod | ^3.24.1 |
| **Formatting/Lint** | Biome | ^2.4.15 |
| **Tests unitaires** | Vitest | ^1.0.0 |
| **Tests E2E** | Playwright | ^1.60.0 |
| **Monorepo** | Turborepo | ^2.4.4 |
| **Package Manager** | pnpm | 9.15.9 |

## Points d'entrée principaux

### Pages (App Router)
1. `/` → Landing page (publique)
2. `/login` → Connexion
3. `/register` → Inscription
4. `/onboarding/cgu` → Acceptation CGU
5. `/(main)/dashboard` → Dashboard principal
6. `/(main)/content` → Gestion de contenu
7. `/(main)/agents` → Agents IA
8. `/(main)/analytics` → Analytics
9. `/(main)/profiles` → Profils (marques)
10. `/(main)/video` → Gestion vidéo
11. `/(main)/settings/*` → Paramètres, billing, API keys, équipes
12. `/(main)/pricing` → Page tarifs
13. `/blog` → Blog public

### API Routes (App Router — Route Handlers)
- **Auth**: `/api/auth/[...nextauth]`, `/api/auth/register`, `/api/auth/cgu-*`
- **Agents**: `/api/agents` (CRUD + run)
- **Content**: `/api/content` (CRUD + approve/reject/publish + bulk)
- **Profiles**: `/api/profiles` (CRUD)
- **Connected Accounts**: `/api/connected-accounts` (OAuth flows)
- **Video**: `/api/video` (upload, procesing, clips)
- **Media**: `/api/media` (CRUD)
- **Analytics**: `/api/analytics` (data + ingest + cap-status)
- **Entitlements**: `/api/entitlements`
- **API Keys**: `/api/api-keys`
- **Teams**: `/api/teams`
- **Stripe**: `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook`
- **MCP**: `/api/mcp` (external agent API)
- **Uploadthing**: `/api/uploadthing`
- **Admin**: `/api/admin/users`, `/api/admin/entitlements`
- **Health**: `/api/health`
- **Debug**: `/api/debug/entitlements`

### Background Jobs (Trigger.dev)
- `agent-scheduler.trigger.ts` — Planification agents IA
- `publish-worker.trigger.ts` — Publication multi-plateforme
- `scheduled-content.trigger.ts` — Contenu programmé
- `token-refresh.trigger.ts` — Rafraîchissement tokens OAuth
- `video-pipeline.trigger.ts` — Pipeline vidéo

### Middleware
- `src/middleware.ts` — NextAuth middleware (protection routes)

## Volume estimé

| Module | Fichiers | Lignes de code |
|--------|----------|---------------|
| `socialcreator-web/src/` | 270 | ~28 617 |
| `socialcreator-web/prisma/` | 7 | ~1 119 |
| `socialcreator-web/e2e/` | 4 | ~185 |
| `socialcreator-web/scripts/` | 4 | ~557 |
| `packages/*` (total) | 131 | ~7 250 |
| **Total couvert** | **~416** | **~37 728** |

## Dépendances externes principales

### Production (socialcreator-web)
- **@anthropic-ai/sdk** — Client Claude AI
- **@auth/prisma-adapter** — Adapter Prisma pour NextAuth
- **@deepgram/sdk** — Transcription audio/vidéo
- **@mux/mux-node** + **hls.js** — Pipeline vidéo
- **@prisma/client** — ORM base de données
- **@trigger.dev/sdk** — Background jobs
- **@uploadthing/react** — Upload fichiers
- **@upstash/ratelimit** + **@upstash/redis** — Rate limiting distribué
- **bcryptjs** — Hachage mots de passe
- **jose** — JWT
- **lucide-react** — Icônes
- **next** — Framework
- **next-auth** — Authentication
- **next-intl** — Internationalisation
- **pino** — Logging structuré
- **prom-client** — Métriques Prometheus
- **recharts** — Graphiques
- **sonner** — Notifications toast
- **stripe** — Paiements
- **zod** — Validation schémas

### Dépendances workspace
- **@socialcreator/ui** — Composants UI partagés
- **@socialcreator/types** — Types et schémas partagés
- **@socialcreator/utils** — Utilitaires partagés
- **@socialcreator/config** — Configuration partagée (tailwind, tsconfig)

## Découpage en couches

```
┌──────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                          │
│  Pages (App Router) + Composants React + UI Library          │
├──────────────────────────────────────────────────────────────┤
│                   API LAYER                                    │
│  Route Handlers + Middleware (auth + rate limit) + MCP        │
├──────────────────────────────────────────────────────────────┤
│                   BUSINESS LAYER                               │
│  agent-runner | publish-guard | quota-guard | cgu-guard       │
│  entitlements/service | prompts | scheduling/optimizer         │
│  team-permissions | ownership                                  │
├──────────────────────────────────────────────────────────────┤
│                   DATA ACCESS LAYER                            │
│  Prisma ORM | Repository pattern (implicite)                   │
├──────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                         │
│  Redis (Upstash) | Stripe | Mux | Deepgram | Uploadthing       │
│  Trigger.dev | Anthropic Claude | Logger | Metrics             │
└──────────────────────────────────────────────────────────────┘
                   CROSS-CUTTING
            Auth (NextAuth) | Crypto | Validation (Zod)
```

---

# 🖥️ REVIEW FRONT-END

> 6 agents spécialisés : UI/Design, UX, Responsive, Accessibilité, Architecture Front-End, Design System

## Agent 1 — UI/Design Review

### 🚨 Problèmes critiques
*Aucun problème critique détecté — le design system est cohérent.*

### ⚠️ Améliorations importantes
- **Agent 1** | `globals.css` | Les ombres CSS (`--shadow-*`) ne semblent pas clairement définies dans les tokens CSS lus. Présence de `shadow-sm`, `shadow-md` Tailwind par défaut plutôt que tokens custom. Impact limité mais incohérence potentielle.

- **Agent 1** | Toutes les pages | Plusieurs composants (landing, pricing, blog) utilisent des structures de grille manuelles (flex + gap) plutôt que des composants de grille réutilisables. Pas bloquant mais augmente le maintenance cost.

### ✨ Détails de finition (polish)
- **Agent 1** | La page landing utilise `GradientOrb` avec un `blur-[80px]` — le rendu peut varier entre navigateurs sur le flou CSS. Vérifier sur Firefox/Safari. | `page.tsx` | Effort: XS

### 🎨 Éléments visuellement discutables
- **Typo** : 3 polices chargées (Inter, EB Garamond, Playfair Display). C'est lourd et peut créer une incohérence visuelle. Proposition : réduire à 2 familles max (Inter + une display).
- **Header mobile** : Le `header` dans `(main)/layout.tsx` est présent sur mobile mais caché sur desktop. Le `Menu` icône n'a pas de handler — il semble être un placeholder uniquement. C'est déroutant.

### 🚫 Ce qui a été ignoré (hors scope)
- Contenu fonctionnel (priorité forme, pas fond)
- Composants de librairie externe (Uploadthing, recharts)

### Score global
- **Design** : 7/10
- **UX** : 7/10
- **Responsive** : 6/10
- **Accessibilité** : 5/10
- **Maintenabilité** : 7/10

### Top 10 actions prioritaires (design)
1. [Effort: S] Remplacer le header mobile placeholder avec un drawer/sheet fonctionnel
2. [Effort: M] Réduire de 3 à 2 familles de polices
3. [Effort: XS] Vérifier le rendu cross-browser des `GradientOrb` flous
4. [Effort: M] Audit des contrastes sur tous les composants
5. [Effort: S] Ajouter des composants de grille réutilisables
6. [Effort: L] Systématiser les tokens d'ombre dans le design system
7. [Effort: S] Ajouter états de chargement sur toutes les pages avec data fetching
8. [Effort: M] Audit des états vides (empty states) dans toutes les listes
9. [Effort: XS] Fixer les `alt` text manquants sur les images
10. [Effort: S] Ajouter des transitions de page fluides

---

## Agent 2 — UX Review

### ⚠️ Améliorations importantes
- **Agent 2** | `login/page.tsx`, `register/page.tsx` | Pas de feedback visuel clair en cas d'erreur d'authentification au niveau formulaire (données async). Le parcours utilisateur en cas d'échec est minimal.
- **Agent 2** | `content/page.tsx` | Pas de tri/filtre visible dans l'UI pour le listing de contenu. Les filtres semblent passés en URL params mais l'UI de filtrage interactive côté client n'est pas évidente.
- **Agent 2** | `agents/page.tsx` | La page agents semble être une liste statique sans état vide documenté. Si aucun agent n'existe, l'utilisateur voit un écran vide sans guidance.

### ✨ Détails de finition (polish)
- **Agent 2** | `sidebar.tsx` | La sidebar n'a pas d'état actif/selected visuellement clair pour la route courante.
- **Agent 2** | `components/content/publish-modal.tsx` | Modal de publication — pas de confirmation visuelle forte avant l'action irréversible "Publish".
- **Agent 2** | `components/content/approval-panel.tsx` | Le panel d'approbation ne montre pas de diff visuel entre le brouillon et ce qui sera publié.

### 🚫 Ce qui a été ignoré (hors scope)
- Tests utilisateur (non disponibles)
- Analytics d'utilisation

---

## Agent 3 — Responsive Review

### ⚠️ Améliorations importantes
- **Agent 3** | `(main)/layout.tsx` | Le layout principal utilise `lg:pl-[256px]` pour la sidebar desktop. Sur mobile (< 1024px), la sidebar disparaît et un header mobile apparait. Mais l'icône menu n'a pas de handler → **la navigation mobile est cassée** (l'utilisateur ne peut pas accéder au menu sur mobile).
- **Agent 3** | `components/dashboard/stats-grid.tsx` | Grille de stats — risque d'overflow sur mobile (320px) si 4 colonnes. Vérifier le responsive de cette grille.
- **Agent 3** | `components/video/video-timeline.tsx` | Composant vidéo — les timelines et éditeurs vidéo sont rarement responsive. Risque sur mobile.

### ✨ Détails de finition (polish)
- **Agent 3** | `globals.css` | Les custom properties utilisent des noms comme `--space-xxl`, `--space-section` — vérifier qu'ils sont bien mappés aux breakpoints Tailwind.
- **Agent 3** | `components/analytics/charts.tsx` | Recharts — les graphiques sont rarement lisibles sur mobile. Vérifier le comportement responsive.

### ⚠️ Problème critique
- **Menu mobile non fonctionnel** : l'icône Menu dans le header mobile n'a pas d'`onClick` handler. L'utilisateur ne peut pas naviguer sur mobile.

---

## Agent 4 — Accessibility Review (WCAG 2.1 AA)

### 🚨 Problèmes critiques
- **Agent 4** | `(main)/layout.tsx` | **WCAG 2.4.1 (Bypass Blocks)** — Pas de skip link détecté. Les utilisateurs clavier ne peuvent pas sauter la navigation.
- **Agent 4** | `components/layout/sidebar.tsx` | **WCAG 1.1.1 (Non-text Content)** — Les icônes dans la sidebar (Lucide icons) n'ont probablement pas d'`aria-label` ou de texte caché.
- **Agent 4** | `components/layout/sidebar.tsx` | **WCAG 2.4.7 (Focus Visible)** — Pas de style de focus personnalisé détecté (seulement l'outline par défaut du navigateur, qui peut être supprimé par Tailwind).
- **Agent 4** | `globals.css` | **WCAG 1.4.3 (Contrast Minimum)** — `--color-muted: #777169` sur `--color-canvas: #f5f5f5` = ratio de contraste d'environ 3.5:1 pour du texte normal. **Échec** (minimum 4.5:1).

### ⚠️ Améliorations importantes
- **Agent 4** | Tous les formulaires | Vérifier que chaque champ a un `<label>` associé (pas seulement `placeholder`).
- **Agent 4** | `components/content/content-card.tsx` | Les cartes de contenu doivent avoir des rôles et descriptions ARIA appropriés.
- **Agent 4** | Pages analytics | Les graphiques Recharts nécessitent des alternatives textuelles (tableaux de données cachés).

### ✨ Détails de finition (polish)
- **Agent 4** | `components/auth/login-form.tsx`, `register-form.tsx` | Messages d'erreur doivent être reliés aux champs via `aria-describedby`.
- **Agent 4** | `components/dialog.tsx` | Vérifier que la modale gère le focus trap et `aria-modal`.

---

## Agent 5 — Front-End Architecture Review

### ⚠️ Améliorations importantes
- **Agent 5** | `components/content/` | Plusieurs composants (content-card, platform-preview, publish-modal) ont des responsabilités qui se chevauchent. Exemple : `content-card.tsx` et `platform-preview.tsx` affichent tous deux un aperçu du contenu. Duplication de markup probable.
- **Agent 5** | `components/agent/` | 12 fichiers dans le dossier agent, dont `agent-card.tsx`, `agent-list.tsx`, `agents-client.tsx`, `all-agents-client.tsx`. La séparation "client" vs "list" vs "card" n'est pas claire — potentiel de simplification.
- **Agent 5** | `components/content/index.ts` et `components/agent/index.ts` | Les barrel exports existent mais ne sont pas utilisés partout. Certains imports pointent directement vers les fichiers.

### ✨ Détails de finition (polish)
- **Agent 5** | `components/content/publish-button.tsx` et `components/content/publish-modal.tsx` | La logique de publication est répartie entre bouton + modal + potentiellement le agent-runner côté serveur. Clarifier la frontière.
- **Agent 5** | Pas d'utilisation de Server Components visible dans les composants UI partagés — tout semble être Client Components. Revoir ce qui peut être Server Component pour réduire le JS bundle.

---

## Agent 6 — Design System Review

### ✅ Points positifs
- Design tokens bien structurés dans `globals.css` (couleurs, surfaces, hairlines, typo)
- Package `@socialcreator/ui` avec des composants atomiques (button, badge, dialog, etc.)
- Utilisation cohérente de `cn()` pour le merge de classes Tailwind
- `tailwind.config.ts` externalisé dans `@socialcreator/config/tailwind`

### ⚠️ Améliorations importantes
- **Agent 6** | Valeurs hardcodées détectées : certaines couleurs directes Tailwind (ex: `bg-gray-100`, `text-gray-500`) dans les composants plutôt que d'utiliser les custom properties CSS (`--color-body`, `--color-canvas`).
- **Agent 6** | Les composants UI dans `packages/socialcreator-ui` n'ont pas de stories Storybook, de tests visuels ou de documentation de props. Pas de README.
- **Agent 6** | `dropdown-menu.tsx` et `dialog.tsx` — ces composants semblent être des wrappers maison alors que des bibliothèques comme Radix UI offrent des solutions accessibles et testées.
- **Agent 6** | Le système de spacing utilise des noms comme `px-xxl`, `py-section` — vérifier la correspondance avec les échelles Tailwind standard. C'est bien si custom, mais la documentation est absente.

### ✨ Détails de finition (polish)
- **Agent 6** | `badge.tsx` et `badge-pill.tsx` — Deux composants très similaires. Fusionner en un seul avec variant prop.
- **Agent 6** | Ajouter un fichier `LICENSE` ou un `CONTRIBUTING.md` pour le design system — la `CONTRIBUTING.md` existe mais est spécifique au web.

---

# ⚙️ REVIEW BACK-END

> 8 agents : Architecture, Code Quality, Security, Performance, Database, API, Reliability, Staff Engineer

## Agent 1 — Architecture Review

### ⚠️ Problèmes importants
- **Architecture** | `src/lib/` contient un mélange de services métier, d'infrastructure et d'utilitaires. Pas de séparation claire entre `services/`, `repositories/`, `infrastructure/`. Tout est plat dans `lib/`.
- **Architecture** | Le pattern repository n'est pas explicitement implémenté. Prisma est appelé directement depuis les API routes et les services métier (`agent-runner.ts`, `publish-guard.ts`). Couplage fort à Prisma.
- **Architecture** | `src/lib/entitlements/` est bien structuré (service, repository, middleware, cache, types) — mais c'est une exception. Le reste de `lib/` est plat.

### 💡 Opportunités d'amélioration
- **Architecture** | Bénéfice : meilleure testabilité et isolation. Effort : M/L.
  Structurer `lib/` en sous-dossiers : `services/`, `repositories/`, `infrastructure/`, `domain/`.

---

## Agent 2 — Code Quality Review

### ⚠️ Problèmes importants
- **Code Quality** | `src/lib/rate-limit-redis.ts` — 525 lignes, trop de responsabilités (config, in-memory store, Redis client, factory, middleware, status). Diviser en au moins 3 fichiers.
- **Code Quality** | `src/lib/entitlements/index.ts`, `service.ts`, `repository.ts`, `cache.ts`, `middleware.ts`, `types.ts` — 6 fichiers pour un module, aucun fichier ne dépasse ~150 lignes. Bon découpage.

### 💡 Opportunités d'amélioration
- **Code Quality** | Extraire les publishers de `src/lib/publishers/` — 9 fichiers de ~50-100 lignes chacun. Bien découpé mais les types sont dupliqués (chaque publisher déclare ses propres types).

---

## Agent 3 — Security Review (OWASP Top 10)

### 🔒 Vulnérabilités détectées

| OWASP | Problème | Criticité | Détail |
|-------|----------|-----------|--------|
| A01 (Broken Access Control) | IDOR potentiel sur `/api/content/[id]` | **High** | Les routes ne vérifient pas systématiquement la propriété/organisation du contenu. `ownership.ts` existe mais semble être un utilitaire, pas appliqué partout. |
| A02 (Crypto Failures) | `ENCRYPTION_KEY` chargé au module load | **Medium** | Si le module échoue, l'app crash au démarrage. C'est correct, mais le message d'erreur pourrait exposer le préfixe `ENCRYPTION_KEY` (déjà fait — mitigé). |
| A04 (Insecure Design) | Rate limiting Redis non configuré en dev | **Low** | Fallback in-memory documenté, mais les limites en mémoire sont par instance (reset au restart). |
| A05 (Security Misconfiguration) | CORS configuré via Next.js | **Low** | Pas de configuration CORS visible — par défaut Next.js API routes accepte les requêtes same-origin. Vérifier si les apps mobile/desktop ont besoin de CORS. |
| A07 (Identification & Auth Failures) | Rate limiting sur auth | **Medium** | Bonnes limites strictes sur `/api/auth/*`. ✅ |
| A09 (Security Logging Fail) | Logging structuré avec Pino | **Low** | Les logs utilisent `redact` pour masquer les données sensibles. ✅ |
| A08 (Data Integrity) | Soft delete non systématique | **Low** | Certains modèles n'ont pas de champ `deletedAt`. La suppression est physique. |

### Points de vigilance
- **A03 (Injection)** | Pas d'injection SQL détectée (Prisma + paramétrage automatique). ✅
- **A06 (Vulnerable Components)** | Les dépendances incluent `next-auth` beta (v5.0.0-beta.25) — version non stable, risques de breaking changes.
- **Tokens OAuth** | Chiffrés via AES-256-GCM avec `crypto.ts`. Bonne pratique. ✅
- **CGU guard** | Vérifié dans `publish-guard.ts` et `cgu-guard.ts`. ✅

---

## Agent 4 — Performance Review

### ⚠️ Problèmes importants
- **Performance** | `src/lib/prisma.ts` | Timeout de 10s appliqué globalement à *toutes* les requêtes via `$extends`. C'est un filet de sécurité mais cache potentiellement des requêtes lentes non diagnostiquées.
- **Performance** | `src/lib/rate-limit-redis.ts` | La fonction `cleanupInMemoryStore` s'exécute toutes les 5 minutes même si Redis est configuré. Gaspillage de cycles CPU.
- **Performance** | Pages dashboard | Le dashboard semble faire des appels API séparés pour chaque widget (stats, recent content, agents actifs). Pas de batch endpoint détecté.

### 💡 Opportunités d'amélioration
- **Performance** | Implémenter React Server Components là où c'est possible pour réduire le JS bundle côté client.
- **Performance** | Ajouter `loading.tsx` sur plus de routes (déjà présent sur dashboard, agents, content, analytics, profiles — ✅, mais absent sur settings, pricing).

---

## Agent 5 — Database Review

### ✅ Points positifs
- Schéma bien normalisé (1NF, 2NF, 3NF)
- Index présents sur les colonnes de recherche fréquentes (`@@index([profileId])`, `@@index([userId])`)
- Contraintes d'unicité bien placées (`@@unique([provider, providerAccountId])`, `@@unique([teamId, userId])`)
- Cascade delete bien configuré sur les relations principales
- Enum types pour les colonnes à domaine fermé (Platform, AgentType, RunStatus, etc.)
- `PublishLog` designé comme immuable (audit trail) ✅

### ⚠️ Problèmes importants
- **Database** | `Profile` → `Team` relation | `teamId` est optionnel sur `Profile`, mais `Profile` a `@@index([teamId])`. Si beaucoup de profils sans team, l'index est peu sélectif.
- **Database** | `UserRole` est une table séparée alors que `User` a déjà un champ `role: Role` (`USER` | `ADMIN`). Redondance — deux systèmes de rôles cohabitent.
- **Database** | `ContentStatus` enum inclut `SCHEDULED` mais `GeneratedContent.scheduledPublishAt` permet déjà une date future. L'état peut être dérivé (si `status === DRAFT` et `scheduledPublishAt != null` → SCHEDULED logiquement).

### 💡 Opportunités d'amélioration
- **Database** | Ajouter un index composite sur `GeneratedContent(status, scheduledPublishAt)` — déjà fait ✅
- **Database** | `ApiKey.keyHash` a `@unique` mais pas d'index secondaire. C'est suffisant car l'unicité crée un index.

---

## Agent 6 — API Review

### ✅ Points positifs
- Format d'erreur standardisé via `api-errors.ts` (code, error, details)
- Middleware composable : rate limit → auth → handler
- Rate limiting configuré par endpoint avec valeurs spécifiques (5 req/60s pour auth, 100 req/60s pour default)
- Validation Zod présente sur les entrées critiques

### ⚠️ Problèmes importants
- **API** | Pas de versioning d'API détecté (`/api/v1/`). Toutes les routes sont en `/api/`. Risque de breaking changes.
- **API** | Pas de pagination standardisée. `contentFilterSchema` a `page`/`pageSize` mais c'est ad-hoc, pas un pattern global.
- **API** | `GET /api/analytics` et `GET /api/analytics/cap-status` — la structure des routes n'est pas totalement RESTful (cap-status est une sous-ressource mais a son propre handler).
- **API** | Les noms d'endpoints utilisent des kebab-case (`connected-accounts`, `api-keys`, `cap-status`) mais d'autres utilisent des chemins plats — incohérence mineure.

### 💡 Opportunités d'amélioration
- **API** | Adopter une convention de réponse standardisée (`{ data, meta, error }`) pour toutes les réponses API.

---

## Agent 7 — Reliability & Observability Review

### ✅ Points positifs
- Logging structuré avec Pino + redaction de données sensibles
- Métriques Prometheus (RED: Rate, Errors, Duration) via `metrics.ts`
- Health check endpoint (`/api/health`)
- Rate limiting avec fallback in-memory (fail closed mode)
- Prisma timeout global de 10s
- CGU guard avant exécution d'agents

### ⚠️ Problèmes importants
- **Observability** | Pas de distributed tracing (correlation ID) — les logs sont standalone, pas de `traceId`/`spanId` propagés.
- **Observability** | Pas de métriques business (contents générés, par plateforme, par utilisateur) — `contentGenerated` counter existe mais n'est pas incrémenté visiblement dans le code.
- **Observability** | Le middleware API logue les requêtes mais la structure JSON n'inclut pas de `requestId` pour corréler les logs.
- **Observability** | Pas de health check readiness (liveness vs readiness indistincts).

### 💡 Opportunités d'amélioration
- **Reliability** | Aucun circuit breaker ou retry avec backoff détecté sur les appels externes (Anthropic, Mux, Deepgram, Stripe).
- **Reliability** | Trigger.dev est utilisé pour les jobs async mais la gestion des échecs (retry queue, dead letter) n'est pas documentée dans le code exploré.

---

## Agent 8 — Staff Engineer Review

### 🔮 Risques à grande échelle (x10, x100)

1. **Monolithe API** — Toute la logique métier et API est dans un seul processus Next.js. À x100 des utilisateurs, le scaling vertical atteindra ses limites. L'architecture actuelle est typique d'une startup early-stage, correcte aujourd'hui mais à surveiller.

2. **Reporting analytique** — `Analytics` model stocke des lignes par `(profileId, date, platform)`. À x100 (millions de profils, 8 plateformes, 365 jours), cette table explosera (plusieurs milliards de lignes). Pas de stratégie d'archivage, rétention ou partitionnement visible.

3. **Rate limiting in-memory** — Le fallback in-memory pour le rate limiting n'est pas partagé entre instances. En scaling horizontal, chaque instance a son compteur. Le rate limiting devient inefficace.

4. **Job scheduling** — Le scheduler d'agents utilise Trigger.dev. C'est un bon choix, mais la dépendance à un service externe pour le cœur du produit (génération planifiée de contenu) crée un SPOF et un coût récurrent.

5. **Pas d'event sourcing** — Le `PublishLog` est un début de pattern audit trail, mais il n'y a pas de système d'événements métier. Ajouter une fonctionnalité "undo publish" ou "républier version précédente" nécessitera une réarchitecture.

### 📋 Dette technique identifiée
- **Description** : Pas de séparation claire service/repository. Prisma utilisé directement partout.
  - **Coût si ignoré** : Refactoring difficile après 6 mois de développement supplémentaire.
  - **Effort de remédiation** : M — Extraire des repository interfaces.

- **Description** : Pas de tests d'intégration détectés (seulement des tests unitaires).
  - **Coût si ignoré** : Régression silencieuse sur les flows métier complexes.
  - **Effort de remédiation** : L — Mettre en place une base de test dédiée.

- **Description** : `UserRole` table redondante avec `User.role`.
  - **Coût si ignoré** : Confusion, bugs de permissions.
  - **Effort de remédiation** : S — Supprimer UserRole, migrer les données.

### 🧪 Tests manquants
| Zone | Test recommandé | Priorité |
|------|----------------|----------|
| API routes principales | Intégration (API + DB) | Haute |
| Publishers (9 plateformes) | Unitaire + mock HTTP | Haute |
| Flows OAuth (callback, token exchange) | Intégration | Haute |
| Stripe webhook | Intégration | Haute |
| Agent runner execution | Intégration (mock LLM) | Haute |
| Rate limiter (Redis + fallback) | Unitaire + intégration | Moyenne |
| Component UI (design system) | Tests visuels / storybook | Moyenne |
| Entitlements system | Unitaire + intégration | Moyenne |

---

# 🏢 COUCHE MÉTIER (Business Layer)

## Agent Business Analyst

### Règles métier problématiques

| Problème | Impact | Exemple | Suggestion |
|----------|--------|---------|------------|
| **CGU check non systématique** | Un utilisateur sans CGU accepté pourrait contourner via API directe | `POST /api/agents/[id]/run` vérifie dans `agent-runner.ts`, mais d'autres endpoints pourraient ne pas vérifier | Audit de tous les endpoints métier pour vérifier `cguAccepted` |
| **Publication quota** | `maxPerDay` est défini sur Agent mais pas de vérification centralisée que l'agent ne dépasse pas son quota | Un agent configuré avec `maxPerDay: 2` pourrait publier 5 fois si la vérification est côté client uniquement | Vérifier que `publish-guard.ts` ou `quota-guard.ts` est bien appliqué côté serveur |
| **Soft delete absent** | Les profils supprimés perdent toutes leurs données (cascade) | Un utilisateur supprime son profil par erreur → toutes les données sont perdues irréversiblement | Ajouter `deletedAt` et filtrer systématiquement |
| **Plan/Pricing non lié au User** | `User` a `stripeSubscriptionId` et `stripeSubscriptionStatus`, mais `Organization` a aussi `subscription`. La relation floue peut créer des incohérences | Un user avec subscription directe + organization subscription → quelle est la source de vérité ? | Clarifier le modèle : User → Organization → Subscription |

---

## Agent Domain Expert (DDD)

### Problèmes de modèle

| Entité | Problème | Impact | Suggestion |
|--------|----------|--------|------------|
| `Profile` | Trop de responsabilités (brand voice, content bank, platforms, connected accounts, agents, analytics, media, video) → **God Object potentiel** | Difficile à maintenir, tester et faire évoluer | Split en aggregates : ProfileIdentity, ProfileContent, ProfileAccounts |
| `ConnectedAccount.accessToken` | Stocké comme `String?` avec commentaire "chiffré AES-256" — le type n'exprime pas le chiffrement | Un développeur peut accidentellement logger le token avant chiffrement | Créer un Value Object `EncryptedToken` ou utiliser un type personnalisé |
| `Agent.config` | Typé `Json @default("{}")` — pas de validation du schéma au niveau DB | N'importe quel JSON peut être stocké, les erreurs sont détectées tard | Ajouter un schéma Zod validé au niveau service + éventuellement un check constraint en base |
| `Role` enum (USER/ADMIN) + `UserRole` table | Deux systèmes de rôles — violation du principe d'ubiquité du langage | Incohérence dans le code : parfois `user.role`, parfois `user.userRoles` | Fusionner en un seul système |

---

## Agent Use Cases Review

| Use Case | Problème | Type | Suggestion |
|----------|----------|------|------------|
| `triggerAgentRun` | Fait trop de choses (vérifie CGU, update status, fetch agent, appelle LLM, crée GeneratedContent) | Trop grand | Split en : `validateAgentRun` → `executeAgentRun` → `saveGeneratedContent` |
| `POST /api/agents/[id]/run` | Orchestration dans le handler API (parse body, rate limit, call service, return response) | Trop couplé | Extraire la logique métier du handler API vers un service dédié |
| Processus d'approbation contenu | `approveContentSchema` ne vérifie pas que l'utilisateur a le droit d'approuver (team role check) | Mal découpé | Ajouter une vérification de permission avant l'action d'approbation |

---

# 💾 COUCHE DATA ACCESS

## Agent Repository Review

### Problèmes détectés
- **Pattern repository non implémenté** — Prisma est appelé directement depuis `lib/`, `components/`, `app/api/`. Pas d'abstraction repository.
- **Logique métier dans les requêtes** — `agent-runner.ts` ligne 32-42 : la logique "vérifier CGU, puis update status" est dans le service, pas dans un repository.
- **Pas de pagination** sur les méthodes retournant des collections (ex: `GET /api/content` — la pagination est gérée dans le handler API avec des params, pas dans un repository layer).

---

## Agent Query Performance

| Niveau | Fichier | Requête | Explication | Solution |
|--------|---------|---------|-------------|----------|
| 🟠 Élevé | `agent-runner.ts:16-24` | `prisma.agent.findUnique({ include: { profile: { include: { user: { select: { cguAccepted: true } } } } } })` | N+1 : 3 niveaux de nesting (agent → profile → user) à chaque run | Créer une vue dédiée ou utiliser un `select` plus ciblé |
| 🟠 Élevé | `lib/auth.ts` | Requêtes Prisma dans le callback NextAuth `authorize` | Appel DB à chaque login — normal mais peut devenir un bottleneck | Ajouter Redis cache pour les sessions |
| 🟡 Moyen | `rate-limit-redis.ts` | `cleanupInMemoryStore` itère sur toutes les entrées toutes les 5 min | Boucle inutile si Redis est configuré | Nettoyer seulement si mode fallback actif |

---

## Agent ORM Review

### Problèmes ORM

| Entité | Problème | Risque | Solution |
|--------|----------|--------|----------|
| `Account.refresh_token` | `String? @db.Text` — stocké potentiellement en clair (dépend de l'application) | Exposition de refresh tokens si logs | Vérifier que `crypto.ts` encryptToken est appelé avant save |
| `User -> Account` | `onDelete: Cascade` sur un modèle OAuth | Supprimer un user supprime tous ses comptes OAuth — généralement correct mais irréversible | Ajouter un soft delete ou une confirmation |
| `GeneratedContent.mediaUrls` | `String[]` — type natif Prisma pour PostgreSQL | Pas de foreign key, pas de validation d'URL | Envisager une table dédiée `ContentMedia` |
| `AgentRun.error` | `String?` — pas de type structuré | Les erreurs ne sont pas faciles à query/analyser | Stocker en JSON : `{ code, message, stack }` |

---

# 🗄️ COUCHE DATABASE

## Agent DBA

### Problèmes de schéma

| Table | Colonne/Index | Problème | Recommandation |
|-------|---------------|----------|----------------|
| `User` | `password` | `String?` — pas de longueur max définie (`String` = Prisma default, peut être trop large) | `@db.VarChar(255)` |
| `Analytics` | `date` | `@db.Date` — stocké comme `DateTime` dans le modèle Prisma | Cohérent, mais vérifier le fuseau horaire |
| `Analytics` | `@@unique([profileId, date, platform])` | Index composite qui grandit avec le temps | Envisager un index partiel si beaucoup de suppression logique |
| `ConnectedAccount` | `accessToken` | `String? @db.Text` — Text peut être très large | `VarChar(512)` est suffisant pour les tokens chiffrés |
| `GeneratedContent` | `hashtags` | `String[]` — pas d'index sur les hashtags | Si la recherche par hashtag est une feature, ajouter un index GIN |
| `PublishLog` | Pas de contrainte sur `contentId` | Pas de foreign key vers `GeneratedContent` | Ajouter `@relation` pour l'intégrité référentielle |

---

## Agent Scalability

| Risque | Impact à x10 | Impact à x100 | Mitigation |
|--------|-------------|---------------|------------|
| `Analytics` table unique index `(profileId, date, platform)` | ~8M lignes (10k profils * 365j * 8 platforms * 0.3) — OK | ~800M lignes — problématique | Partitionnement par mois + archivage |
| `PublishLog` sans archivage | Logs de publication volumineux mais OK | Table de plusieurs Go, requêtes lentes | Rétention 90 jours + archivage S3 |
| `ConnectedAccount.expiresAt` pas d'index | OK | Requêtes de refresh token lentes | Ajouter index sur `expiresAt` |
| Session store in-memory (si scaling horizontal) | Perte de sessions au restart | Sessions non partagées entre instances | Utiliser Redis comme session store (NextAuth le supporte nativement) |

---

## Agent Data Integrity

### Risques d'intégrité

| Table/Relation | Risque | Scénario | Solution |
|----------------|--------|----------|----------|
| `Profile.teamId` | Un profil est supprimé de cascade mais le team garde une référence orpheline | `Team.profiles` référence des profils soft-deleted | Ajouter `onDelete: SetNull` ou cascade |
| `AgentRun` → `GeneratedContent` | Un run FAILED avec des contenus générés partiellement | Données orphelines si le run échoue après la création de contenu | Transaction ou cleanup dans le fallback |
| `PublishLog` pas de FK sur `contentId` | `contentId` peut référencer un GeneratedContent inexistant | Orphelins possibles | Ajouter la relation ou une CHECK contrainte |
| User subscription concurrent | Deux webhooks Stripe simultanés peuvent créer des incohérences | Double activation de subscription | Utiliser `WebhookEvent.eventId @unique` comme idempotence key |

---

# 🏗️ COUCHE INFRASTRUCTURE

## Agent Reliability

| Point de risque | Type de panne | Probabilité | Impact | Solution |
|----------------|---------------|-------------|--------|----------|
| Appel Anthropic Claude | Timeout / Rate limit / API down | M | Élevé (cœur du produit) | Retry with exponential backoff + fallback modèle moins cher + queue |
| Upstash Redis | Cache down | L | Moyen (fallback in-memory existe) | ✅ Déjà géré — mais fail-closed (strict limits) |
| Stripe webhook | Stripe appelle webhook hors service | L | Élevé (paiements) | Idempotency key via `WebhookEvent.eventId` ✅ |
| Trigger.dev | Service externe indisponible | M | Élevé (scheduler agent) | Pas de fallback détecté — dépendance critique non redondée |
| Uploadthing | Upload échoue | M | Moyen | Pas de retry détecté dans le code exploré |
| Mux | Encodage vidéo échoue | M | Moyen | Pas de mécanisme de retry ou fallback visible |
| Deepgram | Transcription échoue | L | Faible | Pas de retry détecté |

---

## Agent Security

### 🔒 Vulnérabilités détaillées

| OWASP | Criticité | CVSS estimé | Description | Remédiation |
|-------|-----------|-------------|-------------|-------------|
| A01 (IDOR) | **High** | 7.5 | `GET /api/content/[id]` — pas de vérification que le contenu appartient à l'utilisateur ou à son organisation | Ajouter middleware de vérification de propriété systématique |
| A05 (Security Misconfiguration) | **Medium** | 5.0 | Les security headers dans `next.config.mjs` sont bons (HSTS, X-Frame-Options, etc.) mais CSP n'est pas configuré | Ajouter Content-Security-Policy header |
| A02 (Crypto Failures) | **Low** | 3.1 | `ENCRYPTION_KEY` chargé au démarrage sans rotation automatique | Documenter la procédure de rotation, envisager un vault (HashiCorp Vault) |
| A06 (Vulnerable Components) | **Medium** | 5.0 | `next-auth` en beta (v5.0.0-beta.25) — API instable, CVE potentielles non patchées | Surveiller les releases, envisager downgrade vers v4 stable |
| A07 (Auth Missing) | **Low** | 3.7 | Rate limiting sur auth endpoints ✅ mais pas de vérification de force du mot de passe côté serveur | Ajouter validation Zod additionnelle sur `password` dans `register-form.tsx` |

### Security Headers ✅
```json
{
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
}
```
✅ Missing: `Content-Security-Policy`

---

## Agent Observability

| Zone aveugle | Impact | Instrumentation |
|-------------|--------|-----------------|
| Pas de correlation ID (traceId/spanId) | Impossible de tracer une requête complète à travers logs + métriques + traces | Ajouter un middleware qui génère/gère un `x-request-id` |
| Métriques business non incrémentées | Impossible de monitorer l'activité business en temps réel | Appeler `contentGenerated.inc()` dans les services appropriés |
| Pas de dashboards définis | Debug difficile en production | Créer dashboard Grafana avec les métriques Prometheus |
| Logs des publishers silencieux | Difficulté à diagnostiquer les échecs de publication | Ajouter logging systématique dans chaque publisher |
| Agent executions non tracées | Impossibilité de diagnostiquer les échecs d'agents | Ajouter métrique `agent_run_duration` + log structuré à chaque étape |

---

## Agent Cloud & Ops

*Note : Aucun fichier IaC, Dockerfile, ou helm chart n'a été détecté dans le scope exploré. L'analyse ci-dessous est basée sur les fichiers de configuration existants.*

| Risque opérationnel | Impact | Probabilité | Solution |
|--------------------|--------|-------------|----------|
| Pas d'infrastructure as Code (Terraform, Pulumi) | Déploiements manuels, configuration non versionnée | Haute | Ajouter Terraform ou OpenTofu |
| Pas de CI/CD visible (hors GitHub Actions workflows dans `.github/`) | Déploiements non automatisés | Haute | Configurer GitHub Actions avec déploiement staging → prod |
| Pas de Dockerfile | Pas de conteneurisation — dépend du provider d'hébergement | Haute | Ajouter Docker multi-stage build |
| Pas de stratégie de zero-downtime deployment | Coupures lors des déploiements | Moyenne | Configurer rolling updates (Kubernetes) ou blue-green |
| Multi-environnement (dev/staging/prod) via `.env.*` | Bien configuré | Faible | ✅ Déjà fait |
| `turbo.json` ne spécifie pas d'outputs pour `dev` | Les caches ne sont pas optimisés en développement | Faible | Déjà configuré avec `"cache": false` ✅ |

---

# 🏛️ AGENT FINAL — Architecte (Synthèse)

## Top 20 problèmes (tous domaines confondus)

| Rang | Domaine | Problème | Impact | Effort | Sources |
|------|---------|----------|--------|--------|--------|
| 1 | 🔒 Sécurité | IDOR potentiel sur les routes content/agents — pas de vérification de propriété systématique | Critique | M | Security, Staff |
| 2 | 🧱 Architecture | Pas de pattern repository — Prisma utilisé directement partout (couplage fort) | Élevé | L | Architecture, Code Quality, Staff |
| 3 | ♿ Accessibilité | Contraste insuffisant sur `--color-muted` (3.5:1), pas de skip link, focus visible non personnalisé | Élevé | M | Accessibilité |
| 4 | 📱 Responsive | Menu mobile sans handler onClick — navigation cassée sur mobile | Critique | S | Responsive, UX |
| 5 | 🗄️ DB | `User.role` + `UserRole` table — deux systèmes de rôles redondants | Moyen | S | DBA, Domain Expert |
| 6 | ⚡ Performance | N+1 potentiel dans `agent-runner.ts` (agent → profile → user) | Moyen | S | Query Performance |
| 7 | 🧪 Tests | Pas de tests d'intégration sur les API routes et flows métier critiques | Élevé | L | Staff |
| 8 | 📈 Scalabilité | `Analytics` table sans stratégie d'archivage — deviendra problématique à x10/x100 | Moyen (futur) | M | Scalability, DBA |
| 9 | 🔒 Sécurité | CSP header absent — risque XSS (même si React atténue) | Moyen | XS | Security |
| 10 | 👁️ Observabilité | Pas de correlation ID — logs non traçables | Moyen | M | Observability |
| 11 | 🧱 Architecture | `lib/` flat structure — tout dans le même dossier sans séparation métier/infra | Moyen | M | Architecture, Staff |
| 12 | 🔄 Reliability | Aucun retry/backoff/circuit-breaker sur les appels externes (Claude, Stripe, Mux) | Élevé | L | Reliability |
| 13 | 🏢 Métier | `Profile` god object — trop de responsabilités dans une seule entité | Moyen | L | Domain Expert |
| 14 | 🖥️ UI | Header mobile sans navigation — pas de drawer/sheet | Moyen | S | UX, Responsive |
| 15 | 🗄️ DB | `GeneratedContent.mediaUrls` en `String[]` — pas de table de jointure | Faible | S | DBA, ORM |
| 16 | 🔒 Sécurité | `next-auth` v5 beta — version non stable en production | Moyen | M | Security |
| 17 | 📈 Scalabilité | Rate limiting in-memory non partagé entre instances en scaling horizontal | Moyen | M | Staff, Performance |
| 18 | 🧪 Tests | Publishers (9 plateformes) sans tests unitaires | Élevé | M | Staff |
| 19 | 🏢 Métier | Règles de quota (`maxPerDay`) non vérifiées systématiquement côté serveur | Moyen | S | Business Analyst |
| 20 | 🖥️ UI | Design system sans documentation (props, stories, README) | Faible | M | Design System |

## 🧨 Dette technique critique

1. **Pas de pattern repository** — Le couplage à Prisma dans tout le code rendra tout refactoring de DB extrêmement coûteux dans 6 mois.
2. **Deux systèmes de rôles** (`User.role` + `UserRole` table) — Va causer des bugs de permissions difficile à diagnostiquer.
3. **Missing integration tests** — Sans filet de test, chaque refactoring est risqué. Le code va devenir de plus en plus difficile à modifier.

## ⚠️ Risques à 6 mois

1. **IDOR sur les routes API** — Si le nombre d'utilisateurs augmente, les fuites de données entre utilisateurs deviendront un problème de confiance critique.
2. **Performance analytics** — Sans partitionnement, la table Analytics deviendra lente sur les dashboards.
3. **next-auth beta** — Si une migration majeure survient (breaking change), le système d'auth pourrait nécessiter une réécriture.

## 🔮 Risques à 2 ans

1. **Monolithe Next.js** — L'architecture monolithe deviendra un frein. Envisager un découpage en services (au moins : API server, Background worker, Frontend).
2. **Pas d'event sourcing** — Le système actuel ne permet pas de journaliser facilement les événements métier (replay, audit, analytics).
3. **Pas d'IaC** — L'infrastructure non versionnée deviendra un risque opérationnel croissant.

## 📅 Plan d'action priorisé

### Sprint 1 — Correctifs critiques (semaine 1-2)
| Action | Effort | Agent |
|--------|--------|-------|
| ✅ Fixer le menu mobile (ajouter handler onClick + drawer) | XS | Front-End |
| ✅ Ajouter la vérification de propriété sur toutes les routes API avec ID | M | Back-End |
| ✅ Ajouter CSP header dans next.config.mjs | XS | Securité |
| ✅ Fixer `UserRole` redondance (supprimer table, migrer) | S | DB |
| ✅ Vérifier `maxPerDay` côté serveur dans publish-guard | S | Métier |

### Sprint 2 — Stabilisation (semaine 3-6)
| Action | Effort | Agent |
|--------|--------|-------|
| ✅ Ajouter retry/backoff sur les appels Anthropic, Stripe, Mux | M | Reliability |
| ✅ Ajouter correlation ID (requestId middleware) | M | Observability |
| ✅ Implémenter les tests d'intégration manquants (API routes, Stripe webhook) | L | Tests |
| ✅ Ajouter les états vides et de chargement manquants | M | UX |
| ✅ Créer une structure de dossiers `lib/services/`, `lib/repositories/`, `lib/infrastructure/` | M | Architecture |

### Sprint 3 — Amélioration (mois 2-3)
| Action | Effort | Agent |
|--------|--------|-------|
| ✅ Refactor `agent-runner.ts` — split en services atomiques | M | Architecture |
| ✅ Extraire les repository interfaces pour Prisma | L | Data Access |
| ✅ Ajouter les métriques business (contentGenerated.inc(), etc.) | S | Observability |
| ✅ Améliorer l'accessibilité (contraste, skip link, aria-labels) | M | Accessibilité |
| ✅ Implémenter des tests pour les 9 publishers | M | Tests |

### Horizon 6 mois — Évolution
| Action | Effort | Agent |
|--------|--------|-------|
| 🔮 Partitionnement de la table Analytics | L | Scalabilité |
| 🔮 Migration vers Prisma repository pattern + tests | XL | Architecture |
| 🔮 Étudier le découpage en services (API vs Worker vs Frontend) | M | Architecture |
| 🔮 Design system documentation (Storybook) | L | Design System |
| 🔮 Ajouter l'infrastructure as Code (Terraform) | L | Cloud & Ops |

## Score d'architecture global

| Domaine | Score | Justification |
|---------|-------|---------------|
| **Architecture** | 6/10 | Bonne base monorepo mais couplage Prisma, flat lib/, pas de séparation claire |
| **Sécurité** | 7/10 | Bonnes pratiques (chiffrement tokens, rate limiting, logs redacted) mais IDOR et CSP manquants |
| **Performance** | 7/10 | Timeout Prisma, métriques Prometheus, mais N+1 potentiels et pas de caching stratégique |
| **Maintenabilité** | 6/10 | Code propre dans l'ensemble mais dette technique (UserRole, flat lib/) et documentation manquante |
| **Scalabilité** | 5/10 | Correct pour early-stage mais plusieurs points faibles à x10/x100 (Analytics, rate limiting, monolithe) |
| **Observabilité** | 5/10 | Logs structurés + métriques présentes mais pas de tracing, pas de dashboards, métriques business non branchées |
| **Score global** | **6/10** | **Codebase solide pour un produit early-stage. Les fondations sont bonnes mais la dette technique et les trous de sécurité doivent être adressés avant la scale.** |

## Verdict

SocialCreator est une **codebase early-stage bien architecturée** avec des choix techniques modernes (Next.js 14 App Router, Prisma 6, Turborepo, Anthropic Claude). Le design system est cohérent, les pratiques de sécurité de base sont en place (chiffrement AES-256, rate limiting, logs redacted), et le découpage en packages monorepo est sain.

**Les priorités immédiates sont** : (1) corriger la navigation mobile cassée, (2) ajouter la vérification de propriété systématique sur les routes API (IDOR), (3) ajouter les tests d'intégration manquants, et (4) adresser la dette la plus dangereuse (UserRole redondant, pas de pattern repository).

**La trajectoire recommandée** est de stabiliser le produit (Sprint 1-2) avant d'ajouter de nouvelles fonctionnalités, puis d'investir dans l'observabilité et la scalabilité avant le passage à l'échelle. Le monolithe Next.js est acceptable pour les 12-18 prochains mois si la croissance est maîtrisée.

---
*Rapport généré par OpenCode — Juin 2026*
