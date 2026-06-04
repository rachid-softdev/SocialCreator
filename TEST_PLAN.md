# TEST_PLAN — SocialCreator

> **Objectif :** Atteindre ≥90% de couverture de code (statements, branches, functions, lines) sur l'ensemble du monorepo.
> **Date :** 2026-06-04
> **Portée :** `socialcreator-web` + packages partagés (`@socialcreator/ui`, `@socialcreator/utils`, `@socialcreator/types`)

---

## Table des matières

1. [État des lieux](#1-état-des-lieux)
2. [Stratégie générale](#2-stratégie-générale)
3. [Types de tests et frameworks](#3-types-de-tests-et-frameworks)
4. [Périmètre détaillé par module](#4-périmètre-détaillé-par-module)
5. [Arborescence cible des tests](#5-arborescence-cible-des-tests)
6. [Conventions d'écriture](#6-conventions-décriture)
7. [Priorisation](#7-priorisation)
8. [Métriques cibles](#8-métriques-cibles)
9. [Environnements de test](#9-environnements-de-test)
10. [Risques et dépendances](#10-risques-et-dépendances)

---

## 1. État des lieux

### 1.1 Couverture actuelle (dernier rapport)

| Métrique | Actuel | Cible |
|----------|--------|-------|
| **Statements** | **18.27%** (6 785/37 135) | ≥90% |
| **Branches** | **61.54%** (749/1 217) | ≥90% |
| **Functions** | **30.86%** (171/554) | ≥90% |
| **Lines** | **18.27%** (6 785/37 135) | ≥90% |

### 1.2 Types de tests existants

| Type | Framework | Nb fichiers | Statut |
|------|-----------|-------------|--------|
| Unitaires | Vitest | ~100 test files | ✅ Partiel (lib, stores, publishers) |
| Intégration | Vitest | 4 fichiers | ⚠️ Très insuffisant |
| Composants React | — | 4 fichiers (tests fonctionnels sans DOM) | ❌ Aucun rendu réel |
| E2E | Playwright | 4 spec files | ⚠️ Minimal |
| API Routes | Vitest | ~25 fichiers | ⚠️ Partiel (~50% des routes) |
| Packages partagés | — | 0 | ❌ Aucun test |

### 1.3 Lacunes identifiées

- **Pas de jsdom** → impossible de tester le rendu des composants React
- **Pas de `@testing-library/react`** → pas de sélection par rôle/texte/utilisateur
- **Pas de tests de hooks** (2 hooks, 0 test)
- **Pas de tests de pages** (30+ pages, 0 test sauf via E2E)
- **Pas de `.env.test`** → variables d'environnement codées en dur
- **Pas de base de test dédiée** → tout est mocké manuellement
- **Pas de tests pour les packages partagés** (ui, utils, types)
- **E2E sur un seul navigateur** (Chromium), pas de mobile/tablette

---

## 2. Stratégie générale

### 2.1 Pyramid of testing

```
         ╱╲
        ╱  ╲
       ╱ E2E╲            ← Playwright : 15-20 specs critiques
      ╱──────╲
     ╱ Intégra╲          ← Vitest : flux interservices, API, base de données
    ╱──────────╲
   ╱ Composants ╲        ← Vitest + @testing-library/react : 100% des composants
  ╱──────────────╲
 ╱   Unitaires     ╲     ← Vitest : 100% des fonctions utilitaires, stores, publishers
╱──────────────────╲
```

### 2.2 Approche par couche

| Couche | Approche | Cible couverture |
|--------|----------|-----------------|
| **Utils / Lib pure** | Tests unitaires (100% des cas, edge cases, erreurs) | 100% |
| **Stores Zustand** | Tests unitaires avec état initial mocké | 100% |
| **Publishers** | Tests unitaires avec mocks réseau | 100% |
| **Composants React** | Rendu via `@testing-library/react`, interactions utilisateur | 95% |
| **Hooks personnalisés** | Tests via `renderHook` | 100% |
| **API Routes** | Tests unitaires avec `NextRequest` mocké | 100% |
| **Pages** | Tests de rendu (smoke) + tests d'intégration | 80% |
| **Triggers** | Tests unitaires avec mocks Trigger.dev | 100% |
| **Intégration** | Tests de flux complets (API → lib → base mockée) | 90% des flux critiques |
| **E2E** | Parcours utilisateur réels (auth, content, publish) | 15-20 scénarios |

### 2.3 Règle des 3 niveaux pour chaque module

1. **Smoke test** — Le module s'importe et s'exécute sans erreur
2. **Cas nominal** — Le module fonctionne avec des entrées valides
3. **Cas aux limites** — Erreurs, valeurs nulles, timeout, permissions, etc.

---

## 3. Types de tests et frameworks

### 3.1 Stack technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| **Vitest** | ^1.0.0 | Tests unitaires, intégration, composants |
| **@vitest/coverage-v8** | ^1.0.0 | Rapport de couverture V8 |
| **Playwright** | ^1.60.0 | Tests E2E |
| **jsdom** | À ajouter | Environnement DOM pour composants |
| **@testing-library/react** | À ajouter | Rendu et sélection de composants |
| **@testing-library/jest-dom** | À ajouter | Matchers DOM (toBeInTheDocument, etc.) |
| **@testing-library/user-event** | À ajouter | Simulations d'interactions utilisateur |
| **@testing-library/react-hooks** *(ou renderHook natif)* | À ajouter | Tests de hooks |
| **msw** *(MSW - Mock Service Worker)* | Optionnel | Mock réseau réaliste pour API |
| **testcontainers** *(ou mieux : une base dédiée)* | Optionnel | Tests d'intégration avec vraie base |

### 3.2 Répartition des types de tests

#### Tests Unitaires (Vitest, env: node)
- Fonctions utilitaires (`src/lib/utils/*`)
- Services sans état (`src/lib/services/*`, `src/lib/oauth/*`)
- Publishers individuels (`src/lib/publishers/*`)
- Stores Zustand (`src/lib/stores/*`)
- Entitlements, LLM, middleware, observabilité
- Repositories (logique métier uniquement)
- Triggers
- API Routes (logique de validation, réponses)

#### Tests de Composants (Vitest, env: jsdom)
- Chaque composant dans `src/components/**/*.tsx`
- Tests de rendu basique (smoke)
- Tests d'état (loading, empty, error, success)
- Tests d'interaction (click, submit, hover)
- Tests d'accessibilité (rôles, aria)

#### Tests d'Intégration (Vitest, env: node)
- Flux API → Service → Repository (avec Prisma mocké)
- Flux OAuth complet
- Flux Stripe webhook
- Flux de publication
- Flux de génération de contenu
- Flux agent runner

#### Tests E2E (Playwright, Chromium + Firefox)
- Parcours d'authentification (inscription, connexion, déconnexion, MFA)
- Parcours de gestion de contenu (création, modification, suppression, publication)
- Parcours de gestion de profils et comptes connectés
- Parcours de gestion d'agents
- Parcours de paiement (Stripe)
- Parcours de gestion d'équipe
- Navigation, protection des routes, erreurs 404/500

---

## 4. Périmètre détaillé par module

### 4.1 Modules et fichiers source

Légende : ✅ existant | ⬜ à créer | 📝 à améliorer

#### A. `src/lib/` — Fondations & Logique métier

| Sous-module | Fichiers source | Nb | Tests existants | Tests à créer |
|-------------|-----------------|----|-----------------|---------------|
| **`utils/`** | `crypto.ts`, `fetch-timeout.ts`, `logger.ts`, `metrics.ts`, `retry.ts`, `sanitize.ts`, `utils.ts`, `validate-url.ts`, `validations.ts` | 9 | ⬜ 0 | ✅ 9 fichiers |
| **`auth/`** | `auth.ts`, `require-admin.ts` | 2 | ✅ 1 | 📝 1 (auth.ts) |
| **`oauth/`** | `auth-url.ts`, `encryption.ts`, `index.ts`, `providers.ts`, `revoke.ts`, `token-exchange.ts`, `user-info.ts` | 7 | ✅ 4 | 📝 3 (index, revoke, user-info) |
| **`publishers/`** | `facebook.ts`, `instagram.ts`, `linkedin.ts`, `pinterest.ts`, `pipeline.ts`, `registry.ts`, `threads.ts`, `tiktok.ts`, `types.ts`, `validators.ts`, `x.ts`, `youtube.ts`, `index.ts` | 13 | ✅ 12 | 📝 1 (index.ts barrel) |
| **`content/`** | `generator.ts`, `batch-generator.ts`, `prompts/*` | ~12 | ✅ 3 | 📝 9 fichiers prompts |
| **`entitlements/`** | `cache.ts`, `downgrade.ts`, `index.ts`, `middleware.ts`, `repository.ts`, `service.ts`, `stripe-webhook.ts`, `types.ts` | 8 | ✅ 3 | 📝 5 (cache, downgrade, index, repository, types) |
| **`stores/`** | `agent-store.ts`, `auth-store.ts`, `content-store.ts`, `index.ts`, `profile-store.ts`, `queue-store.ts`, `ui-store.ts` | 7 | ✅ 6 | 📝 1 (index.ts barrel) |
| **`services/`** | `agent/*` (3), `notification-service.ts`, `scheduler/*` (2), `oauth.ts`, `blog.ts`, `cgu-guard.ts`, `prompts.ts`, `publish-guard.ts`, `quota-guard.ts`, `team-permissions.ts`, `tokens.ts`, `video-pipeline.ts`, `agent-runner.ts` | ~15 | ✅ 1 | 📝 14 fichiers |
| **`infrastructure/`** | `cron.ts`, `deepgram.ts`, `llm.ts`, `mux.ts`, `prisma.ts`, `rate-limit-fallback.ts`, `rate-limit-redis.ts`, `stripe.ts`, `trigger.ts`, `trigger-client.ts` | 10 | ⬜ 0 | ✅ 10 fichiers |
| **`job-queue/`** | `handlers.ts`, `index.ts`, `queue.ts`, `types.ts`, `worker.ts`, `backend/*` | ~8 | ✅ 4 | 📝 4 fichiers |
| **`repositories/`** | `agent.repository.ts`, `api-key.repository.ts`, `connected-account.repository.ts`, `content.repository.ts`, `index.ts`, `invitation.repository.ts`, `media-asset.repository.ts`, `notification.repository.ts`, `profile.repository.ts`, `publish-log.repository.ts`, `registry.ts`, `team.repository.ts`, `team-member.repository.ts`, `user.repository.ts` | 14 | ✅ 2 | 📝 12 fichiers |
| **`middleware/`** | `api-errors.ts`, `api-middleware.ts`, `ownership.ts`, `request-id.ts`, `ssrf-middleware.ts`, `team-access.ts` | 6 | ✅ 3 | 📝 3 fichiers |
| **`observability/`** | `health.ts`, `index.ts`, `logger.ts`, `request-context.ts`, `request-id.ts` | 5 | ✅ 3 | 📝 2 fichiers |
| **`scheduling/`** | `conflict-detector.ts`, `optimizer.ts` | 2 | ✅ 1 | 📝 1 (optimizer) |
| **`di/`** | `adapters.ts`, `container.ts`, `index.ts`, `token.ts` | 4 | ✅ 1 | 📝 3 fichiers |
| **`llm/`** | `index.ts`, `provider.ts`, `rate-limiter.ts`, `types.ts` | 4 | ✅ 2 | 📝 2 fichiers |
| **Barrels racine** | `*.ts` (auth.ts, crypto.ts, logger.ts, prompts.ts, etc. ~25 fichiers) | ~25 | ⬜ 0 | 📝 tests indirects via leurs cibles |

#### B. `src/components/` — Composants React (96 fichiers, 4 testés)

| Sous-module | Fichiers source | Nb | Tests à créer |
|-------------|-----------------|----|---------------|
| `admin/` | `admin-guard.tsx`, `confirm-dialog.tsx` | 2 | ✅ 1 / 📝 1 |
| `agent/` | 10 fichiers | 10 | ✅ 0 / 📝 10 |
| `analytics/` | 4 fichiers | 4 | 📝 4 |
| `auth/` | 4 fichiers | 4 | 📝 4 |
| `billing/` | 4 fichiers | 4 | 📝 4 |
| `blog/` | 6 fichiers | 6 | 📝 6 |
| `calendar/` | 3 fichiers | 3 | 📝 3 |
| `connected-accounts/` | 7 fichiers | 7 | ✅ 1 / 📝 6 |
| `content/` | 18 fichiers | 18 | ✅ 2 / 📝 16 |
| `dashboard/` | 8 fichiers | 8 | 📝 8 |
| `entitlements/` | 1 fichier | 1 | 📝 1 |
| `job-queue/` | 1 fichier | 1 | 📝 1 |
| `layout/` | 4 fichiers | 4 | 📝 4 |
| `mcp/` | 2 fichiers | 2 | 📝 2 |
| `notifications/` | 1 fichier | 1 | 📝 1 |
| `profile/` | 4 fichiers | 4 | 📝 4 |
| `queue-monitor/` | 1 fichier | 1 | 📝 1 |
| `settings/` | 1 fichier | 1 | 📝 1 |
| `shared/` | 2 fichiers | 2 | 📝 2 |
| `video/` | 8 fichiers | 8 | ✅ 0 / 📝 8 |
| Racine | `error-boundary.tsx`, `toast-layout-wrapper.tsx`, `toast-provider.tsx` | 3 | 📝 3 |

#### C. `src/hooks/` — Hooks personnalisés
- `use-notifications.ts`, `use-toast.ts` → **2 tests à créer**

#### D. `src/app/api/` — Routes API (~60 route handlers)
- **~25 testés**, **~35 à créer**

#### E. `src/app/` — Pages Next.js (~30 pages)
- **0 testé**, **~30 à créer** (au moins des smoke tests)

#### F. `src/triggers/` — Triggers Trigger.dev
- 6 fichiers de trigger, **1 testé**, **5 à créer**

#### G. Packages partagés (monorepo)
| Package | Fichiers | Tests |
|---------|----------|-------|
| `@socialcreator/ui` | Composants partagés | 📝 tests unitaires + rendu |
| `@socialcreator/utils` | Utilitaires partagés | 📝 tests unitaires |
| `@socialcreator/types` | Types TypeScript | 📝 tests de type (compile-time) |

---

## 5. Arborescence cible des tests

```
socialcreator-web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __tests__/helpers.ts
│   │   │   ├── admin/
│   │   │   │   ├── orgs/__tests__/route.test.ts          ⬅
│   │   │   │   ├── stats/__tests__/route.test.ts          ⬅
│   │   │   │   ├── users/__tests__/route.test.ts          ⬅ (compléter)
│   │   │   │   └── entitlements/__tests__/                ⬅ (existant)
│   │   │   ├── analytics/__tests__/route.test.ts          ⬅ NOUVEAU
│   │   │   ├── agents/__tests__/route.test.ts             ⬅ (existant)
│   │   │   ├── content/__tests__/                         ⬅ (existant + nouveaux)
│   │   │   ├── profiles/__tests__/                        ⬅ (existant + nouveaux)
│   │   │   ├── stripe/__tests__/                          ⬅ NOUVEAU
│   │   │   ├── teams/__tests__/                           ⬅ NOUVEAU
│   │   │   ├── media/__tests__/                           ⬅ (existant)
│   │   │   ├── video/__tests__/                           ⬅ (existant)
│   │   │   └── v1/__tests__/                              ⬅ (existant + nouveaux)
│   │   └── (auth)/__tests__/login.test.ts                 ⬅ NOUVEAU (smoke)
│   │   └── (main)/__tests__/dashboard.test.ts             ⬅ NOUVEAU (smoke)
│   ├── components/
│   │   ├── admin/__tests__/admin-guard.test.ts            ⬅ (existant)
│   │   ├── admin/__tests__/confirm-dialog.test.ts         ⬅ NOUVEAU
│   │   ├── agent/__tests__/                               ⬅ 10 tests NOUVEAU
│   │   ├── analytics/__tests__/                           ⬅ 4 tests NOUVEAU
│   │   ├── auth/__tests__/                                ⬅ 4 tests NOUVEAU
│   │   ├── billing/__tests__/                             ⬅ 4 tests NOUVEAU
│   │   ├── blog/__tests__/                                ⬅ 6 tests NOUVEAU
│   │   ├── calendar/__tests__/                            ⬅ 3 tests NOUVEAU
│   │   ├── connected-accounts/__tests__/                  ⬅ 6 tests NOUVEAU
│   │   ├── content/__tests__/                             ⬅ 16 tests NOUVEAU
│   │   ├── dashboard/__tests__/                           ⬅ 8 tests NOUVEAU
│   │   ├── entitlements/__tests__/FeatureGuard.test.tsx   ⬅ NOUVEAU
│   │   ├── job-queue/__tests__/                           ⬅ 1 test NOUVEAU
│   │   ├── layout/__tests__/                              ⬅ 4 tests NOUVEAU
│   │   ├── profile/__tests__/                             ⬅ 4 tests NOUVEAU
│   │   ├── video/__tests__/                               ⬅ 8 tests NOUVEAU
│   │   └── shared/__tests__/                              ⬅ 2 tests NOUVEAU
│   ├── hooks/__tests__/
│   │   ├── use-notifications.test.ts                      ⬅ NOUVEAU
│   │   └── use-toast.test.ts                              ⬅ NOUVEAU
│   ├── lib/__tests__/
│   │   ├── auth.test.ts                                   ⬅ (existant)
│   │   ├── api-errors.test.ts / api-middleware.test.ts    ⬅ (existants)
│   │   ├── crypto.test.ts                                 ⬅ (existant)
│   │   ├── logger.test.ts / prompts.test.ts               ⬅ (existants)
│   │   ├── utils/
│   │   │   ├── crypto.test.ts                             ⬅ NOUVEAU
│   │   │   ├── fetch-timeout.test.ts                      ⬅ NOUVEAU
│   │   │   ├── logger.test.ts / metrics.test.ts           ⬅ NOUVEAU
│   │   │   ├── retry.test.ts / sanitize.test.ts           ⬅ NOUVEAU
│   │   │   ├── utils.test.ts / validate-url.test.ts       ⬅ (existants)
│   │   │   └── validations.test.ts                        ⬅ (existant)
│   │   ├── services/
│   │   │   ├── agent/*.test.ts                            ⬅ NOUVEAU
│   │   │   ├── scheduler-service.test.ts                  ⬅ (existant)
│   │   │   ├── oauth.test.ts                              ⬅ NOUVEAU
│   │   │   ├── tokens.test.ts                             ⬅ (existant)
│   │   │   ├── team-permissions.test.ts                   ⬅ NOUVEAU
│   │   │   ├── publish-guard.test.ts                      ⬅ (existant)
│   │   │   ├── quota-guard.test.ts                        ⬅ NOUVEAU
│   │   │   ├── video-pipeline.test.ts                     ⬅ (existant)
│   │   │   ├── blog.test.ts / cgu-guard.test.ts           ⬅ NOUVEAU
│   │   │   └── prompts.test.ts                            ⬅ NOUVEAU
│   │   ├── infrastructure/
│   │   │   ├── prisma.test.ts                             ⬅ NOUVEAU
│   │   │   ├── stripe.test.ts                             ⬅ (existant partiellement)
│   │   │   ├── trigger.test.ts / trigger-client.test.ts   ⬅ NOUVEAU
│   │   │   ├── cron.test.ts / deepgram.test.ts            ⬅ NOUVEAU
│   │   │   ├── llm.test.ts / mux.test.ts                  ⬅ NOUVEAU
│   │   │   └── rate-limit.test.ts                         ⬅ (existant)
│   │   └── repositories/
│   │       └── ... (tous les repositories non testés)     ⬅ NOUVEAU
│   └── triggers/__tests__/
│       ├── agent-scheduler.trigger.test.ts                ⬅ NOUVEAU
│       ├── publish-worker.trigger.test.ts                 ⬅ NOUVEAU
│       ├── scheduled-content.trigger.test.ts              ⬅ NOUVEAU
│       └── video-pipeline.trigger.test.ts                 ⬅ NOUVEAU
├── e2e/
│   ├── auth.spec.ts                                       ⬅ à enrichir
│   ├── landing.spec.ts                                    ⬅ à enrichir
│   ├── content-creation.spec.ts                           ⬅ NOUVEAU
│   ├── content-publish.spec.ts                            ⬅ NOUVEAU
│   ├── profiles.spec.ts                                   ⬅ NOUVEAU
│   ├── agents.spec.ts                                     ⬅ NOUVEAU
│   ├── billing.spec.ts                                    ⬅ NOUVEAU
│   ├── teams.spec.ts                                      ⬅ NOUVEAU
│   └── navigation.spec.ts                                 ⬅ NOUVEAU

packages/
├── socialcreator-ui/src/**/__tests__/                      ⬅ NOUVEAU
├── socialcreator-utils/src/**/__tests__/                   ⬅ NOUVEAU
└── socialcreator-types/src/**/__tests__/                   ⬅ NOUVEAU (tests de type)
```

---

## 6. Conventions d'écriture

### 6.1 Structure d'un fichier de test

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
// Imports du module testé
// Imports des mocks

// Mocks
vi.mock("@/lib/prisma", () => ({ ... }));

describe("ModuleName", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("nominal cases", () => { ... });
  describe("error handling", () => { ... });
  describe("edge cases", () => { ... });
});
```

### 6.2 Conventions de nommage

- **Test files :** `nom-du-module.test.ts` ou `nom-du-module.test.tsx`
- **Test helpers :** stockés dans `__tests__/helpers.ts` du dossier courant
- **Mocks partagés :** fichiers `__mocks__/` à la racine des modules concernés (ex: `src/lib/__mocks__/prisma.ts`)
- **Descriptions :** en anglais, pattern `describe("method / component name")` → `it("should ...")`

### 6.3 Règles par type de test

| Type | Règles |
|------|--------|
| **Unitaire pur** | Pas de side-effects, tout mocké, 100% des cas |
| **Composant** | Rendu via `render()`, sélection via `screen.getByRole/ByText/ByTestId`, user-event pour interactions |
| **API Route** | Mock sessions NextAuth, mock Prisma, mock rate-limit, `NextRequest` avec `new Request()` |
| **Intégration** | Flux complet d'une fonctionnalité, Prisma mocké avec données réalistes en mémoire |
| **E2E** | Page Object Model, données via API plutôt que UI, assertions visuelles clés |

### 6.4 Anti-patterns à éviter

- ❌ Tester des détails d'implémentation (composants internes, noms de classe CSS)
- ❌ Tester des bibliothèques tierces (Prisma, Stripe, Trigger.dev)
- ❌ `data-testid` abusif (préférer `getByRole` ou `getByText`)
- ❌ Tests dépendants de l'ordre d'exécution
- ❌ Snapshots géants (préférer des assertions ciblées)
- ❌ Mocks globaux dans `setupFiles` (préférer mocks locaux par fichier)

---

## 7. Priorisation

### Phase 1 — Fondations (P0)
| Priorité | Module | Justification |
|----------|--------|---------------|
| 🔴 P0 | Infrastructure technique | jsdom, testing-library, configuration Vitest |
| 🔴 P0 | `src/lib/utils/*` | Utilitaires purs, sans dépendances, coverage rapide |
| 🔴 P0 | `src/lib/validations/*` | Logique critique de validation |
| 🔴 P0 | `src/lib/entitlements/*` | Logique métier critique (paiement, accès) |

### Phase 2 — Coeur métier (P1)
| Priorité | Module | Justification |
|----------|--------|---------------|
| 🟠 P1 | `src/lib/stores/*` | État global de l'application |
| 🟠 P1 | `src/lib/publishers/*` | Logique de publication (compléter coverage existant) |
| 🟠 P1 | `src/lib/oauth/*` | Authentification plateformes sociales |
| 🟠 P1 | `src/lib/content/*` | Génération de contenu |
| 🟠 P1 | `src/lib/services/*` | Services métier |
| 🟠 P1 | `src/lib/repositories/*` | Accès aux données |
| 🟠 P1 | `src/lib/infrastructure/*` | Intégrations externes |

### Phase 3 — Composants React (P1)
| Priorité | Module | Justification |
|----------|--------|---------------|
| 🟠 P1 | `src/components/auth/*` | Authentification |
| 🟠 P1 | `src/components/content/*` | CRUD contenu (le plus utilisé) |
| 🟠 P1 | `src/components/connected-accounts/*` | Connexion plateformes |
| 🟠 P1 | `src/components/profile/*` | Gestion des profiles |
| 🟡 P2 | `src/components/agent/*` | Gestion des agents IA |
| 🟡 P2 | `src/components/dashboard/*` | Tableau de bord |
| 🟡 P2 | `src/components/billing/*` | Paiement |
| 🟢 P3 | `src/components/blog/*` | Blog (moins critique) |
| 🟢 P3 | `src/components/analytics/*` | Analytics |
| 🟢 P3 | `src/components/video/*` | Vidéo |
| 🟢 P3 | `src/components/calendar/*` | Calendrier |
| 🟢 P3 | `src/components/layout/*` | Layout |

### Phase 4 — API Routes (P1-P2)
| Priorité | Module |
|----------|--------|
| 🟠 P1 | Routes API non testées dans `src/app/api/*` |
| 🟡 P2 | Routes API v1 non testées |
| 🟡 P2 | Routes Stripe, Teams, Media, Video |

### Phase 5 — Pages & Hooks (P2)
| Priorité | Module |
|----------|--------|
| 🟡 P2 | Smoke tests pour toutes les pages |
| 🟡 P2 | Tests des hooks `use-notifications`, `use-toast` |

### Phase 6 — Triggers (P2)
| Priorité | Module |
|----------|--------|
| 🟡 P2 | Tests des triggers Trigger.dev |

### Phase 7 — E2E (P2)
| Priorité | Module |
|----------|--------|
| 🟡 P2 | Enrichir auth, landing |
| 🟡 P2 | Nouveaux specs : content, profiles, agents, billing, teams |

### Phase 8 — Packages partagés (P3)
| Priorité | Module |
|----------|--------|
| 🟢 P3 | `@socialcreator/utils` |
| 🟢 P3 | `@socialcreator/ui` |
| 🟢 P3 | `@socialcreator/types` |

---

## 8. Métriques cibles

| Couche | Statements | Branches | Functions |
|--------|-----------|----------|-----------|
| **`src/lib/utils/`** | 100% | 100% | 100% |
| **`src/lib/publishers/`** | 95% | 90% | 95% |
| **`src/lib/stores/`** | 95% | 90% | 95% |
| **`src/lib/oauth/`** | 95% | 90% | 95% |
| **`src/lib/services/`** | 95% | 90% | 95% |
| **`src/lib/entitlements/`** | 95% | 90% | 95% |
| **`src/lib/repositories/`** | 90% | 85% | 90% |
| **`src/lib/infrastructure/`** | 85% | 80% | 85% |
| **`src/lib/middleware/`** | 95% | 95% | 100% |
| **`src/lib/observability/`** | 90% | 85% | 90% |
| **`src/lib/di/`** | 90% | 80% | 90% |
| **`src/lib/llm/`** | 95% | 90% | 95% |
| **`src/lib/scheduling/`** | 95% | 90% | 100% |
| **`src/lib/job-queue/`** | 90% | 85% | 90% |
| **`src/lib/auth/`** | 95% | 90% | 100% |
| **`src/lib/content/`** | 95% | 90% | 95% |
| **`src/components/**/*`** | 95% | 90% | 95% |
| **`src/hooks/`** | 100% | 100% | 100% |
| **`src/app/api/**/route.ts`** | 95% | 90% | 100% |
| **`src/app/**/page.tsx`** | 80% | 75% | 80% |
| **`src/triggers/`** | 90% | 85% | 90% |
| **Packages partagés** | 90% | 85% | 90% |
| **📊 GLOBAL** | **≥90%** | **≥90%** | **≥90%** |

---

## 9. Environnements de test

### 9.1 Configuration Vitest

```typescript
// vitest.config.ts — modifications nécessaires
export default defineConfig({
  test: {
    // Projets séparés pour node et jsdom
    projects: [
      {
        name: "unit",
        environment: "node",
        include: ["src/**/*.test.ts", "!src/**/*.test.tsx"],
      },
      {
        name: "components",
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts", "./vitest.dom-setup.ts"],
        include: ["src/**/*.test.tsx"],
      },
    ],
    coverage: {
      // Ne plus exclure __tests__ (sinon les helpers ne sont pas comptés)
      // Garder l'exclusion des d.ts, config.ts
      exclude: ["node_modules", "dist", ".next", "**/*.d.ts", "**/*.config.ts"],
    },
  },
});
```

### 9.2 Fichiers de setup

- **`vitest.setup.ts`** (existant) — variables d'environnement
- **`vitest.dom-setup.ts`** (NOUVEAU) — `@testing-library/jest-dom` auto-cleanup

### 9.3 Variables d'environnement de test

Créer un fichier **`.env.test`** pour centraliser les variables de test (optionnel, les valeurs par défaut dans setup suffisent).

### 9.4 CI Pipeline

- Les tests unitaires + composants tournent ensemble (`vitest run`)
- Les tests d'intégration peuvent être séparés si lents
- Coverage uploadée vers Codecov après chaque push sur main
- E2E avec Playwright en CI (Chromium)

---

## 10. Risques et dépendances

### 10.1 Dépendances techniques à ajouter

```json
{
  "devDependencies": {
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "whatwg-fetch": "^3.6.0",
    "msw": "^2.0.0"
  }
}
```

### 10.2 Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Composants avec dépendances Next.js (router, searchParams, etc.) | Tests complexes | Mocker `next/navigation` via `vi.mock` |
| Composants avec `next-intl` (i18n) | Tests complexes | Créer un wrapper de traduction pour les tests |
| OAuth flows avec redirect | Tests E2E complexes | Utiliser des tokens de test/mock OAuth |
| Stripe webhooks | Tests complexes | Utiliser les clés de test Stripe + événements mockés |
| Trigger.dev | Tests complexes | Mocker le client Trigger.dev |
| Uploadthing | Tests complexes | Mocker le client uploadthing |
| Mux video | Tests complexes | Mocker les appels Mux |
| Audio/video (Deepgram, HLS) | Tests complexes | Mocker les APIs |
| Temps d'exécution des tests | Dégradation DX | Projets Vitest parallèles, `--pool=threads` |
| Flaky E2E | Fausses alertes | Retry config (2 en CI), trace on first retry |

### 10.3 Stratégies de mock pour les dépendances complexes

| Dépendance | Stratégie |
|------------|-----------|
| **`next/navigation`** | `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }))` |
| **`next-auth`** | Mocker `auth()` et `getServerSession()` pour retourner une session factice |
| **`@prisma/client`** | Mocker chaque méthode (`findUnique`, `create`, `update`, etc.) avec `vi.fn()` |
| **`stripe`** | Mocker le client Stripe (constructeur et méthodes) |
| **`@trigger.dev/sdk`** | Mocker `trigger` et `event` |
| **`uploadthing`** | Mocker `utapi` et ses méthodes |
| **`@mux/mux-node`** | Mocker `Mux` |
| **`@anthropic-ai/sdk` / `openai`** | Mocker les appels LLM |
| **`next-intl`** | Créer un `wrapper` avec `NextIntlClientProvider` et messages par défaut |
| **`zustand`** | Utiliser `createStore` directement dans les tests pour initialiser l'état |

---

## Annexes

### A. Scripts de test planifiés

```bash
# Tests unitaires (node)
pnpm test:unit          # vitest run --project unit

# Tests composants (jsdom)
pnpm test:components    # vitest run --project components

# Tests d'intégration
pnpm test:integration   # vitest run src/**/*.integration.test.ts

# Tout sauf E2E
pnpm test:run           # vitest run

# Avec couverture
pnpm test:coverage      # vitest run --coverage

# E2E
pnpm test:e2e           # playwright test
pnpm test:e2e:headed    # playwright test --headed
```

### B. Badges de couverture (README)

```markdown
[![codecov](https://codecov.io/gh/SocialCreator/socialcreator-web/branch/main/graph/badge.svg)](https://codecov.io/gh/SocialCreator/socialcreator-web)
```

### C. Exclusion coverage à vérifier

```typescript
// Ne PAS exclure dans le coverage config final :
// Les fichiers dans src/ DOIVENT être comptés
exclude: [
  "node_modules",
  "dist",
  ".next",
  "**/*.d.ts",
  "**/*.config.ts",
  "**/*.test.*",     // ⚠️ Les fichiers de test doivent être exclus
  "**/__mocks__/**", // ⚠️ Les mocks doivent être exclus
]
```

> **Note :** L'exclusion actuelle de `**/__tests__/**` est trop large car elle exclut aussi les helpers de test. Corriger cette configuration est nécessaire pour avoir un rapport de couverture représentatif.

---

*Document créé le 2026-06-04. Dernière mise à jour : 2026-06-04.*
