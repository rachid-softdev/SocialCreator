# TEST_IMPLEMENTATION_PLAN — SocialCreator

> **Objectif :** Plan d'exécution détaillé pour atteindre ≥90% de couverture de code.
> **Séquence :** Organisé en 10 phases exécutables en parallèle là où les dépendances le permettent.
> **Estimation :** ~350-450 nouveaux fichiers de test.

---

## Table des matières

1. [Dépendances techniques](#1-dépendances-techniques)
2. [Configuration initiale](#2-configuration-initiale)
3. [Phase 1 — Fondations & Utilitaires (P0)](#3-phase-1--fondations--utilitaires-p0)
4. [Phase 2 — Coeur métier : Services & Entitlements (P1)](#4-phase-2--coeur-métier--services--entitlements-p1)
5. [Phase 3 — Stores, Publishers & Repositories (P1)](#5-phase-3--stores-publishers--repositories-p1)
6. [Phase 4 — Composants React (P1)](#6-phase-4--composants-react-p1)
7. [Phase 5 — API Routes (P1-P2)](#7-phase-5--api-routes-p1-p2)
8. [Phase 6 — Pages & Hooks (P2)](#8-phase-6--pages--hooks-p2)
9. [Phase 7 — Triggers & Intégration (P2)](#9-phase-7--triggers--intégration-p2)
10. [Phase 8 — E2E (P2)](#10-phase-8--e2e-p2)
11. [Phase 9 — Packages partagés (P3)](#11-phase-9--packages-partagés-p3)
12. [Phase 10 — Finalisation & CI](#12-phase-10--finalisation--ci)
13. [Synthèse de l'effort](#13-synthèse-de-leffort)

---

## 1. Dépendances techniques

### 1.1 Nouvelles dépendances à installer

```bash
# Dans socialcreator-web/
pnpm add -D \
  jsdom@latest \
  @testing-library/react@latest \
  @testing-library/jest-dom@latest \
  @testing-library/user-event@latest

# Optionnel (recommandé pour les tests API avancés)
pnpm add -D msw@latest

# Pour les tests des packages partagés
# Dans packages/socialcreator-utils/
# pnpm add -D vitest@1
# Dans packages/socialcreator-ui/
# pnpm add -D vitest@1 jsdom @testing-library/react

# Pas besoin d'ajouter whatwg-fetch — Node 22+ a fetch natif
```

### 1.2 Fichiers de configuration à créer/modifier

| Fichier | Action | Détail |
|---------|--------|--------|
| `vitest.config.ts` | **Modifier** | Ajouter projets séparés (node + jsdom) |
| `vitest.dom-setup.ts` | **Créer** | Setup pour tests DOM (jest-dom matchers) |
| `.env.test` | **Créer** | Centraliser les variables d'environnement de test |
| `tsconfig.json` (include) | **Vérifier** | S'assurer que les `__tests__` sont inclus |

---

## 2. Configuration initiale

### 2.1 `vitest.config.ts` — Version cible

```typescript
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules", "dist", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**"],
      exclude: [
        "node_modules",
        "dist",
        ".next",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.test.*",
        "**/*.spec.*",
        "**/__mocks__/**",
        "**/*.integration.test.ts",
        "e2e/**",
      ],
      // 90% minimum (soft check — ne fait pas échouer, mais avertit)
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

### 2.2 Projets séparés (version avec multi-environnements)

```typescript
// Alternative : projets dédiés pour node et jsdom
export default defineConfig({
  // ...shared esbuild + resolve...
  test: {
    // Configuration par défaut (unit + integration)
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["src/**/*.test.tsx", "node_modules", "dist", ".next"],
    coverage: { /* ... */ },
  },
  // Projets additionnels :
  // (décommenter et structurer si on veut séparer l'exécution)
  // projects: [
  //   {
  //     name: "unit",
  //     test: { environment: "node", include: ["src/**/*.test.ts"] },
  //   },
  //   {
  //     name: "dom",
  //     test: {
  //       environment: "jsdom",
  //       setupFiles: ["./vitest.setup.ts", "./vitest.dom-setup.ts"],
  //       include: ["src/**/*.test.tsx"],
  //     },
  //   },
  // ],
});
```

### 2.3 `vitest.dom-setup.ts` — Nouveau fichier

```typescript
import "@testing-library/jest-dom/vitest";
// Les matchers like toBeInTheDocument() sont maintenant disponibles
```

### 2.4 Scripts package.json à ajouter

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --project unit",
    "test:components": "vitest run --project dom",
    "test:integration": "vitest run src/**/*.integration.test.ts",
    "test:watch": "vitest --watch",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 3. Phase 1 — Fondations & Utilitaires (P0)

### 3.1 Description
Tester tous les utilitaires purs (sans dépendances externes). Ces fichiers sont les plus simples à tester et rapportent beaucoup de couverture rapidement.

### 3.2 Fichiers à créer

#### A. `src/lib/utils/` — Utilitaires purs

| Fichier de test | Source testée | Cas à couvrir |
|-----------------|---------------|---------------|
| `src/lib/utils/__tests__/crypto.test.ts` | `crypto.ts` | hash, compare, encrypt, decrypt, generateRandomString, edge cases (empty, special chars, very long) |
| `src/lib/utils/__tests__/fetch-timeout.test.ts` | `fetch-timeout.ts` | timeout déclenché, timeout non atteint, fetch réussi, fetch échoué |
| `src/lib/utils/__tests__/logger.test.ts` | `logger.ts` | log à tous les niveaux (info, warn, error, debug), format, champs obligatoires |
| `src/lib/utils/__tests__/metrics.test.ts` | `metrics.ts` | increment, gauge, histogram, tags, edge cases |
| `src/lib/utils/__tests__/retry.test.ts` | `retry.ts` | retry réussi après N échecs, échec définitif, délai exponentiel, max retries, edge cases |
| `src/lib/utils/__tests__/sanitize.test.ts` | `sanitize.ts` | XSS, HTML, SQL injection, text normal, empty, unicodes |
| `src/lib/utils/__tests__/utils.test.ts` | `utils.ts` | toutes les fonctions exportées, edge cases |

#### B. `src/lib/` — Barrels racine déjà traités via leurs cibles

Les fichiers barils comme `src/lib/crypto.ts`, `src/lib/logger.ts`, etc. (qui ne font que re-exporter) seront couverts automatiquement quand leurs cibles sont testées.

### 3.3 Efforts estimés

| Sous-module | Fichiers | Tests | Effort |
|-------------|----------|-------|--------|
| `src/lib/utils/` | 9 | 7 tests | 2 jours |
| **Total Phase 1** | **9** | **7 tests** | **2 jours** |

---

## 4. Phase 2 — Coeur métier : Services & Entitlements (P1)

### 4.1 Description
Tester les services métier critiques et la logique d'entitlements/paiement. Ces modules ont des dépendances (Prisma, Stripe) mais la logique reste testable via mocks.

### 4.2 Fichiers à créer

#### A. `src/lib/services/` — Services métier

| Fichier de test | Source | Cas à couvrir |
|-----------------|--------|---------------|
| `src/lib/services/agent/__tests__/execute.test.ts` | `agent/execute.ts` | exécution réussie, validation échouée, erreur LLM, timeout, cancellation |
| `src/lib/services/agent/__tests__/persist.test.ts` | `agent/persist.ts` | création, mise à jour, suppression, introuvable, conflit |
| `src/lib/services/agent/__tests__/validate.test.ts` | `agent/validate.ts` | configuration valide, invalide, champs manquants, types incorrects |
| `src/lib/services/__tests__/oauth.test.ts` | `oauth.ts` | échange token, refresh, révocation, error handling |
| `src/lib/services/__tests__/blog.test.ts` | `blog.ts` | CRUD articles, pagination, filtres |
| `src/lib/services/__tests__/cgu-guard.test.ts` | `cgu-guard.ts` | CGU acceptées, non acceptées, expirées |
| `src/lib/services/__tests__/prompts.test.ts` | `prompts.ts` | génération template, variables, edge cases |
| `src/lib/services/__tests__/publish-guard.test.ts` | `publish-guard.ts` | permissions publication, limites, bloquage |
| `src/lib/services/__tests__/quota-guard.test.ts` | `quota-guard.ts` | quota atteint, proche limite, reset, dépassement |
| `src/lib/services/__tests__/team-permissions.test.ts` | `team-permissions.ts` | rôles (owner, admin, editor, viewer), permissions combinées |
| `src/lib/services/__tests__/tokens.test.ts` | `tokens.ts` | création, validation, révocation, expiration, rotation |
| `src/lib/services/__tests__/video-pipeline.test.ts` | `video-pipeline.ts` | pipeline complet, échec étape, retry, timeouts |
| `src/lib/services/__tests__/notification-service.test.ts` | `notification-service.ts` | existant — vérifier coverage, compléter si nécessaire |
| `src/lib/services/__tests__/scheduler-service.test.ts` | `scheduler/index.ts`, `scheduler-service.ts` | existant — vérifier coverage |

#### B. `src/lib/entitlements/` — Entitlements & Paiement

| Fichier de test | Source | Cas à couvrir |
|-----------------|--------|---------------|
| `src/lib/entitlements/__tests__/cache.test.ts` | `cache.ts` | cache hit, cache miss, invalidation, TTL, race condition |
| `src/lib/entitlements/__tests__/downgrade.test.ts` | `downgrade.ts` | downgrade plan, features perdues, features conservées, data cleanup |
| `src/lib/entitlements/__tests__/index.test.ts` | `index.ts` | barrel re-exports (smoke) |
| `src/lib/entitlements/__tests__/repository.test.ts` | `repository.ts` | CRUD entitlements, overrides, find by org/user, edge cases |
| `src/lib/entitlements/__tests__/types.test.ts` | `types.ts` | type guards, validations, parsing | 
| `src/lib/entitlements/__tests__/middleware.test.ts` | `middleware.ts` | existant — vérifier et compléter |
| `src/lib/entitlements/__tests__/service.test.ts` | `service.ts` | existant — vérifier et compléter |
| `src/lib/entitlements/__tests__/stripe-webhook.test.ts` | `stripe-webhook.ts` | existant — vérifier et compléter |

#### C. `src/lib/infrastructure/` — Infrastructure

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/lib/infrastructure/__tests__/prisma.test.ts` | `prisma.ts` | instance unique, connexion, erreur |
| `src/lib/infrastructure/__tests__/stripe.test.ts` | `stripe.ts` | client stripe instancié, webhook parsing, errors |
| `src/lib/infrastructure/__tests__/trigger.test.ts` | `trigger.ts` | client trigger.dev, envoi event, erreur |
| `src/lib/infrastructure/__tests__/trigger-client.test.ts` | `trigger-client.ts` | client config, auth, jobs |
| `src/lib/infrastructure/__tests__/cron.test.ts` | `cron.ts` | scheduling, execution, error |
| `src/lib/infrastructure/__tests__/deepgram.test.ts` | `deepgram.ts` | transcription, error, timeout |
| `src/lib/infrastructure/__tests__/llm.test.ts` | `llm.ts` | completion, streaming, rate-limit, error |
| `src/lib/infrastructure/__tests__/mux.test.ts` | `mux.ts` | upload, asset status, playback ID, error |
| `src/lib/infrastructure/__tests__/rate-limit-fallback.test.ts` | `rate-limit-fallback.ts` | fallback activé, désactivé, comportement |
| `src/lib/infrastructure/__tests__/rate-limit-redis.test.ts` | `rate-limit-redis.ts` | existant — vérifier |

#### D. `src/lib/llm/` — LLM

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/lib/llm/__tests__/index.test.ts` | `index.ts` | barrel re-exports (smoke) |
| `src/lib/llm/__tests__/types.test.ts` | `types.ts` | type parsing, defaults, validation |

#### E. `src/lib/scheduling/` — Scheduling

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/lib/scheduling/__tests__/optimizer.test.ts` | `optimizer.ts` | optimisation planning, conflits, meilleur slot, pas de slot |
| `src/lib/scheduling/__tests__/conflict-detector.test.ts` | `conflict-detector.ts` | existant — vérifier et compléter |

### 4.3 Efforts estimés

| Sous-module | Tests | Effort |
|-------------|-------|--------|
| `src/lib/services/agent/*` | 3 tests | 1.5 jours |
| `src/lib/services/*` | 11 tests | 3 jours |
| `src/lib/entitlements/*` | 5 tests (+ 3 existants) | 1.5 jours |
| `src/lib/infrastructure/*` | 10 tests | 2 jours |
| `src/lib/llm/*` | 2 tests | 0.5 jour |
| `src/lib/scheduling/*` | 1 test (+ 1 existant) | 0.5 jour |
| **Total Phase 2** | **~32 tests** | **~9 jours** |

---

## 5. Phase 3 — Stores, Publishers & Repositories (P1)

### 5.1 Description
Tester la couche de données : repositories (CRUD), publishers (réseaux sociaux), stores (état Zustand).

### 5.2 Fichiers à créer

#### A. `src/lib/repositories/` — Accès aux données

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/lib/repositories/__tests__/agent.repository.test.ts` | `agent.repository.ts` | CRUD, find by profile, pagination, search |
| `src/lib/repositories/__tests__/api-key.repository.test.ts` | `api-key.repository.ts` | création, validation, révocation, expiration |
| `src/lib/repositories/__tests__/connected-account.repository.test.ts` | `connected-account.repository.ts` | existant — vérifier et compléter |
| `src/lib/repositories/__tests__/content.repository.test.ts` | `content.repository.ts` | existant — vérifier et compléter |
| `src/lib/repositories/__tests__/invitation.repository.test.ts` | `invitation.repository.ts` | créer, accepter, refuser, expirer |
| `src/lib/repositories/__tests__/media-asset.repository.test.ts` | `media-asset.repository.ts` | upload, delete, list by content, types |
| `src/lib/repositories/__tests__/notification.repository.test.ts` | `notification.repository.ts` | créer, lister, marquer lu, pagination |
| `src/lib/repositories/__tests__/profile.repository.test.ts` | `profile.repository.ts` | CRUD, find by user, find by platform |
| `src/lib/repositories/__tests__/publish-log.repository.test.ts` | `publish-log.repository.ts` | create, list by content, status filter |
| `src/lib/repositories/__tests__/registry.test.ts` | `registry.ts` | barrel exports, provider resolution |
| `src/lib/repositories/__tests__/team.repository.test.ts` | `team.repository.ts` | CRUD, find by user, members |
| `src/lib/repositories/__tests__/team-member.repository.test.ts` | `team-member.repository.ts` | add, remove, update role, list |
| `src/lib/repositories/__tests__/user.repository.test.ts` | `user.repository.ts` | CRUD, find by email, update profile |
| `src/lib/repositories/__tests__/index.test.ts` | `index.ts` | barrel re-exports (smoke) |

#### B. `src/lib/stores/` — Zustand stores

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/lib/__tests__/stores/agent-store.test.ts` | `agent-store.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/stores/auth-store.test.ts` | `auth-store.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/stores/content-store.test.ts` | `content-store.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/stores/profile-store.test.ts` | `profile-store.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/stores/queue-store.test.ts` | `queue-store.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/stores/ui-store.test.ts` | `ui-store.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/stores/index.test.ts` | `index.ts` | barrel re-exports (smoke) |

#### C. `src/lib/publishers/` — Publication réseaux sociaux

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/lib/__tests__/publishers/facebook.test.ts` | `facebook.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/instagram.test.ts` | `instagram.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/linkedin.test.ts` | `linkedin.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/pinterest.test.ts` | `pinterest.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/threads.test.ts` | `threads.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/tiktok.test.ts` | `tiktok.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/x.test.ts` | `x.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/youtube.test.ts` | `youtube.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/pipeline.test.ts` | `pipeline.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/registry.test.ts` | `registry.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/validators.test.ts` | `validators.ts` | existant — vérifier et compléter |
| `src/lib/__tests__/publishers/index.test.ts` | `index.ts` | barrel re-exports (smoke) |

### 5.3 Efforts estimés

| Sous-module | Tests | Effort |
|-------------|-------|--------|
| `src/lib/repositories/*` | 14 tests | 4 jours |
| `src/lib/stores/*` | 7 tests (existant à enrichir) | 1 jour |
| `src/lib/publishers/*` | 12 tests (existant à enrichir) | 1.5 jours |
| **Total Phase 3** | **~33 tests** | **~6.5 jours** |

---

## 6. Phase 4 — Composants React (P1)

### 6.1 Description
Tester TOUS les composants React avec `@testing-library/react` et jsdom. Chaque composant aura au minimum un smoke test + tests d'interaction.

### 6.2 Template de test pour un composant

```typescript
// __tests__/component.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

// Mock Next.js dependencies if needed
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock next-intl if needed
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

describe("ComponentName", () => {
  it("renders without crashing", () => {
    render(<ComponentName />);
    expect(screen.getByRole("...")).toBeInTheDocument();
  });

  it("handles empty state", () => {
    render(<ComponentName items={[]} />);
    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });

  it("handles error state", () => {
    render(<ComponentName error="Something went wrong" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("handles user interaction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ComponentName onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

### 6.3 Liste complète des composants à tester

#### Groupe A : Auth & Layout (P1 — 8 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/auth/__tests__/login-form.test.tsx` | `login-form.tsx` |
| `src/components/auth/__tests__/register-form.test.tsx` | `register-form.tsx` |
| `src/components/auth/__tests__/oauth-button.test.tsx` | `oauth-button.tsx` |
| `src/components/auth/__tests__/cgu-consent-form.test.tsx` | `cgu-consent-form.tsx` |
| `src/components/layout/__tests__/sidebar.test.tsx` | `sidebar.tsx` |
| `src/components/layout/__tests__/breadcrumb.test.tsx` | `breadcrumb.tsx` |
| `src/components/layout/__tests__/page-header.test.tsx` | `page-header.tsx` |
| `src/components/layout/__tests__/mobile-header.test.tsx` | `mobile-header.tsx` |

#### Groupe B : Content (P1 — 16 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/content/__tests__/content-card.test.tsx` | `content-card.tsx` |
| `src/components/content/__tests__/content-list.test.tsx` | `content-list.tsx` |
| `src/components/content/__tests__/content-editor.test.tsx` | `content-editor.tsx` |
| `src/components/content/__tests__/content-status-badge.test.tsx` | `content-status-badge.tsx` |
| `src/components/content/__tests__/generation-panel.test.tsx` | `generation-panel.tsx` |
| `src/components/content/__tests__/generation-result.test.tsx` | `generation-result.tsx` |
| `src/components/content/__tests__/approval-panel.test.tsx` | `approval-panel.tsx` |
| `src/components/content/__tests__/platform-preview.test.tsx` | `platform-preview.tsx` |
| `src/components/content/__tests__/publish-button.test.tsx` | `publish-button.tsx` |
| `src/components/content/__tests__/publish-modal.test.tsx` | `publish-modal.tsx` |
| `src/components/content/__tests__/publish-history.test.tsx` | `publish-history.tsx` |
| `src/components/content/__tests__/review-dialog.test.tsx` | `review-dialog.tsx` |
| `src/components/content/__tests__/schedule-panel.test.tsx` | `schedule-panel.tsx` |
| `src/components/content/__tests__/date-time-picker.test.tsx` | `date-time-picker.tsx` |
| `src/components/content/__tests__/platform-badge.test.tsx` | `platform-badge.tsx` |
| `src/components/content/__tests__/timezone-select.test.tsx` | `timezone-select.tsx` |

#### Groupe C : Connected Accounts (P1 — 7 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/connected-accounts/__tests__/account-card.test.tsx` | `account-card.tsx` |
| `src/components/connected-accounts/__tests__/account-list.test.tsx` | `account-list.tsx` |
| `src/components/connected-accounts/__tests__/connect-modal.test.tsx` | `connect-modal.tsx` |
| `src/components/connected-accounts/__tests__/disconnect-modal.test.tsx` | `disconnect-modal.tsx` |
| `src/components/connected-accounts/__tests__/connection-toast.test.tsx` | `connection-toast.tsx` |
| `src/components/connected-accounts/__tests__/platform-icon.test.tsx` | `platform-icon.tsx` |

#### Groupe D : Dashboard (P2 — 8 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/dashboard/__tests__/dashboard-stats.test.tsx` | `dashboard-stats.tsx` |
| `src/components/dashboard/__tests__/stats-card.test.tsx` | `stats-card.tsx` |
| `src/components/dashboard/__tests__/stats-grid.test.tsx` | `stats-grid.tsx` |
| `src/components/dashboard/__tests__/active-agents.test.tsx` | `active-agents.tsx` |
| `src/components/dashboard/__tests__/publish-chart.test.tsx` | `publish-chart.tsx` |
| `src/components/dashboard/__tests__/publish-stats.test.tsx` | `publish-stats.tsx` |
| `src/components/dashboard/__tests__/quick-actions.test.tsx` | `quick-actions.tsx` |
| `src/components/dashboard/__tests__/recent-content.test.tsx` | `recent-content.tsx` |

#### Groupe E : Agent (P2 — 10 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/agent/__tests__/agent-card.test.tsx` | `agent-card.tsx` |
| `src/components/agent/__tests__/agent-list.test.tsx` | `agent-list.tsx` |
| `src/components/agent/__tests__/agent-form.test.tsx` | `agent-form.tsx` |
| `src/components/agent/__tests__/agent-detail-client.test.tsx` | `agent-detail-client.tsx` |
| `src/components/agent/__tests__/agents-client.test.tsx` | `agents-client.tsx` |
| `src/components/agent/__tests__/all-agents-client.test.tsx` | `all-agents-client.tsx` |
| `src/components/agent/__tests__/agent-run-modal.test.tsx` | `agent-run-modal.tsx` |
| `src/components/agent/__tests__/run-detail.test.tsx` | `run-detail.tsx` |
| `src/components/agent/__tests__/run-list.test.tsx` | `run-list.tsx` |
| `src/components/agent/__tests__/run-status-badge.test.tsx` | `run-status-badge.tsx` |

#### Groupe F : Profile & Settings (P2 — 7 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/profile/__tests__/profile-card.test.tsx` | `profile-card.tsx` |
| `src/components/profile/__tests__/profile-form.test.tsx` | `profile-form.tsx` |
| `src/components/profile/__tests__/brand-voice-editor.test.tsx` | `brand-voice-editor.tsx` |
| `src/components/profile/__tests__/content-bank-editor.test.tsx` | `content-bank-editor.tsx` |
| `src/components/settings/__tests__/settings-form.test.tsx` | `settings-form.tsx` |
| `src/components/admin/__tests__/confirm-dialog.test.tsx` | `confirm-dialog.tsx` |

#### Groupe G : Billing & Entitlements (P2 — 6 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/billing/__tests__/billing-overview.test.tsx` | `billing-overview.tsx` |
| `src/components/billing/__tests__/plan-selector.test.tsx` | `plan-selector.tsx` |
| `src/components/billing/__tests__/pricing-table.test.tsx` | `pricing-table.tsx` |
| `src/components/billing/__tests__/subscription-status.test.tsx` | `subscription-status.tsx` |
| `src/components/entitlements/__tests__/FeatureGuard.test.tsx` | `FeatureGuard.tsx` |

#### Groupe H : Video & Calendar (P3 — 11 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/video/__tests__/upload-button.test.tsx` | `upload-button.tsx` |
| `src/components/video/__tests__/video-upload.test.tsx` | `video-upload.tsx` |
| `src/components/video/__tests__/video-timeline.test.tsx` | `video-timeline.tsx` |
| `src/components/video/__tests__/clip-selector.test.tsx` | `clip-selector.tsx` |
| `src/components/video/__tests__/clips-list.test.tsx` | `clips-list.tsx` |
| `src/components/video/__tests__/mux-player.test.tsx` | `mux-player.tsx` |
| `src/components/video/__tests__/transcript-viewer.test.tsx` | `transcript-viewer.tsx` |
| `src/components/video/__tests__/index.test.tsx` | `index.ts` barrel |
| `src/components/calendar/__tests__/calendar-event-detail.test.tsx` | `calendar-event-detail.tsx` |
| `src/components/calendar/__tests__/today-schedule-list.test.tsx` | `today-schedule-list.tsx` |
| `src/components/calendar/__tests__/calendar-platform-filter.test.tsx` | `calendar-platform-filter.tsx` |

#### Groupe I : Analytics, Blog & Others (P3 — 15 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/analytics/__tests__/charts.test.tsx` | `charts.tsx` |
| `src/components/analytics/__tests__/date-range-picker.test.tsx` | `date-range-picker.tsx` |
| `src/components/analytics/__tests__/platform-table.test.tsx` | `platform-table.tsx` |
| `src/components/analytics/__tests__/stats-card.test.tsx` | `stats-card.tsx` |
| `src/components/blog/__tests__/blog-list.test.tsx` | `blog-list.tsx` |
| `src/components/blog/__tests__/post-card.test.tsx` | `post-card.tsx` |
| `src/components/blog/__tests__/post-content.test.tsx` | `post-content.tsx` |
| `src/components/blog/__tests__/post-header.test.tsx` | `post-header.tsx` |
| `src/components/blog/__tests__/reading-progress.test.tsx` | `reading-progress.tsx` |
| `src/components/shared/__tests__/pagination.test.tsx` | `pagination.tsx` |
| `src/components/shared/__tests__/search-bar.test.tsx` | `search-bar.tsx` |
| `src/components/job-queue/__tests__/queue-status.test.tsx` | `queue-status.tsx` |
| `src/components/mcp/__tests__/api-key-manager.test.tsx` | `api-key-manager.tsx` |
| `src/components/mcp/__tests__/mcp-tester.test.tsx` | `mcp-tester.tsx` |
| `src/components/notifications/__tests__/notification-bell.test.tsx` | `notification-bell.tsx` |

#### Groupe J : Racine & Error (P3 — 3 tests)

| Fichier de test | Composants |
|-----------------|------------|
| `src/components/__tests__/error-boundary.test.tsx` | `error-boundary.tsx` |
| `src/components/__tests__/toast-provider.test.tsx` | `toast-provider.tsx` |
| `src/components/__tests__/toast-layout-wrapper.test.tsx` | `toast-layout-wrapper.tsx` |

### 6.4 Efforts estimés

| Groupe | Tests | Effort |
|--------|-------|--------|
| A — Auth & Layout | 8 | 1.5 jours |
| B — Content | 16 | 3 jours |
| C — Connected Accounts | 6 | 1 jour |
| D — Dashboard | 8 | 1.5 jours |
| E — Agent | 10 | 2 jours |
| F — Profile & Settings | 6 | 1 jour |
| G — Billing & Entitlements | 5 | 1 jour |
| H — Video & Calendar | 11 | 2 jours |
| I — Analytics, Blog & Others | 15 | 2.5 jours |
| J — Racine & Error | 3 | 0.5 jour |
| **Total Phase 4** | **~88 tests** | **~16 jours** |

---

## 7. Phase 5 — API Routes (P1-P2)

### 7.1 Description
Tester toutes les routes API non encore couvertes. Chaque route handler (export GET, POST, PUT, PATCH, DELETE) doit avoir au moins : test 401 (non auth), test 400 (validation), test 200/201 (succès), test 404 (not found).

### 7.2 Routes API existantes sans tests (à créer)

#### Groupe A : Routes critiques (P1)

| Route | Handler | Tests à créer |
|-------|---------|---------------|
| `src/app/api/agents/[id]/route.ts` | GET, PUT, DELETE | 3 handlers × 4 cas = 12 |
| `src/app/api/agents/[id]/run/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/agents/[id]/runs/[runId]/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/analytics/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/analytics/cap-status/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/analytics/ingest/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/api-keys/route.ts` | GET, POST | 2 handlers × 4 cas = 8 |
| `src/app/api/api-keys/[id]/route.ts` | DELETE | 1 handler × 4 cas = 4 |
| `src/app/api/auth/cgu-status/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/auth/[...nextauth]/route.ts` | GET, POST | Test d'intégration NextAuth |
| `src/app/api/connected-accounts/route.ts` | GET, POST | 2 handlers × 4 cas = 8 |
| `src/app/api/connected-accounts/[id]/route.ts` | GET, DELETE | 2 handlers × 4 cas = 8 |
| `src/app/api/connected-accounts/[id]/refresh/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/connected-accounts/callback/[platform]/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/connected-accounts/redirect/[platform]/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/content/[id]/route.ts` | GET, PUT, DELETE | 3 handlers × 4 cas = 12 |
| `src/app/api/content/[id]/approve/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/content/[id]/publish/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/content/[id]/reject/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/content/[id]/schedule/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/content/[id]/cap-status/route.ts` | GET | 1 handler × 4 cas = 4 |
| `src/app/api/content/bulk/route.ts` | POST | 1 handler × 4 cas = 4 |
| `src/app/api/content/route.ts` | GET, POST | 2 handlers × 4 cas = 8 |

#### Groupe B : Routes secondaires (P2)

| Route | Tests |
|-------|-------|
| `src/app/api/debug/entitlements/route.ts` | 1 handler × 3 cas = 3 |
| `src/app/api/entitlements/route.ts` | 1 handler × 4 cas = 4 |
| `src/app/api/health/route.ts` | 1 handler × 2 cas = 2 |
| `src/app/api/mcp/auth.ts` | test unitaire du module |
| `src/app/api/mcp/route.ts` | 1 handler × 4 cas = 4 |
| `src/app/api/metrics/route.ts` | 1 handler × 3 cas = 3 |
| `src/app/api/profiles/[id]/route.ts` | GET, PUT = 2 handlers × 4 cas = 8 |
| `src/app/api/profiles/route.ts` | GET, POST = 2 handlers × 4 cas = 8 |
| `src/app/api/stripe/checkout/route.ts` | POST = 1 handler × 3 cas = 3 |
| `src/app/api/stripe/portal/route.ts` | POST = 1 handler × 3 cas = 3 |
| `src/app/api/stripe/webhook/route.ts` | POST = 1 handler × 5 cas = 5 |
| `src/app/api/teams/route.ts` | GET, POST = 2 handlers × 4 cas = 8 |
| `src/app/api/teams/[teamId]/invite/route.ts` | POST = 1 handler × 4 cas = 4 |
| `src/app/api/teams/members/route.ts` | GET = 1 handler × 4 cas = 4 |
| `src/app/api/teams/members/[memberId]/route.ts` | DELETE, PATCH = 2 handlers |
| `src/app/api/uploadthing/route.ts` | GET, POST = 2 handlers × 3 cas |
| `src/app/api/v1/agents/route.ts` | GET, POST = 2 handlers × 4 cas |
| `src/app/api/v1/agents/[id]/route.ts` | GET, PUT, DELETE = 3 handlers |
| `src/app/api/v1/agents/[id]/runs/route.ts` | GET, POST = 2 handlers |
| `src/app/api/v1/connected-accounts/route.ts` | GET = 1 handler |
| `src/app/api/v1/connected-accounts/[id]/route.ts` | GET, DELETE = 2 handlers |
| `src/app/api/v1/connected-accounts/[id]/refresh/route.ts` | POST = 1 handler |
| `src/app/api/v1/content/route.ts` | GET, POST = 2 handlers |
| `src/app/api/v1/content/[id]/route.ts` | existant — vérifier |
| `src/app/api/v1/content/[id]/approve-review/route.ts` | POST = 1 handler |
| `src/app/api/v1/content/[id]/reject-review/route.ts` | POST = 1 handler |
| `src/app/api/v1/content/[id]/submit-review/route.ts` | POST = 1 handler |
| `src/app/api/v1/content/generate/batch/route.ts` | POST = 1 handler |
| `src/app/api/v1/dashboard/route.ts` | GET = 1 handler |
| `src/app/api/v1/dashboard/chart-data/route.ts` | GET = 1 handler |
| `src/app/api/v1/health/route.ts` | GET = 1 handler |
| `src/app/api/v1/invitations/route.ts` | GET = 1 handler |
| `src/app/api/v1/invitations/[token]/accept/route.ts` | POST = 1 handler |
| `src/app/api/v1/invitations/[token]/decline/route.ts` | POST = 1 handler |
| `src/app/api/v1/media/route.ts` | POST = 1 handler |
| `src/app/api/v1/media/[id]/route.ts` | GET, DELETE = 2 handlers |
| `src/app/api/v1/notifications/route.ts` | GET = 1 handler |
| `src/app/api/v1/notifications/[id]/read/route.ts` | POST = 1 handler |
| `src/app/api/v1/notifications/read-all/route.ts` | POST = 1 handler |
| `src/app/api/v1/notifications/stream/route.ts` | GET = 1 handler |
| `src/app/api/v1/notifications/unread-count/route.ts` | GET = 1 handler |
| `src/app/api/v1/profiles/route.ts` | GET, POST = 2 handlers |
| `src/app/api/v1/profiles/[id]/route.ts` | GET, PUT, DELETE = 3 handlers |
| `src/app/api/v1/profiles/[id]/share/route.ts` | POST = 1 handler |
| `src/app/api/v1/publish-logs/route.ts` | GET = 1 handler |
| `src/app/api/v1/teams/route.ts` | GET, POST = 2 handlers |
| `src/app/api/v1/teams/[id]/dashboard/route.ts` | GET = 1 handler |
| `src/app/api/v1/teams/[id]/invitations/route.ts` | GET = 1 handler |
| `src/app/api/video/route.ts` | GET, POST = 2 handlers |
| `src/app/api/video/[id]/route.ts` | existant — vérifier |
| `src/app/api/video/[id]/clips/route.ts` | POST = 1 handler |
| `src/app/api/video/[id]/generate/route.ts` | POST = 1 handler |
| `src/app/api/video/[id]/segments/route.ts` | POST = 1 handler |
| `src/app/api/video/[id]/transcribe/route.ts` | POST = 1 handler |
| `src/app/api/video/upload/route.ts` | POST = 1 handler |

### 7.3 Efforts estimés

| Groupe | Routes | Tests | Effort |
|--------|--------|-------|--------|
| A — Critiques | ~30 routes | ~80 handlers × 4 cas = ~320 tests | 8 jours |
| B — Secondaires | ~50 routes | ~80 handlers × 3 cas = ~240 tests | 6 jours |
| **Total Phase 5** | **~80 routes** | **~560 tests** | **14 jours** |

---

## 8. Phase 6 — Pages & Hooks (P2)

### 8.1 Description
- **Pages :** Smoke tests pour chaque page (rendu sans crash) + tests d'état basiques
- **Hooks :** Tests exhaustifs avec `renderHook`

### 8.2 Pages à tester (30+ pages)

Chaque page reçoit un smoke test minimal :

```typescript
// __tests__/page.smoke.test.tsx — exemple template
import { render, screen } from "@testing-library/react";
import Page from "../page";
import { describe, it, expect } from "vitest";

// Mocks nécessaires pour Next.js App Router
vi.mock("next/navigation", () => ({ /* ... */ }));
vi.mock("@/lib/auth", () => ({ auth: () => ({ user: { id: "1" } }) }));

describe("PageName", () => {
  it("renders without crashing", async () => {
    const Component = await Page();
    render(Component);
    expect(screen.getByText(/* expected text */)).toBeInTheDocument();
  });
});
```

**Pages à tester :**

| Page | Chemin | Catégorie |
|------|--------|-----------|
| Landing | `src/app/page.tsx` | Publique |
| Login | `src/app/(auth)/login/page.tsx` | Publique |
| Register | `src/app/(auth)/register/page.tsx` | Publique |
| Dashboard | `src/app/(main)/dashboard/page.tsx` | Authentifiée |
| Content list | `src/app/(main)/content/page.tsx` | Authentifiée |
| Content detail | `src/app/(main)/content/[id]/page.tsx` | Authentifiée |
| Content calendar | `src/app/(main)/content/calendar/page.tsx` | Authentifiée |
| Content queue | `src/app/(main)/content/queue/page.tsx` | Authentifiée |
| Content history | `src/app/(main)/content/history/page.tsx` | Authentifiée |
| Content generate | `src/app/(main)/content/generate/page.tsx` | Authentifiée |
| Agents | `src/app/(main)/agents/page.tsx` | Authentifiée |
| Agent detail | `src/app/(main)/profiles/[profileId]/agents/[agentId]/page.tsx` | Authentifiée |
| Agent runs | `src/app/(main)/profiles/[profileId]/agents/[agentId]/runs/[runId]/page.tsx` | Authentifiée |
| Agent edit | `src/app/(main)/profiles/[profileId]/agents/[agentId]/edit/page.tsx` | Authentifiée |
| Agent new | `src/app/(main)/profiles/[profileId]/agents/new/page.tsx` | Authentifiée |
| Profiles | `src/app/(main)/profiles/page.tsx` | Authentifiée |
| Profile detail | `src/app/(main)/profiles/[profileId]/page.tsx` | Authentifiée |
| Profile edit | `src/app/(main)/profiles/[profileId]/edit/page.tsx` | Authentifiée |
| Profile accounts | `src/app/(main)/profiles/[profileId]/accounts/page.tsx` | Authentifiée |
| Profile video | `src/app/(main)/profiles/[profileId]/video/page.tsx` | Authentifiée |
| Profile new | `src/app/(main)/profiles/new/page.tsx` | Authentifiée |
| Analytics | `src/app/(main)/analytics/page.tsx` | Authentifiée |
| Pricing | `src/app/(main)/pricing/page.tsx` | Authentifiée |
| Settings | `src/app/(main)/settings/page.tsx` | Authentifiée |
| Settings billing | `src/app/(main)/settings/billing/page.tsx` | Authentifiée |
| Settings teams | `src/app/(main)/settings/teams/page.tsx` | Authentifiée |
| Settings api-keys | `src/app/(main)/settings/api-keys/page.tsx` | Authentifiée |
| Video | `src/app/(main)/video/page.tsx` | Authentifiée |
| Onboarding agent | `src/app/(onboarding)/agent/page.tsx` | Authentifiée |
| Onboarding CGU | `src/app/(onboarding)/cgu/page.tsx` | Authentifiée |
| Onboarding profile | `src/app/(onboarding)/profile/page.tsx` | Authentifiée |
| Admin | `src/app/(main)/admin/page.tsx` | Admin |
| Blog | `src/app/blog/page.tsx` | Publique |
| Blog post | `src/app/blog/[slug]/page.tsx` | Publique |
| Maintenance | `src/app/maintenance/page.tsx` | Publique |
| Error | `src/app/error.tsx` | Globale |
| Not found | `src/app/not-found.tsx` | Globale |

### 8.3 Hooks à tester (2 hooks)

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/hooks/__tests__/use-notifications.test.ts` | `use-notifications.ts` | fetch notifications, marquer lu, polling, erreur, empty |
| `src/hooks/__tests__/use-toast.test.ts` | `use-toast.ts` | show toast, dismiss, auto-dismiss, types (success, error, info) |

### 8.4 Efforts estimés

| Sous-module | Tests | Effort |
|-------------|-------|--------|
| Pages | 36 smoke tests | 4 jours |
| Hooks | 2 tests | 0.5 jour |
| **Total Phase 6** | **~38 tests** | **~4.5 jours** |

---

## 9. Phase 7 — Triggers & Intégration (P2)

### 9.1 Description
- **Triggers Trigger.dev :** Tester chaque trigger avec mocks
- **Tests d'intégration :** Flux complets cross-module

### 9.2 Triggers à tester

| Fichier de test | Source | Cas |
|-----------------|--------|------|
| `src/triggers/__tests__/agent-scheduler.trigger.test.ts` | `agent-scheduler.trigger.ts` | scheduling execution, erreur, retry |
| `src/triggers/__tests__/publish-worker.trigger.test.ts` | `publish-worker.trigger.ts` | publication worker, file, retry, dead letter |
| `src/triggers/__tests__/scheduled-content.trigger.test.ts` | `scheduled-content.trigger.ts` | contenu programmé, échéance, erreur |
| `src/triggers/__tests__/video-pipeline.trigger.test.ts` | `video-pipeline.trigger.ts` | pipeline vidéo, étapes, rollback |
| `src/triggers/__tests__/index.test.ts` | `index.ts` | barrel re-exports (smoke) |

### 9.3 Tests d'intégration à créer

| Fichier de test | Flux testé |
|-----------------|------------|
| `src/lib/__tests__/publish-flow.integration.test.ts` | API content → publisher → publish-log |
| `src/lib/__tests__/agent-execution.integration.test.ts` | Agent run → LLM → content generation → persistence |
| `src/lib/__tests__/oauth-flow.integration.test.ts` | OAuth URL → callback → token exchange → storage |
| `src/lib/__tests__/entitlements-flow.integration.test.ts` | Stripe webhook → entitlement update → cache invalidation |
| `src/lib/__tests__/team-invitation-flow.integration.test.ts` | Invitation → accept → team membership → permissions |
| `src/lib/__tests__/video-pipeline-flow.integration.test.ts` | Upload → transcode → segments → publish |

### 9.4 Efforts estimés

| Sous-module | Tests | Effort |
|-------------|-------|--------|
| Triggers | 5 tests | 1.5 jours |
| Intégration | 6 tests | 2 jours |
| **Total Phase 7** | **~11 tests** | **~3.5 jours** |

---

## 10. Phase 8 — E2E (P2)

### 10.1 Description
Étendre les tests Playwright pour couvrir les parcours critiques complets.

### 10.2 Nouveaux spec files

| Fichier | Scénarios |
|---------|-----------|
| `e2e/auth.spec.ts` | ✅ Existant — enrichir avec : inscription avec validation d'email, reset password, OAuth login |
| `e2e/landing.spec.ts` | ✅ Existant — enrichir avec : navigation, responsive, liens |
| `e2e/content-creation.spec.ts` | ⬅ NOUVEAU : créer un agent → générer du contenu → éditer → sauvegarder |
| `e2e/content-publish.spec.ts` | ⬅ NOUVEAU : sélectionner contenu → choisir plateforme → programmer → publier |
| `e2e/profiles.spec.ts` | ⬅ NOUVEAU : créer profil → connecter compte social → modifier |
| `e2e/agents.spec.ts` | ⬅ NOUVEAU : créer agent → configurer → exécuter → voir résultats |
| `e2e/billing.spec.ts` | ⬅ NOUVEAU : voir plans → changer plan → voir factures |
| `e2e/teams.spec.ts` | ⬅ NOUVEAU : inviter membre → gérer rôles → accepter invitation |
| `e2e/navigation.spec.ts` | ⬅ NOUVEAU : navigation sidebar → breadcrumbs → routes protégées → 404 → responsive (mobile) |

### 10.3 Page Objects à créer

| Fichier | Page |
|---------|------|
| `e2e/pages/content.page.ts` | Page de gestion de contenu |
| `e2e/pages/profile.page.ts` | Page de profils |
| `e2e/pages/agent.page.ts` | Page d'agents |
| `e2e/pages/settings.page.ts` | Page de settings |
| `e2e/pages/team.page.ts` | Page d'équipe |
| `e2e/pages/billing.page.ts` | Page de paiement |

### 10.4 Configuration Playwright à enrichir

```typescript
// Ajouter Firefox et mobile
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
],
```

### 10.5 Efforts estimés

| Tâche | Fichiers | Effort |
|-------|----------|--------|
| Enrichir specs existants | 4 | 1 jour |
| Nouveaux specs | 6 | 4 jours |
| Nouveaux page objects | 6 | 1 jour |
| Configuration | 1 (playwright.config.ts) | 0.5 jour |
| **Total Phase 8** | **~17 fichiers** | **~6.5 jours** |

---

## 11. Phase 9 — Packages partagés (P3)

### 11.1 Description
Tester les packages partagés du monorepo qui n'ont actuellement aucun test.

### 11.2 `@socialcreator/utils` (5-10 fichiers)

Créer `packages/socialcreator-utils/vitest.config.ts` et des tests pour chaque utilitaire.

### 11.3 `@socialcreator/ui` (composants partagés)

Créer `packages/socialcreator-ui/vitest.config.ts` (avec jsdom) et des tests pour chaque composant.

### 11.4 `@socialcreator/types` (types TypeScript)

Tests de compilation / type-checking uniquement.

### 11.5 Efforts estimés

| Package | Tests | Effort |
|---------|-------|--------|
| `@socialcreator/utils` | ~8 tests | 1 jour |
| `@socialcreator/ui` | ~5 tests | 1.5 jours |
| `@socialcreator/types` | ~3 tests (type) | 0.5 jour |
| **Total Phase 9** | **~16 tests** | **~3 jours** |

---

## 12. Phase 10 — Finalisation & CI

### 12.1 Actions

| Action | Détail |
|--------|--------|
| 🎯 **Configurer les thresholds de coverage** | `vitest.config.ts` : `thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 }` |
| 🔁 **CI : Ajouter une vérification de coverage** | Dans `.github/workflows/ci.yml`, job `test` : échouer si coverage < 90% |
| 📊 **Codecov : Vérifier l'upload** | S'assurer que le rapport JSON est complet et uploadé |
| 📝 **README : Ajouter badge de coverage** | Badge Codecov dans le README principal |
| 🧹 **Nettoyage** | Supprimer les tests redondants, vérifier les doublons |
| 📋 **Audit final** | `pnpm test:coverage` → vérifier tous les seuils → documenter les exceptions |

### 12.2 Configuration CI enrichie

```yaml
# Dans .github/workflows/ci.yml (extrait modifié)
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
    - run: pnpm install
    - run: pnpm --filter=socialcreator-web exec prisma generate
    - run: pnpm --filter=socialcreator-web test:coverage
    - name: Check coverage thresholds
      run: |
        # Extraire le pourcentage de coverage du rapport
        COVERAGE=$(grep -oP 'Statements\s*:\s*\K[0-9.]+(?=%)' <(pnpm --filter=socialcreator-web exec vitest run --coverage))
        if (( $(echo "$COVERAGE < 90" | bc -l) )); then
          echo "❌ Coverage $COVERAGE% is below 90% threshold"
          exit 1
        fi
        echo "✅ Coverage $COVERAGE% meets threshold"
    - name: Upload coverage reports
      uses: codecov/codecov-action@v4
      with:
        files: ./coverage/coverage-final.json
        fail_if_error: true
```

### 12.3 Efforts estimés

| Action | Effort |
|--------|--------|
| Config thresholds | 0.5 jour |
| CI enrichment | 1 jour |
| Nettoyage & audit | 1.5 jours |
| **Total Phase 10** | **3 jours** |

---

## 13. Synthèse de l'effort

### 13.1 Récapitulatif par phase

| Phase | Description | Tests | Effort (jours) |
|-------|-------------|-------|----------------|
| 1 | Fondations & Utilitaires | 7 | 2 |
| 2 | Coeur métier : Services & Entitlements | 32 | 9 |
| 3 | Stores, Publishers & Repositories | 33 | 6.5 |
| 4 | Composants React | 88 | 16 |
| 5 | API Routes | 560 | 14 |
| 6 | Pages & Hooks | 38 | 4.5 |
| 7 | Triggers & Intégration | 11 | 3.5 |
| 8 | E2E | 10 spec files | 6.5 |
| 9 | Packages partagés | 16 | 3 |
| 10 | Finalisation & CI | — | 3 |
| **TOTAL** | | **~780-850 tests** | **~68 jours-homme** |

### 13.2 Estimation par équipe

| Configuration | Durée calendaire |
|---------------|------------------|
| 1 développeur | 68 jours (~3.5 mois) |
| 2 développeurs | 34 jours (~1.7 mois) |
| 3 développeurs | 23 jours (~1.2 mois) |
| 4 développeurs | 17 jours (~1 mois) |

### 13.3 Optimisations possibles

| Optimisation | Gain |
|--------------|------|
| Générateur de tests unitaires pour les API routes (pattern répétitif) | -30% sur Phase 5 |
| Smoke tests automatisés pour les pages (rendu seulement) | -50% sur Phase 6 |
| Parallélisation des phases 2-3-4 | -40% temps calendaire |
| Utilisation d'IA pour générer les tests de composants basiques | -20% sur Phase 4 |

### 13.4 Dépendances inter-phases

```mermaid
graph TD
    Phase1[Phase 1: Utilitaires] --> Phase2[Phase 2: Services]
    Phase1 --> Phase3[Phase 3: Stores/Publishers]
    Phase2 --> Phase5[Phase 5: API Routes]
    Phase3 --> Phase5
    Phase4[Phase 4: Composants] -.-> Peut démarrer après config jsdom
    Phase6[Phase 6: Pages] --> Dépend de Phase 4 (patterns)
    Phase7[Phase 7: Triggers] --> Dépend de Phase 2 (services)
    Phase8[Phase 8: E2E] --> Dépend de Phase 5 (API stabilité)
    Phase9[Phase 9: Packages] --> Indépendant (parallélisable)
    Phase10[Phase 10: Finalisation] --> Dépend de toutes les phases
```

**Phases parallélisables :** 1, 9 (fondations) → 2, 3, 4 (en parallèle) → 5, 6, 7, 8 (en parallèle) → 10

### 13.5 Risques temporels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Composants avec trop de dépendances Next.js | Élevée | 3 jours supp. | Créer des wrappers de test réutilisables |
| Tests flakes E2E en CI | Moyenne | 2 jours supp. | `retries: 2`, `fullyParallel`, traces |
| Couverture difficile sur les barrels | Faible | 1 jour | Smoke tests sur les index.ts |
| Couverture des pages avec async components | Moyenne | 3 jours supp. | Utiliser `render(await Page())` ou mocker le rendu serveur |

---

**Document créé le 2026-06-04 — Dernière mise à jour : 2026-06-04**

**Prochaine étape recommandée :** Valider ce plan avec l'équipe, installer les dépendances (Phase 0), puis commencer la Phase 1.
