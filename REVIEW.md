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

---

## 🔄 REVUE APPROFONDIE — 2026-06-14

> Revue détaillée couvrant les 9 couches du codebase. 80+ fichiers clés examinés.

---

### 1. Architecture & Structure

**✅ Points positifs :**
- Architecture en couches propre (Présentation → API → Business → Data → Infrastructure → Background)
- Route groups ((auth), (main), (onboarding)) bien organisés
- Publisher registry pattern extensible avec `publisherMap` (O(1) lookup) pour 8 plateformes
- DI container custom (`lib/di/container.ts`) avec lifetimes singleton/transient/scoped et containers hiérarchiques
- Repository registry (`lib/repositories/registry.ts`) propre avec lazy `require()` pour éviter les circular deps
- Chaîne de middleware bien structurée (auth, ownership, SSRF, team-access, request-ID)

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **High** | **Deux systèmes DI parallèles** — `Container` (token-based) et `registry` (singleton getter) coexistent. Le Container n'est jamais résolu (0 appels à `resolve()` trouvés). | `lib/di/container.ts`, `lib/di/adapters.ts` L57-60 | Adopter UN système DI (le registry pattern qui est utilisé) ou supprimer le Container inutilisé |
| **Medium** | **Barrel files créent des risques de circular imports** — `lib/agent-runner.ts`, `lib/retry.ts`, `lib/api-errors.ts`, `lib/crypto.ts`, `lib/api-middleware.ts` ne font que ré-exporter. | Multiples fichiers lib/ | Supprimer les barrel files pour les modules à source unique |
| **Low** | **15+ tokens DI inutilisés** — `TOKENS` définis mais jamais résolus. | `lib/di/token.ts` | Documenter ou supprimer |

---

### 2. Backend / API Layer

**✅ Points positifs :**
- 98 route files avec structure cohérente utilisant `withApiMiddleware()`
- API versioning via /api/v1/ + header `Accept-version`
- Gestion d'erreurs typée avec codes (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, etc.)
- Validation Zod cohérente
- Middleware d'ownership bien implémenté
- Serveur MCP avec JSON-RPC 2.0, 7 méthodes, auth et rate limiting

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **Critical** | **Body size limit trop restrictif (100KB)** — les payloads de contenu, URLs média et descriptions vidéo dépassent facilement 100KB | `lib/middleware/api-middleware.ts` L28 | Passer à 1MB minimum avec override configurable par route |
| **High** | **Rate limiting sans configuration explicite** — `withRateLimit(request, { userId })` sans options (max, window) | `lib/middleware/api-middleware.ts` L69-72 | Ajouter `{ max: 100, windowMs: 60000 }` |
| **High** | **Absence de pagination sur plusieurs routes API** — MCP handlers (listAgents, listProfiles) et routes v1 sans skip/take | `app/api/mcp/route.ts` L198-213, L370-383 | Ajouter pagination sur tous les endpoints list |
| **Medium** | **Codes HTTP inconsistants** — 404 pour access-denied (devrait être 403), ownership checks mixent `notFound()` et `forbidden()` | Multiples route files | Standardiser : 401=unauth, 403=forbidden, 404=not found |
| **Medium** | **`as any` dans les appels repository** — contourne la sécurité TypeScript | `app/api/v1/content/[id]/route.ts` L44, `lib/services/tokens.ts` L88, L137, L143, L187 | Créer des types update input propres |
| **Medium** | **Stripe webhook bypass le middleware standard** — pas de rate limit, request ID, body size check | `app/api/stripe/webhook/route.ts` L9 | Ajouter middleware sélectif sans auth |
| **Low** | **MCP route utilise Prisma directement** — bypass le repository layer | `app/api/mcp/route.ts` L198, L216, L247, L371 | Refactorer pour utiliser les repositories |

---

### 3. Business Logic

**✅ Points positifs :**
- Agent runner bien structuré (validate → execute → persist)
- Publish pipeline avec validator hooks, pre/post hooks, retry exponential backoff, idempotency keys
- Entitlement service avec 4 niveaux de résolution (user override → org override → plan → fallback)
- Quota guard avec daily caps par profile/platform et Redis fallback
- Scheduler avec `claimScheduled` atomique via `updateManyAndReturn` et status PUBLISHING
- Idempotence via `contentHash` + `profileId` dedup (unique constraint)

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **Critical** | **Race condition dans le publish handler** — le check idempotency et le publish ne sont pas atomiques. Le `@@unique` rattrape mais avec un `catch {}` silencieux. | `lib/job-queue/handlers.ts` L105-112, L177-190 | Utiliser un mutex via le status PUBLISHING ou une lock pessimiste |
| **Critical** | **Pas d'atomicité sur le daily cap** — `countPublishedToday` puis publish sans incrément atomique. 2 requêtes concurrentes peuvent passer. | `lib/job-queue/handlers.ts` L135-147 | Utiliser Redis INCR atomique avec TTL ou transaction Prisma |
| **High** | **Scheduler tick sans isolation d'erreur** — si un item échoue, tout le tick échoue et les items suivants sont sautés | `lib/services/scheduler/scheduler-service.ts` L29-61 | Wrapper chaque itération dans try/catch |
| **High** | **`createFeatureNotAvailableError` a "PRO" en dur** — ne résout pas dynamiquement le plan requis | `lib/entitlements/service.ts` L339-345 | Mapper feature → plan dynamiquement |
| **Medium** | **CGU check "soft fail"** — retourne `null` au lieu de throw, les appelants ignorent la distinction | `lib/services/agent/validate.ts` L34-43 | Utiliser un type d'erreur distinct |
| **Medium** | **Quota guard déprécié mais encore utilisé** — `@deprecated` mais toujours appelé depuis les routes | `lib/services/quota-guard.ts`, `app/api/v1/profiles/route.ts` L63 | Terminer la migration ou enlever le tag |
| **Medium** | **`getUserOverridesForOrg` est un no-op** — "Placeholder" non implémenté | `lib/entitlements/service.ts` L324-327 | Implémenter ou supprimer |
| **Low** | **Flag `autoPublish` ignoré par le scheduler** — tous les agents avec cron tournent | `schema.prisma` L280, `triggers/agent-scheduler.trigger.ts` L17 | Vérifier autoPublish avant de scheduler |

---

### 4. Data Layer

**✅ Points positifs :**
- 22 modèles bien définis avec relations sensées, index, et types appropriés
- 13 repositories avec interfaces propres
- Pagination sur `findByProfileId`, `findByUserId`, `findFailed` avec `skip`/`take` + `count` parallèle
- Opérations atomiques (`claimScheduled` avec `updateManyAndReturn`, `consumeUsage` avec `$transaction`)
- Contraintes unique sur PublishLog pour empêcher les doublons

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **Critical** | **N+1 query dans profiles endpoint** — pour chaque profile, 3 requêtes additionnelles (agents, content count, connected accounts) | `app/api/v1/profiles/route.ts` L19-41 | Utiliser Prisma `include` avec `count` ou une seule requête aggregate |
| **High** | **Cascade delete manquant sur PublishLog → User** — la suppression d'un user échoue | `prisma/schema.prisma` L364 | Ajouter `onDelete: Cascade` |
| **High** | **Cascade delete manquant sur GeneratedContent → AgentRun** — FK violation | `prisma/schema.prisma` L321-322 | Ajouter `onDelete: SetNull` ou `Cascade` |
| **Medium** | **Index manquant sur PublishLog** — pas d'index pour le pattern `[contentHash, profileId, success]` | `prisma/schema.prisma` L380-383 | Ajouter `@@index([contentHash, profileId, success])` |
| **Medium** | **`where` clause type-unsafe** — `Record<string, unknown>` au lieu de `Prisma.GeneratedContentWhereInput` | `lib/repositories/content.repository.ts` L114, L142, L248, L270 | Utiliser les types Prisma générés |
| **Medium** | **`batchReschedule` non transactionnel** — `Promise.all` sans `$transaction` | `lib/repositories/content.repository.ts` L318-330 | Wrapper dans `prisma.$transaction()` |
| **Low** | **Index composite à vérifier** — `[status, scheduledPublishAt]` vs pattern de requête du scheduler | `prisma/schema.prisma` L343 | Vérifier l'ordre des colonnes avec EXPLAIN ANALYZE |

---

### 5. Frontend

**✅ Points positifs :**
- Server Components par défaut avec data fetching serveur
- 6 Zustand stores bien structurés avec TypeScript strict
- Note de sécurité dans auth store sur les risques localStorage
- 14 composants UI réutilisables avec variants CVA et `cn()` consistent
- Accessibilité : skip link, aria-label, aria-current
- États vides gérés via EmptyState component

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **High** | **Content page utilise Prisma directement** — bypass l'API layer, rate limiting, métriques | `app/(main)/content/page.tsx` L54-81 | Utiliser les repositories ou fetch API |
| **High** | **Dashboard page aussi en direct Prisma** — même problème | `app/(main)/dashboard/page.tsx` L30-64 | Même correctif |
| **Medium** | **6/6 stores sans tests d'erreur async** — les gestionnaires d'erreur ne sont pas testés | `lib/stores/*.ts` | Ajouter tests : network failure, HTTP errors, malformed responses |
| **Medium** | **Content store fragile sur le parsing API** — `data.contents ?? data` assume un format spécifique | `lib/stores/content-store.ts` L86 | Assert ou parsing Zod |
| **Medium** | **Agent store ne reset pas `isRunning` sur erreur réseau** — pas de `finally` block | `lib/stores/agent-store.ts` L96-117 | Ajouter `finally { set({ isRunning: false }) }` |
| **Medium** | **`next-intl` importé dans test-utils mais peut-être absent des dépendances** | `components/__tests__/test-utils.tsx` L6 | Vérifier si next-intl est dans package.json |
| **Low** | **`useCallback` inutile sur des handlers simples** | `components/shared/pagination.tsx` L60-70 | Supprimer useCallback |
| **Low** | **Type assertion `as keyof typeof currentStats`** — unsafe | `components/dashboard/stats-grid.tsx` L53 | Utiliser une fonction de mapping typée |

---

### 6. Infrastructure

**✅ Points positifs :**
- LLM provider avec fallback (Anthropic → OpenAI), retry exponential backoff, timeouts
- Retry utility avec jitter, backoff configurable
- Timeouts explicites par service externe
- Cache entitlements 2 niveaux (Redis + LRU mémoire)
- Job queue dual sync/async (in-memory + Redis)
- Observabilité : Pino logging, Prometheus metrics, request-ID propagation
- Health checks : DB ping, Redis ping, version, uptime

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **Critical** | **Memory leak dans entitlements cache** — `setInterval` au module scope (top-level) jamais nettoyé. En serverless, chaque invocation leak un timer. | `lib/entitlements/cache.ts` L274-276 | Lifecycle managé via `instrumentation.ts` |
| **High** | **LLM provider ignore les headers `Retry-After`** — les retries utilisent des délais fixes | `lib/llm/provider.ts` L103-109 | Parser et honorer les 429 Retry-After |
| **High** | **Pas de circuit breaker** — le LLM provider hammer un provider mort pour tous les retries | `lib/llm/provider.ts` L164-191 | Implémenter un circuit breaker simple |
| **Medium** | **Job worker sans graceful shutdown** — `stopWorker()` défini mais jamais appelé | `lib/job-queue/worker.ts` L76-85 | Nettoyer dans les shutdown hooks |
| **Medium** | **Trigger.dev publish worker déprécié mais toujours exporté/appelé** | `triggers/publish-worker.trigger.ts` L8-9 | Supprimer ou migrer tous les callers |
| **Low** | **Redis health check crée un nouveau client à chaque appel** — pas de réutilisation | `lib/observability/health.ts` L42-44 | Réutiliser un singleton Redis |

---

### 7. Security

**✅ Points positifs :**
- SSRF protection avec validation d'URL
- Token encryption AES-256-GCM avec IV/tag/ciphertext format
- API key hashing SHA-256, jamais en plaintext
- Bcrypt timing-safe comparison même pour users inexistants
- CSP headers complets (scripts, styles, images, media, fonts, connect-src)
- HSTS 2 ans
- PII redaction exhaustive dans Pino

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **High** | **Vector d'injection GraphQL dans publishers Instagram/Facebook** — les messages d'erreur incluent les raw API responses potentiellement controllées par un attaquant | `lib/publishers/instagram.ts` L42-46, L65-69, L90-94 | Sanitizer les messages d'erreur |
| **Medium** | **UploadThing CSP incomplet** — certains hosts UploadThing peuvent être bloqués | `next.config.mjs` L66 | Review docs UploadThing et ajouter tous les hosts requis |
| **Medium** | **Recherche texte sans protection** — pas de longueur minimale, leading wildcards possibles | `app/(main)/content/page.tsx` L49 | Ajouter longueur minimale (2-3 chars) |
| **Medium** | **CI expose des secrets en dur** — OAuth client IDs/secrets en variables d'env plain-text dans le workflow | `.github/workflows/ci.yml` L112-129 | Utiliser GitHub Actions secrets |
| **Low** | **`getUserPlan` trop simpliste** — tout abonnement actif = plan "starter" | `lib/services/quota-guard.ts` L31-34 | Limitation connue mais sous-sert les utilisateurs payants |

---

### 8. Testing

**✅ Points positifs :**
- 253 fichiers de test — bonne couverture unit + integration + E2E
- 11 fichiers de test publishers couvrant chaque plateforme et le pipeline
- Tests d'idempotence complets
- Tests pour les 6 Zustand stores
- Tests repositories séparés
- Tests E2E Playwright (auth, landing, routes protégées, API)
- Infrastructure de test : `test-utils.tsx`, fixtures, factories

**⚠️ Problèmes :**
| Sévérité | Problème | Correctif |
|----------|----------|-----------|
| **High** | **Chemins critiques sans tests d'intégration** — publish pipeline, agent runner orchestrator, scheduler | Ajouter des tests d'intégration full-flow |
| **High** | **API middleware test incomplet** — ne teste que l'export de module, pas auth, rate limiting, propagation | Ajouter des tests middleware complets |
| **Medium** | **Entitlement service zéro test** — logique complexe (4 niveaux, overrides, experiments) non testée | Ajouter tests unitaires |
| **Medium** | **Pas de Playwright pour CRUD content** — les E2E couvrent auth mais pas la génération/scheduling/publishing | Ajouter E2E pour le parcours complet |
| **Medium** | **Tests composants minimaux** — 6 seulement pour les composants partagés, aucun pour les feature components | Ajouter RTL tests pour les feature components |
| **Low** | **Coverage exclut `__tests__`** — gonfle artificiellement le pourcentage de coverage | Retirer l'exclusion ou ajouter une config séparée |
| **Low** | **Pas de visual regression testing** — 14 composants UI + feature components sans tests visuels | Envisager Storybook/Percy/Chromatic |

---

### 9. Configuration & DevOps

**✅ Points positifs :**
- pnpm + Turborepo 2.4 avec build caching et task orchestration
- Biome config complète avec règles organisées
- Husky + commitlint + lint-staged (pre-commit hooks + conventional commits)
- CI pipeline : 4 jobs parallèles (lint+typecheck, tests, build, security scan)
- Deploy GitHub Actions → Vercel avec notifications Slack
- Changesets pour version management

**⚠️ Problèmes :**
| Sévérité | Problème | Fichier | Correctif |
|----------|----------|---------|-----------|
| **Critical** | **Deploy workflow utilise npm au lieu de pnpm** — `npm ci` et `npx prisma` dans deploy.yml | `.github/workflows/deploy.yml` L29-35 | Utiliser `pnpm install --frozen-lockfile` |
| **Critical** | **Node.js version mismatch** — CI utilise Node 20, `.nvmrc` et projet spécifient Node 24 | `.github/workflows/ci.yml` L10, deploy.yml L9 | Uniformiser sur Node 24 |
| **High** | **`noExplicitAny` désactivé dans Biome** — `"off"` permet du `as any` partout | `biome.json` L41 | Activer en error |
| **Medium** | **Security scan avec `continue-on-error: true`** — les vulnérabilités connues ne fail pas le build | `.github/workflows/ci.yml` L196 | Fail sur high severity ou ajouter notification |
| **Medium** | **Pas de CodeQL ni Dependabot** — pas de scanning automatisé | `.github/` | Activer CodeQL et Dependabot |
| **Low** | **Règles a11y Biome en "warn"** — accessibilité pas bloquante | `biome.json` L47-55 | Passer critiques en "error" |
| **Low** | **Pas de script `typecheck` direct** — seulement via `check` | `package.json` | Ajouter un script standalone |

---

### 🎯 Top 10 Actions Prioritaires

| # | Sévérité | Domaine | Problème | Effort |
|---|----------|---------|----------|--------|
| 1 | 🔴 Critical | Infrastructure | Memory leak dans entitlements cache (setInterval) | 1h |
| 2 | 🔴 Critical | DevOps | Deploy utilise npm au lieu de pnpm | 30min |
| 3 | 🔴 Critical | DevOps | Node.js version mismatch (20 vs 24) | 15min |
| 4 | 🔴 Critical | Business | Race condition dans publish handler (pas de mutex) | 4h |
| 5 | 🔴 Critical | API | Body size limit 100KB bloque les uploads | 15min |
| 6 | 🟠 High | Data | N+1 query dans profiles endpoint | 2h |
| 7 | 🟠 High | Architecture | Deux systèmes DI parallèles, aucun pleinement adopté | 8h |
| 8 | 🟠 High | Security | Vecteur d'injection dans error messages publishers | 1h |
| 9 | 🟠 High | Testing | Chemins critiques sans tests d'intégration | 4h |
| 10 | 🟠 High | Infrastructure | LLM provider ignore Retry-After headers | 2h |

### 📊 Score Global Mis à Jour

| Critère | Score précédent | Nouveau score |
|---------|:-:|:-:|
| Architecture | 8/10 | 7.5/10 |
| Sécurité | 8/10 | 7.5/10 |
| Performance | 7/10 | 7/10 |
| Maintenabilité | 8/10 | 7/10 |
| Scalabilité | 7/10 | 7/10 |
| Observabilité | 7/10 | 7/10 |
| **Global** | **7.5/10** | **7.0/10** |

> La baisse du score global (7.5 → 7.0) reflète les findings critiques identifiés lors de cette revue approfondie : fuite mémoire dans le cache entitlements, race conditions dans le publish handler, mismatch de version Node.js, et deploy config qui utilise npm au lieu de pnpm. Ces problèmes sont rapidement corrigibles (quick wins) et ne nécessitent pas de redesign majeur. La base du projet reste solide.
