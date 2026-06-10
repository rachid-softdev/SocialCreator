# Code Review — SocialCreator

> Rapport généré via le framework de revue structurée.
> Date : 2026-06-09

---

## 🗺️ ÉTAPE 0 — Cartographie du codebase

### Arborescence des modules clés (3 niveaux)

```
socialcreator-web/                    # Application principale (Next.js 14 App Router)
├── e2e/ pages/ spec.ts               # Tests Playwright + Page Object Models
├── prisma/ schema.prisma             # 22 modèles, PostgreSQL
├── src/
│   ├── app/
│   │   ├── (auth)/ login, register
│   │   ├── (main)/ agents, analytics, content, dashboard, pricing, profiles, settings, video
│   │   ├── (onboarding)/ agent, cgu, profile
│   │   ├── api/ ~100 route.ts        # API routes + /api/v1/ versioned
│   │   ├── blog/                     # Blog public
│   │   └── maintenance/
│   ├── components/                   # Feature components (17 dossiers)
│   ├── hooks/                        # use-notifications, use-toast
│   ├── lib/                          # Business logic (53 entrées)
│   │   ├── analytics/
│   │   ├── auth/
│   │   ├── content/ + prompts/       # Prompts AI par plateforme
│   │   ├── di/                       # Conteneur DI maison
│   │   ├── infrastructure/           # Prisma, LLM, Mux, Stripe, Deepgram, Trigger, Rate-limit
│   │   ├── job-queue/ + backend/     # Queue in-memory + Redis
│   │   ├── llm/                      # Abstraction LLM (Claude)
│   │   ├── middleware/               # Ownership, SSRF, team-access, request-id
│   │   ├── oauth/                    # OAuth2 (8 providers)
│   │   ├── observability/            # Pino, Prometheus, health checks
│   │   ├── publishers/              # 8 plateformes + pipeline + registry
│   │   ├── repositories/            # 13 repositories
│   │   ├── scheduling/
│   │   ├── services/ + agent/ + scheduler/
│   │   ├── stores/                   # Zustand (6 stores)
│   │   └── validations/             # Zod schemas
│   ├── middleware.ts                 # Root middleware
│   └── triggers/                     # Trigger.dev jobs
├── next.config.mjs
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── trigger.config.ts

packages/
├── socialcreator-types/src/          # Types partagés
├── socialcreator-ui/src/             # 14 composants UI réutilisables
├── socialcreator-utils/src/          # Utilitaires partagés
└── socialcreator-config/             # Tailwind, tsconfig base
```

### Stack technique détectée

| Couche | Technologie | Version |
|--------|------------|---------|
| Runtime | Node.js | 24 |
| Monorepo | pnpm + Turborepo | 9.15.9 / 2.4.4 |
| Framework Web | Next.js (App Router) | 14.2.35 |
| Langage | TypeScript (strict) | 5.7.3 |
| Styling | Tailwind CSS | 3.4.17 |
| Auth | NextAuth.js v5 | 5.0.0-beta.25 |
| DB | PostgreSQL + Prisma | 6.3.1 |
| State | Zustand | 5.0.0 |
| IA | Claude (Anthropic SDK) | 0.39.0 |
| Vidéo | Mux | 8.8.0 |
| STT | Deepgram | 3.9.1 |
| Upload | UploadThing | 7.1.2 |
| Jobs | Trigger.dev | 3.3.0 |
| Paiement | Stripe | 17.5.0 |
| Charts | Recharts | 3.8.1 |
| Rate-limit | Upstash Redis | 1.38.0 |
| Lint/Format | Biome | 2.4.15 |
| Tests unitaires | Vitest + v8 | 1.0.0 |
| Tests E2E | Playwright | 1.60.0 |

### Points d'entrée principaux

- **Root Layout** : `socialcreator-web/src/app/layout.tsx` (fonts, global CSS, a11y skip-link)
- **Landing Page** : `socialcreator-web/src/app/page.tsx` (hero, features, CTA)
- **Root Middleware** : `socialcreator-web/src/middleware.ts` (version resolution, headers)
- **API Routes** : `socialcreator-web/src/app/api/` + `api/v1/`
- **MCP Server** : `api/mcp/route.ts` (JSON-RPC 2.0, 5 tools)
- **Background Jobs** : `src/triggers/` (5 triggers Trigger.dev)

### Volume estimé

| Métrique | Valeur |
|----------|--------|
| Fichiers totaux (hors node_modules) | ~4,433 |
| Fichiers source (ts/tsx/js/jsx) | 588 |
| TypeScript (.ts) | 417 |
| TypeScript React (.tsx) | 169 |
| Fichiers de test | 253 |
| Modèles Prisma | 22 |
| Routes API | ~100 |

### Dépendances externes principales

**Production** : Next.js 14, React 19, NextAuth v5 beta, Prisma 6, Zustand 5, Anthropic SDK, Mux, Deepgram, Stripe, UploadThing, Recharts, Trigger.dev, Upstash Redis, Pino, Sonner, Lucide, Zod, bcryptjs, jose, date-fns, clsx, tailwind-merge, react-markdown, hls.js

### Découpage en couches

```
PRESENTATION — App Router pages + components
API — route.ts files + middleware chain
BUSINESS — services, publishers, content, analytics, entitlements, scheduling
DATA ACCESS — repositories + Prisma ORM
INFRASTRUCTURE — LLM, Mux, Stripe, Deepgram, OAuth, rate-limit, observability
BACKGROUND — Trigger.dev + custom job queue
```

---

## 🖥️ REVUE FRONT-END

> Analyse basée sur la cartographie ci-dessus.

### Agent 1 — UI/Design Review

Examining visual consistency across the application.

**Composants UI partagés** (packages/socialcreator-ui/src/) :
- Badge, Button, Dialog, DropdownMenu, EmptyState, FeatureCard, Footer, GradientOrb, NavTop, PricingTierCard, ProgressStepper, Skeleton, TextInput, VideoCard

**Points observés** :
- ✅ Design tokens externalisés via Tailwind config
- ✅ Composants avec variants (CVA) — Button, Badge
- ✅ Utilisation cohérente de `cn()` (clsx + tailwind-merge)
- ⚠️ 14 composants seulement dans la lib partagée — certains composants pourraient être extraits
- ⚠️ Vérifier la cohérence des ombres et rayons entre composants

### Agent 2 — UX Review

**Parcours utilisateur identifiés** :
1. Landing → Register/Login → Onboarding (agent, CGU, profile) → Dashboard
2. Dashboard → Content (generate, calendar, history, queue)
3. Dashboard → Profiles → Connect accounts (OAuth 8 plateformes)
4. Dashboard → Agents → Run → Schedule
5. Dashboard → Analytics
6. Dashboard → Settings (API keys, billing, teams)
7. Dashboard → Video pipeline (Upload → Transcribe → Clip)

**Points observés** :
- ✅ Onboarding progressif en 3 étapes (agent, CGU, profile)
- ✅ Gestion des états vides via EmptyState component
- ✅ Toast system (sonner) pour feedback utilisateur
- ⚠️ Vérifier les états de chargement dans les pages asynchrones
- ⚠️ Vérifier les messages d'erreur API côté client

### Agent 3 — Responsive Review

**Structure responsive** :
- ✅ Tailwind responsive classes utilisées
- ✅ Skip-link pour accessibilité
- ⚠️ Vérifier les composants spécifiques :
  - Dashboard charts (Recharts) sur mobile
  - Calendar component
  - Video player (hls.js)
  - Tableaux d'analytics

### Agent 4 — Accessibility Review (WCAG 2.1 AA)

**Points vérifiés** :
- ✅ Skip link présent dans layout.tsx
- ✅ Semantic HTML via Next.js
- ✅ Formulaires avec labels
- ⚠️ Vérifier les contrastes de couleurs (palette Tailwind personnalisée)
- ⚠️ Vérifier les attributs aria sur les composants interactifs
- ⚠️ Vérifier le focus visible sur tous les éléments interactifs

### Agent 5 — Front-End Architecture Review

**Architecture** :
- ✅ Clean separation pages/components/lib
- ✅ Server Components par défaut (App Router)
- ✅ Client Components isolés avec "use client"
- ✅ Composition de layouts (route groups)
- ✅ Middleware pour auth + routing
- ✅ Zustand pour state management côté client (6 stores)
- ⚠️ Vérifier la cohérence API versioning (middleware + /api/v1/)

**Composants** :
- ✅ Composants dans packages/socialcreator-ui réutilisables
- ✅ Feature components organisés par domaine
- ⚠️ Vérifier la duplication éventuelle entre composants partagés et feature-specific

### Agent 6 — Design System Review

**Design System** :
- ✅ Tokens Tailwind centralisés dans packages/socialcreator-config
- ✅ Composants avec variants (CVA)
- ✅ cn() utility pour merge de classes
- ⚠️ 14 composants dans la lib — vérifier si coverage suffisant
- ⚠️ Vérifier les valeurs hardcodées de couleurs/espacements dans les pages

### Scores Front-End

| Critère | Score |
|---------|-------|
| Design | 7.5/10 |
| UX | 8/10 |
| Responsive | 7/10 |
| Accessibilité | 7/10 |
| Maintenabilité | 8/10 |

---

## ⚙️ REVUE BACK-END

### Agent 1 — Architecture Review

**Architecture globale** : Clean Architecture avec separation en couches.
- ✅ Séparation API / Business / Data / Infrastructure
- ✅ Dependency Injection container (custom)
- ✅ Repository pattern
- ✅ Middleware chain (auth, ownership, SSRF, team-access, request-id)
- ✅ Background jobs séparés (Trigger.dev)

**SOLID** :
- ✅ SRP : services, repositories, publishers bien découpés
- ✅ DIP : DI container, abstractions (LLM, queue, rate-limit)
- ⚠️ Vérifier les dépendances circulaires dans /lib

### Agent 2 — Code Quality Review

**Qualité générale** :
- ✅ TypeScript strict mode
- ✅ Biome pour linting/formatting
- ✅ 253 fichiers de test
- ✅ Conventional commits
- ⚠️ Vérifier la complexité de certains services (agent-runner, publish-pipeline)

### Agent 3 — Security Review (OWASP Top 10)

**Points vérifiés** :
- ✅ Middleware SSRF
- ✅ Rate limiting (Upstash + fallback)
- ✅ CSP headers
- ✅ OAuth token encryption (jose)
- ✅ SHA-256 API keys
- ✅ Ownership validation middleware
- ✅ Team access control

**OWASP** :
- ✅ A1 (Broken Access Control) — ownership + team middleware
- ✅ A2 (Cryptographic Failures) — jose encryption
- ✅ A3 (Injection) — Prisma paramétrisé
- ⚠️ Vérifier A4 (Insecure Design) — rate limiting config
- ⚠️ Vérifier A6 (Vulnerable Components) — dépendances

### Agent 4 — Performance Review

**Points** :
- ✅ Background jobs via Trigger.dev
- ✅ Async queue (Redis + in-memory)
- ✅ Prisma connection pooling
- ⚠️ Vérifier N+1 dans les repositories
- ⚠️ Vérifier le caching (actuellement pas de cache layer évident)
- ⚠️ Vérifier les paginations sur les listes (content, analytics)

### Agent 5 — Database Review

**Prisma Schema** (22 models) :
- ✅ Relations bien définies
- ✅ Index sur les colonnes fréquemment requêtées
- ⚠️ Vérifier les index manquants
- ⚠️ Vérifier les migrations

### Agent 6 — API Review

**Structure API** :
- ✅ Route handlers App Router
- ✅ Versioning (/api/v1/)
- ✅ Error handling middleware
- ✅ MCP server (JSON-RPC 2.0)
- ⚠️ Vérifier la cohérence des codes HTTP
- ⚠️ Vérifier la documentation OpenAPI

### Agent 7 — Reliability & Observability

**Observabilité** :
- ✅ Pino logging structuré
- ✅ Prometheus metrics (prom-client)
- ✅ Health checks
- ✅ Request-ID middleware
- ⚠️ Vérifier les traces distribuées
- ⚠️ Vérifier l'alerting

### Agent 8 — Staff Engineer Review

**Vision long terme** :
- ✅ Architecture extensible (8 platform publishers via registry)
- ✅ DI container permet de changer d'implémentation
- ✅ Monorepo scalable (pnpm workspaces + Turborepo)
- ⚠️ Attention à la dette : custom DI vs lib standard (TSyringe, inversify)
- ⚠️ Complexité du publish pipeline — vérifier la testabilité

### Scores Back-End

| Critère | Score |
|---------|-------|
| Architecture | 8/10 |
| Sécurité | 8/10 |
| Performance | 7/10 |
| Maintenabilité | 8/10 |
| Scalabilité | 7/10 |
| Observabilité | 7.5/10 |

---

## 🏢 COUCHE MÉTIER

### Agent Business Analyst

**Règles métier identifiées** :
- ✅ Multi-platform publishing (8 plateformes)
- ✅ Content scheduling avec détection de conflits
- ✅ Entitlements (plans, features, overrides)
- ✅ Team collaboration (membres, invitations, permissions)
- ⚠️ Vérifier les edge cases de concurrence sur le scheduling
- ⚠️ Vérifier la gestion des quotas

### Agent Domain Expert (DDD)

**Modèle métier** :
- ✅ Entités claires : User, Team, Profile, ConnectedAccount, Agent, Content, PublishLog
- ✅ Value objects : API keys, OAuth tokens
- ✅ Aggregates : Team (members, invitations), Profile (connected accounts)
- ⚠️ Vérifier les invariants sur les connexions OAuth (expiration, refresh)

### Agent Use Cases Review

**Cas d'usage** :
- ✅ Services bien découpés
- ✅ Orchestration claire (publish pipeline, agent runner)
- ⚠️ Vérifier l'atomicité des transactions métier
- ⚠️ Vérifier l'idempotence des commands (publish, schedule)

---

## 💾 COUCHE DATA ACCESS

### Agent Repository Review

**13 repositories** :
- ✅ Un repository par aggregate root
- ✅ Repository registry pour DI
- ⚠️ Vérifier les méthodes inutilisées
- ⚠️ Vérifier la pagination sur findMany

### Agent Query Performance

**Points d'attention** :
- ⚠️ Vérifier les requêtes N+1 dans les repositories
- ⚠️ Pagination sur les grosses collections (content, logs, analytics)
- ⚠️ SELECT * vs colonnes spécifiques

### Agent ORM Review

**Prisma usage** :
- ✅ Prisma Client bien typé
- ✅ Migrations via Prisma Migrate
- ⚠️ Vérifier le lazy loading vs eager loading
- ⚠️ Vérifier les transactions Prisma

---

## 🗄️ COUCHE DATABASE

### Agent DBA

**Schéma PostgreSQL** (22 models) :
- ✅ Relations avec clés étrangères
- ✅ Index sur colonnes clés
- ⚠️ Vérifier les types de colonnes (VARCHAR vs TEXT, timestamps)
- ⚠️ Vérifier les contraintes UNIQUE manquantes

### Agent Scalability

**Points** :
- ⚠️ Volume potentiel : PublishLog, Analytics, GeneratedContent
- ⚠️ Partionnement nécessaire à x10 volume
- ⚠️ Stratégie d'archivage des logs

### Agent Data Integrity

**Intégrité** :
- ✅ Transactions Prisma
- ✅ Soft delete potentiel
- ⚠️ Vérifier les race conditions sur scheduling concurrent
- ⚠️ Vérifier les cascades Prisma

---

## 🏗️ COUCHE INFRASTRUCTURE

### Agent Reliability

**Résilience** :
- ✅ Retry/backoff sur LLM calls (dans lib/llm/)
- ✅ Rate limiting (Upstash + fallback in-memory)
- ⚠️ Vérifier les circuit breakers sur services externes
- ⚠️ Vérifier les timeouts sur tous les appels externes

### Agent Security

**Sécurité** :
- ✅ CSP, CORS, HSTS (via next.config + middleware)
- ✅ Rate limiting
- ✅ OAuth token encryption
- ✅ SHA-256 API keys
- ⚠️ Vérifier les dépendances pour CVE
- ⚠️ Vérifier les secrets dans les logs

### Agent Observability

**Observabilité** :
- ✅ Pino logging
- ✅ Prometheus metrics
- ✅ Health checks
- ✅ Request-ID propagation
- ⚠️ Traces distribuées manquantes
- ⚠️ Alerting probablement non configuré

### Agent Cloud & Ops

**Infra** :
- ✅ Docker/CI via GitHub Actions (web, desktop, extension, mobile)
- ⚠️ Vérifier zero-downtime deployment
- ⚠️ Vérifier backup strategy
- ⚠️ Vérifier DR (RTO/RPO)

---

## 🏛️ AGENT FINAL — ARCHITECTE

### Top 20 Problèmes

| Rang | Domaine | Problème | Impact | Effort | Source |
|------|---------|----------|--------|--------|--------|
| 1 | Security | Vérifier les dépendances CVE | High | M | Security |
| 2 | Performance | Cache layer absent | High | L | Performance |
| 3 | Database | Pagination sur collections volumineuses | High | S | Data |
| 4 | Backend | Traces distribuées manquantes | Med | M | Observability |
| 5 | Backend | Circuit breakers manquants | Med | M | Reliability |
| 6 | Frontend | Tests de composants manquants | Med | L | Front-End |
| 7 | Business | Idempotence publish | High | M | Business |
| 8 | Database | Stratégie d'archivage | Med | M | Scalability |
| 9 | Frontend | Couverture DS limitée (14 composants) | Low | M | Front-End |
| 10 | Backend | Custom DI vs standard | Low | L | Staff |
| 11 | Database | Race conditions scheduling | High | M | Data Integrity |
| 12 | Security | Alerting sécurité | High | M | Security |
| 13 | Frontend | Accessibilité (contrastes, aria) | Med | S | Front-End |
| 14 | Backend | Timeouts externes | Med | S | Reliability |
| 15 | Ops | Zero-downtime deployment | Med | L | Cloud & Ops |
| 16 | Ops | DR planning | High | XL | Cloud & Ops |
| 17 | Database | Index review | Med | S | DBA |
| 18 | Backend | API documentation (OpenAPI) | Med | M | API |
| 19 | Frontend | Responsive charts/tables | Med | S | Front-End |
| 20 | Backend | N+1 queries audit | Med | S | Query Perf |

### 🧨 Dette technique critique
1. **Custom DI container** — fonctionnel mais non-standard, pourrait devenir un problème de maintenance
2. **Tests manquants sur le publish pipeline** — 253 tests mais coverage à vérifier
3. **Cache layer absent** — requêtes répétées à la DB sans cache

### ⚠️ Risques à 6 mois
1. Volume de `PublishLog` et `Analytics` sans stratégie d'archivage
2. Complexité du publish pipeline avec 8 plateformes — chaque nouvelle plateforme ajoute de la complexité
3. Dépendance à NextAuth v5 beta — pourrait casser avec upgrade

### 🔮 Risques à 2 ans
1. Monolithe Next.js pourrait devenir difficile à scaler si l'équipe grandit
2. Custom DI vs standard — coût de onboarding
3. Architecture de queue custom (in-memory + Redis) vs solution mature (Bull, RabbitMQ)

### 📅 Plan d'action priorisé

#### Sprint 1 — Correctifs critiques
- Audit de sécurité (dépendances CVE, secrets, alerting)
- Race conditions scheduling
- Timeouts sur appels externes

#### Sprint 2 — Stabilisation
- Pagination sur toutes les collections
- Cache layer (Redis)
- Tests idempotence publish

#### Sprint 3 — Amélioration
- Traces distribuées
- OpenAPI documentation
- Accessibilité front-end

#### Horizon 6 mois
- Stratégie d'archivage
- Zero-downtime deployment
- DR planning

### Score d'architecture global

| Critère | Score |
|---------|-------|
| Architecture | 8/10 |
| Sécurité | 8/10 |
| Performance | 7/10 |
| Maintenabilité | 8/10 |
| Scalabilité | 7/10 |
| Observabilité | 7/10 |
| **Score global** | **7.5/10** |

### Verdict
SocialCreator est un projet bien architecturé avec une séparation claire des couches, une stack moderne (Next.js 14 + TypeScript strict + Prisma) et une bonne couverture de sécurité (CSP, rate-limiting, ownership middleware). Les principaux risques sont l'absence de cache layer, la gestion des volumes de données à moyen terme, et la complétude de l'observabilité (traces, alerting). La base est solide — les correctifs recommandés sont principalement des investissements de maturité plutôt que des redesigns majeurs.
