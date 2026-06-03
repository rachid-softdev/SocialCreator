# 🛠️ SocialCreator — Plan d'Implémentation Détaillé

> **Basé sur** : `REVIEW.md` (audit complet multi-couche)
> **Revue architecturale** : Validée — corrections appliquées ci-dessous
> **Objectif** : Guide d'exécution pas-à-pas pour corriger tous les problèmes identifiés
> **Fichiers modifiés** : ~40 fichiers | **Nouveaux fichiers** : ~15

---

## 📋 Structure du document

Pour chaque tâche :
```
## [ID] Titre
**Fichiers** : [chemins exacts]
**Effort** : [XS/S/M/L/XL]
**Dépendances** : [IDs des tâches prérequises]
**Test** : [commande de vérification]

### Contexte
...

### Modifications
1. Fichier: `path/to/file` — [Action précise]
   ```code
   // extrait du changement
   ```

### Vérification
...
```

---

# 🚨 SPRINT 1 — Correctifs critiques (semaine 1-2)

---

## S1.1 — Menu mobile : ajouter le handler onClick + drawer

**Fichiers** : `socialcreator-web/src/app/(main)/layout.tsx`, `socialcreator-web/src/components/layout/sidebar.tsx`
**Effort** : XS
**Dépendances** : aucune
**Test** : `pnpm dev`, ouvrir sur mobile (320px), cliquer sur l'icône Menu → la sidebar doit s'afficher

### Contexte
Le header mobile dans `(main)/layout.tsx` a une icône `<Menu>` sans `onClick`. La sidebar (`sidebar.tsx`) a déjà les props `isOpen` et `onClose` mais elles ne sont jamais transmises depuis le layout. Ce sont des `"use client"` state — mais le layout est un Server Component. Il faut ajouter un Client Component wrapper.

### Modifications

**1. Nouveau fichier** : `socialcreator-web/src/components/layout/mobile-header.tsx`

```tsx
"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "./sidebar";

export function MobileHeader({ user }: { user?: { name?: string | null; image?: string | null } | null }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden h-16 flex items-center gap-4 px-4 border-b border-hairline bg-canvas sticky top-0 z-30">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          className="p-1 -ml-1 rounded-lg hover:bg-surface-strong transition-colors"
        >
          <Menu className="w-6 h-6 text-ink" />
        </button>
        <span className="font-display text-title-md text-ink">SocialCreator</span>
      </header>

      {/* Sidebar (mobile drawer mode) */}
      <Sidebar user={user} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

**2. Modifier** : `socialcreator-web/src/app/(main)/layout.tsx`

Remplacer le header mobile en dur par le nouveau composant :

```tsx
import { MobileHeader } from "@/components/layout/mobile-header";

// Dans le JSX, remplacer :
{/* <header className="lg:hidden ..."> ... </header> */}
// Par :
<MobileHeader user={user} />

// Et remplacer la ligne <Sidebar user={session.user} /> par :
<Sidebar user={session.user} />  {/* Keep this for desktop — MobileHeader handles mobile */}
```

**Note** : la sidebar s'affiche désormais via `MobileHeader` sur mobile ET via le JSX direct sur desktop. Pour éviter la double sidebar, conditionner l'affichage :

```tsx
<div className="min-h-screen bg-canvas">
  {/* Desktop sidebar (hidden on mobile) */}
  <div className="hidden lg:block">
    <Sidebar user={session.user} />
  </div>

  <main className="lg:pl-[256px]">
    <MobileHeader user={user} />
    <div className="p-6 lg:p-8">{children}</div>
  </main>
</div>
```

### Vérification
1. `pnpm dev` sur le workspace web
2. Réduire à 320px de large
3. Cliquer sur l'icône Menu → la sidebar doit glisser depuis la gauche
4. L'overlay noir semi-transparent doit apparaître derrière
5. Cliquer sur l'overlay → la sidebar se referme
6. Cliquer sur un lien de navigation → la sidebar se referme

---

## S1.2 — Vérification de propriété IDOR sur toutes les routes API

**Fichiers** : `socialcreator-web/src/app/api/content/[id]/route.ts`, `socialcreator-web/src/app/api/agents/[id]/route.ts`, `socialcreator-web/src/app/api/profiles/[id]/route.ts`, `socialcreator-web/src/app/api/connected-accounts/[id]/route.ts`, `socialcreator-web/src/app/api/video/[id]/route.ts`, `socialcreator-web/src/app/api/media/[id]/route.ts`, `socialcreator-web/src/app/api/api-keys/[id]/route.ts`, `socialcreator-web/src/app/api/teams/[teamId]/route.ts`
**Effort** : M
**Dépendances** : aucune
**Test** : Créer un contenu avec user A, tenter d'accéder `GET /api/content/[id]` avec user B → doit retourner 404

### Contexte
Le fichier `src/lib/ownership.ts` existe avec toutes les fonctions de vérification (`verifyProfileOwnership`, `verifyAgentOwnership`, `verifyContentOwnership`, etc.). Mais ces fonctions ne sont PAS utilisées dans les route handlers actuels. Les routes utilisent leurs propres helpers privés (`getContentOr404`, `getAgentOr404`, `getProfileOr404`) qui font la vérification — **correctement** — mais de manière dupliquée.

⚠️ **Correction architecture** : Les routes VÉRIFIENT déjà l'ownership via leurs helpers privés. Le problème n'est pas l'absence de vérification mais :
1. **La duplication** — 4 helpers privés reproduisent `ownership.ts`
2. **L'incohérence** — `connected-accounts` retourne **403** (information disclosure) au lieu de **404**
3. **L'inutilisation** — `ownership.ts` existe mais n'est jamais appelé
4. **`recordPublish` jamais appelé** depuis la route API directe (`POST /api/content/[id]/publish`) → les caps Redis ne sont jamais incrémentés lors d'une publication manuelle

### Analyse des routes existantes

| Route | Ownership | Problème |
|-------|-----------|----------|
| `GET/PATCH/DELETE /api/content/[id]` | ✅ Via `getContentOr404` privé | Duplication |
| `GET/PATCH/DELETE /api/agents/[id]` | ✅ Via `getAgentOr404` privé | Duplication |
| `GET/PATCH/DELETE /api/profiles/[id]` | ✅ Via `getProfileOr404` privé | Duplication |
| `GET/DELETE /api/connected-accounts/[id]` | ✅ Inline check | **Retourne 403 au lieu de 404** ⚠️ |
| `DELETE /api/media/[id]` | ✅ Inline check | OK |
| `DELETE /api/api-keys/[id]` | ✅ Inline check | OK |
| `GET/DELETE /api/video/[id]` | ✅ Inline check (2 requêtes) | Sous-optimal mais correct |
| `DELETE /api/teams/[teamId]` | ✅ Via `canDeleteTeam()` | OK |
| `POST /api/content/[id]/publish` | ✅ Inline check | **Manque `recordPublish` après succès** 🔴 |
| `POST /api/content/[id]/approve` | ✅ Via `getContentOr404` privé | Duplication |
| `POST /api/content/[id]/reject` | ✅ Via `getContentOr404` privé | Duplication |
| `PUT/DELETE /api/content/[id]/schedule` | ✅ Via `getContentOr404` privé | Duplication |

### Modifications

**1. Audit des routes manquantes** : Vérifier les fichiers suivants — s'ils n'utilisent PAS `ownership.ts`, les migrer :

- `socialcreator-web/src/app/api/connected-accounts/[id]/route.ts`
- `socialcreator-web/src/app/api/connected-accounts/callback/route.ts`
- `socialcreator-web/src/app/api/video/[id]/route.ts`
- `socialcreator-web/src/app/api/media/[id]/route.ts`
- `socialcreator-web/src/app/api/api-keys/[id]/route.ts`
- `socialcreator-web/src/app/api/teams/[teamId]/route.ts`

Pour chaque route, remplacer :

```tsx
// AVANT (sans ownership) :
const item = await prisma.generatedContent.findUnique({ where: { id } });
if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

// APRÈS (avec ownership) :
const result = await verifyContentOwnership(userId, id);
if (!result.valid) return result.error;
const item = result.data;
```

**2. Standardiser le helper** : Remplacer les helpers privés `getContentOr404`, `getAgentOr404`, `getProfileOr404` par les fonctions de `ownership.ts` pour éliminer la duplication.

Dans `content/[id]/route.ts` :

```tsx
// Supprimer la fonction privée getContentOr404
// Importer ownership à la place :
import { verifyContentOwnership } from "@/lib/ownership";

// Dans GET/PATCH/DELETE, remplacer :
const content = await getContentOr404(id, session.user.id);
if (!content) { ... }
// Par :
const result = await verifyContentOwnership(session.user.id, id);
if (!result.valid) return result.error;
const content = result.data;
```

**3. Audit supplémentaire** : Vérifier tous les handlers dans `socialcreator-web/src/app/api/` qui prennent un `id` en paramètre et retournent des données utilisateur. Utiliser la commande :

```bash
rg "params.*id" --include="*.ts" socialcreator-web/src/app/api/
```

### Vérification
1. `pnpm test:run` — aucun test existant ne doit casser
2. Tester manuellement avec deux comptes : créer une ressource avec compte A, tenter d'y accéder avec compte B → 404
3. Vérifier que les réponses 404 ne divulguent pas l'existence de la ressource (`"Not found"` ou `"Access denied"` — pas de différence)

---

## S1.3 — Ajouter Content-Security-Policy header

**Fichiers** : `socialcreator-web/next.config.mjs`
**Effort** : XS
**Dépendances** : aucune
**Test** : `curl -I http://localhost:3000 | grep -i content-security-policy`

### Contexte
Les security headers actuels incluent HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Mais **Content-Security-Policy** est absent, ce qui expose à des risques XSS (bien que React atténue).

### Modifications

**1. Modifier** : `socialcreator-web/next.config.mjs`

Dans la fonction `headers()`, ajouter l'en-tête CSP **conditionnel selon l'environnement** :

⚠️ `'unsafe-eval'` est nécessaire pour Next.js en développement (HMR) mais affaiblit la sécurité en production.

```tsx
async headers() {
  const isDev = process.env.NODE_ENV === "development";

  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // NOUVEAU : Content-Security-Policy (conditionnel)
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // 'unsafe-eval' uniquement en développement (nécessaire pour HMR)
            `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'unsafe-inline'`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: uploadthing.com googleusercontent.com images.unsplash.com avatars.githubusercontent.com image.mux.com",
            "media-src 'self' data: blob: stream.mux.com",
            "font-src 'self' data:",
            "connect-src 'self' https://api.anthropic.com https://api.stripe.com https://api.deepgram.com https://api.uploadthing.com https://api.mux.com https://*.upstash.io wss://*.trigger.dev",
            "frame-src 'self' https://js.stripe.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ];
}
```

### Vérification
1. `curl -I http://localhost:3000 | findstr "content-security-policy"` doit retourner le header
2. `pnpm dev` — vérifier que toutes les fonctionnalités marchent (Stripe, Uploadthing, Claude, etc.)
3. Ouvrir les DevTools → Network → headers de la réponse → vérifier CSP présent

---

## S1.4 — Supprimer la redondance UserRole

**Fichiers** : `socialcreator-web/prisma/schema.prisma`, `socialcreator-web/prisma/migrations/` (nouvelle migration), `socialcreator-web/src/lib/auth.ts`, `socialcreator-web/src/app/api/auth/register/route.ts`, `socialcreator-web/src/app/api/admin/users/route.ts`, `prisma/seed.ts`
**Effort** : M (pas S — scope réel sous-estimé, voir fichiers ci-dessus)
**Dépendances** : aucune
**Test** : `pnpm db:generate` puis `pnpm test:run` puis `pnpm typecheck`

### Contexte
Le modèle `UserRole` (table séparée) et le champ `User.role` (`USER | ADMIN`) coexistent. C'est redondant et source de confusion. Le champ `User.role` est suffisant pour le système actuel (simple rôles USER/ADMIN).

### Modifications

**1. Modifier** : `socialcreator-web/prisma/schema.prisma`

```prisma
// AVANT :
model UserRole {
  id     String @id @default(cuid())
  userId String
  role   Role
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role])
  @@index([userId])
}

// APRÈS : Supprimer tout le modèle UserRole

// Supprimer aussi les références à UserRole dans le modèle User :
model User {
  // ... autres champs ...
  // userRoles    UserRole[]    ← SUPPRIMER CETTE LIGNE
  role        Role         @default(USER)  // ← GARDER (c'est le seul système de rôle)
}
```

**2. Générer la migration** :

```bash
cd socialcreator-web
pnpm db:generate
npx prisma migrate dev --name remove-userrole-table
```

**3. Vérifier** que le code existant n'utilise plus `userRoles`. Chercher toutes les références :

```bash
rg "userRoles" --type ts
rg "UserRole" --type ts
rg "user\.role" --type ts
```

S'il y a des références à `userRoles` (probablement dans les composants d'admin ou les vérifications de permissions), les remplacer par `user.role`.

**4. Modifier** `src/lib/auth.ts` (callback JWT) :

```tsx
// AVANT (ligne ~81) :
const dbUser = await prisma.user.findUnique({
  where: { id: token.sub },
  include: { userRoles: true },
});
if (dbUser) {
  token.role = dbUser.role;
  token.roles = dbUser.userRoles.map((ur) => ur.role);
}

// APRÈS :
const dbUser = await prisma.user.findUnique({
  where: { id: token.sub },
  select: { role: true },
});
if (dbUser) {
  token.role = dbUser.role;
  token.roles = [dbUser.role];
}
```

**5. Modifier** `src/app/api/auth/register/route.ts` :

```tsx
// AVANT (ligne ~49) :
userRoles: {
  create: [{ role: "USER" }],
},

// APRÈS : supprimer — User.role default=USER dans le schéma
```

**6. Modifier** `src/app/api/admin/users/route.ts` :

Remplacer tous les `userRoles: { select: { role: true } }` par `role: true`.
Supprimer `userRoles: { create: [{ role }] }` dans le create.

**7. Modifier** `prisma/seed.ts` :

```tsx
// AVANT :
userRoles: {
  create: [{ role: "ADMIN" }, { role: "USER" }],
},

// APRÈS : supprimer — role suffit
```

**8. Vérifier** qu'aucun autre fichier ne référence `userRoles` :

```bash
rg "userRoles" --type ts src/ prisma/
```

### Vérification
1. `pnpm db:generate` — doit réussir sans erreur
2. `pnpm typecheck` — pas d'erreur de type
3. `pnpm test:run` — tous les tests passent
4. Vérifier qu'aucun import `UserRole` ne reste dans le code

---

## S1.5 — Vérifier `maxPerDay` côté serveur

**Fichiers** : `socialcreator-web/src/lib/publish-guard.ts`, `socialcreator-web/src/lib/quota-guard.ts`, `socialcreator-web/src/app/api/agents/[id]/run/route.ts` (si existe)
**Effort** : S
**Dépendances** : aucune
**Test** : `pnpm test:run` — tests existants + ajouter test pour `canPublish`

### Contexte
`publish-guard.ts` a déjà la fonction `canPublish()` qui vérifie le cap via Redis/DB. Mais `quota-guard.ts` est marqué `@deprecated` avec une note disant "Use FeatureGateService instead." Le code n'est pas clair : quel module est effectivement utilisé ?

### Modifications

**1. Audit des appels** : Chercher où `canPublish`, `checkProfileQuota`, `peekDailyCap` sont appelés :

```bash
rg "canPublish|checkProfileQuota|peekDailyCap|incrementDailyCap" --type ts
```

**2. Ajouter un appel serveur à `canPublish`** dans les routes de publication :

Identifier la route qui publie (probablement `POST /api/content/[id]/publish`) et s'assurer que `canPublish` est appelé :

```tsx
// Dans publish-worker.trigger.ts ou la route API de publication :

import { canPublish } from "@/lib/publish-guard";

// Avant de publier :
const check = await canPublish(profileId, platform, orgId);
if (!check.canPublish) {
  throw new Error(check.reason || "Cannot publish");
}

// Puis après publication réussie :
import { recordPublish } from "@/lib/publish-guard";
await recordPublish(profileId, platform);
```

**3. Nettoyer `quota-guard.ts`** : Supprimer les fonctions deprecated si elles ne sont plus utilisées (après l'audit).

**4. 🔴 Ajouter `recordPublish` dans la route de publication directe** :

Dans `socialcreator-web/src/app/api/content/[id]/publish/route.ts`, après publication réussie :

```tsx
import { canPublish, recordPublish } from "@/lib/publish-guard";

// Après la mise à jour du statut (PUBLISHED), ajouter :
await recordPublish(content.profileId, content.platform);
```

⚠️ **Bug critique** : Cette ligne est présente dans les workers Trigger.dev (`publish-worker.trigger.ts`, `scheduled-content.trigger.ts`) mais **ABSENTE de la route API directe**. Sans elle, le compteur Redis n'est jamais incrémenté lors d'une publication manuelle via l'interface — les caps quotidiens sont contournables.

### Vérification
1. `rg "quota-guard" --type ts` — ne doit plus rien retourner (sauf le fichier lui-même)
2. `pnpm test:run` — OK
3. Test manuel : créer un agent avec `maxPerDay: 1`, générer du contenu, approuver, publier → doit échouer après 1 publication

---

# ⚡ SPRINT 2 — Stabilisation (semaine 3-6)

---

## S2.1 — Ajouter retry/backoff sur les appels externes

**Fichiers** : `socialcreator-web/src/lib/llm.ts` (nouveaux : `socialcreator-web/src/lib/retry.ts`)
**Effort** : M
**Dépendances** : S1.5
**Test** : `pnpm test:run` — test unitaire pour la fonction retry

### Contexte
Aucun retry avec backoff détecté sur les appels externes (Anthropic Claude, Stripe, Mux, Deepgram). Si Claude rate (rate limit, timeout), l'agent run échoue immédiatement.

### Modifications

**1. Nouveau fichier** : `socialcreator-web/src/lib/retry.ts`

```tsx
/**
 * Retry with exponential backoff + jitter
 * Usage: await withRetry(() => claude.messages.create({...}))
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryOn?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
  retryOn: (error: Error) => {
    // Retry on rate limits (429) and server errors (5xx)
    const status = (error as any).status || (error as any).statusCode;
    if (status === 429 || (status >= 500 && status < 600)) return true;
    if (error.message?.includes("timeout") || error.message?.includes("rate limit")) return true;
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) break;
      if (!opts.retryOn(lastError)) throw lastError;

      // Exponential backoff with jitter
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );
      const jitter = opts.jitter ? delay * 0.1 * Math.random() : 0;

      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
```

**2. Modifier** : `socialcreator-web/src/lib/llm.ts` — Ajouter retry sur `generateContent` :

```tsx
import { Anthropic } from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const claude = new Anthropic();

export async function generateContent(systemPrompt: string, userPrompt: string): Promise<GenerationResult> {
  const msg = await withRetry(
    () =>
      claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    {
      maxAttempts: 3,
      baseDelayMs: 2000, // Claude rate limits can be long
      retryOn: (error) => {
        const status = (error as any).status;
        // Retry on 429 (rate limit), 5xx (server error), not on 400 (bad request)
        return status === 429 || (status >= 500 && status < 600);
      },
    },
  );

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  // ... reste du parsing inchangé
}
```

**3. Test unitaire** : `socialcreator-web/src/lib/__tests__/retry.test.ts`

```tsx
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../retry";

describe("withRetry", () => {
  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce("success");

    const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 })).rejects.toThrow(
      "always fails",
    );
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Bad Request"));

    const retryOn = () => false;
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, retryOn })).rejects.toThrow(
      "Bad Request",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

### Vérification
1. `pnpm test:run` — les tests retry passent
2. Simuler un rate limit Claude (via mock) → la fonction retry doit être visible dans les logs

---

## S2.2 — Ajouter correlation ID (requestId tracing)

**Fichiers** : `socialcreator-web/src/lib/api-middleware.ts`, `socialcreator-web/src/lib/logger.ts` (nouveau : `socialcreator-web/src/lib/request-id.ts`)
**Effort** : M
**Dépendances** : aucune
**Test** : Vérifier que chaque log contient un `requestId`

### Contexte
Les logs sont standalone — pas de `requestId`/`traceId` pour corréler une requête complète à travers les différents services.

### Modifications

**1. Nouveau fichier** : `socialcreator-web/src/lib/request-id.ts`

```tsx
import { randomUUID } from "node:crypto";

/**
 * Request ID utilities for distributed tracing
 *
 * Generates a unique request ID and provides header names
 * for propagating across services.
 */

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Generate a unique request ID (UUID v4)
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Extract request ID from headers or generate new one
 */
export function getOrCreateRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing) return existing;
  return generateRequestId();
}
```

**2. Modifier** : `socialcreator-web/src/lib/api-middleware.ts`

```tsx
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export function withApiMiddleware(handler: ApiHandler) {
  return async (
    request: NextRequest,
    { params }: { params?: Promise<Record<string, string>> } = {},
  ) => {
    const start = Date.now();
    const resolvedParams = params ? await params : {};

    // Generate or propagate request ID
    const requestId = getOrCreateRequestId(request);

    // ... rate limit, auth ...

    try {
      const response = await handler({ userId: session.user.id, request }, resolvedParams);

      // Add request ID to response headers
      const responseWithId = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      responseWithId.headers.set(REQUEST_ID_HEADER, requestId);

      logger.info(
        {
          requestId,
          method: request.method,
          path: request.nextUrl.pathname,
          duration: Date.now() - start,
          status: response.status,
        },
        "API request completed",
      );

      return responseWithId;
    } catch (error) {
      logger.error(
        {
          requestId,
          err: error,
          method: request.method,
          path: request.nextUrl.pathname,
          duration: Date.now() - start,
        },
        "API request failed",
      );
      return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
    }
  };
}
```

**3. Propagation** : Dans les services qui appellent d'autres services (ex: `agent-runner` → `llm.ts`), passer le `requestId` via un contexte. Utiliser un simple `AsyncLocalStorage` si nécessaire.

### Vérification
1. Lancer une requête API, vérifier que la réponse inclut le header `x-request-id`
2. Vérifier que les logs Pino incluent `requestId` dans la structure JSON
3. Vérifier que le `requestId` est cohérent entre plusieurs logs d'une même requête

---

## S2.3 — Implémentation des tests d'intégration

**Fichiers** : `socialcreator-web/src/lib/__tests__/api-content.test.ts`, `socialcreator-web/src/lib/__tests__/stripe-webhook.test.ts`, `socialcreator-web/src/lib/__tests__/agent-runner.test.ts`
**Effort** : L
**Dépendances** : S1.2, S1.4
**Test** : `pnpm test:run`

### Contexte
Il y a ~23 tests unitaires mais aucun test d'intégration (API + DB). Les tests existants couvrent les utilitaires (crypto, logger, validations) mais pas les routes API ni les flows métier.

### Modifications

**1. Configurer une base de test** : Dans `vitest.setup.ts`, ajouter un setup pour utiliser une base PostgreSQL de test (ou utiliser un in-memory SQLite avec Prisma). Recommandation : utiliser la même base PostgreSQL mais avec un suffixe `_test`.

```tsx
// socialcreator-web/vitest.setup.ts
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll } from "vitest";

const testDbUrl = process.env.DATABASE_URL?.replace(
  /\/[^/]+$/,
  "/socialcreator_test",
);

if (!testDbUrl) {
  throw new Error("DATABASE_URL must be set for integration tests");
}

process.env.DATABASE_URL = testDbUrl;

const prisma = new PrismaClient();

beforeAll(async () => {
  // Push schema to test database
  const { execSync } = await import("node:child_process");
  execSync("npx prisma db push --force-reset", {
    env: { ...process.env, DATABASE_URL: testDbUrl },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**2. Test d'intégration** : `socialcreator-web/src/lib/__tests__/api-content.integration.test.ts`

```tsx
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashString } from "@/lib/crypto";

describe("Content API Integration", () => {
  let userId: string;
  let profileId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: "Test User",
        cguAccepted: true,
        role: "USER",
      },
    });
    userId = user.id;

    // Create test profile
    const profile = await prisma.profile.create({
      data: {
        userId,
        name: "Test Profile",
        brandVoice: "Professional",
      },
    });
    profileId = profile.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.generatedContent.deleteMany({ where: { profileId } });
    await prisma.profile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("creates and retrieves content for a profile", async () => {
    const content = await prisma.generatedContent.create({
      data: {
        profileId,
        platform: "X",
        textContent: "Test post",
        hashtags: ["test"],
        status: "DRAFT",
      },
    });

    expect(content.id).toBeDefined();
    expect(content.textContent).toBe("Test post");

    const retrieved = await prisma.generatedContent.findFirst({
      where: { id: content.id, profile: { userId } },
    });
    expect(retrieved).not.toBeNull();
    expect(retrieved!.textContent).toBe("Test post");
  });

  it("does not allow access to content from another user", async () => {
    // Create another user
    const otherUser = await prisma.user.create({
      data: {
        email: `other-${Date.now()}@example.com`,
        name: "Other User",
        cguAccepted: true,
      },
    });

    const otherProfile = await prisma.profile.create({
      data: {
        userId: otherUser.id,
        name: "Other Profile",
        brandVoice: "Other",
      },
    });

    const content = await prisma.generatedContent.create({
      data: {
        profileId,
        platform: "X",
        textContent: "Should be hidden from other user",
        hashtags: [],
        status: "DRAFT",
      },
    });

    // Try to access content.id from other user's perspective
    const notFound = await prisma.generatedContent.findFirst({
      where: { id: content.id, profile: { userId: otherUser.id } },
    });
    expect(notFound).toBeNull();

    // Cleanup other user's data
    await prisma.profile.delete({ where: { id: otherProfile.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});
```

### Vérification
1. `pnpm test:run` — les nouveaux tests passent avec la base de test
2. `pnpm test:coverage` — la couverture augmente d'au moins 10%

---

## S2.4 — États vides et de chargement

**Fichiers** : `socialcreator-web/src/app/(main)/agents/page.tsx`, `socialcreator-web/src/app/(main)/profiles/page.tsx`, `socialcreator-web/src/components/agent/empty-state.tsx` (nouveau), `socialcreator-web/src/components/content/empty-state.tsx` (nouveau)
**Effort** : M
**Dépendances** : S1.1
**Test** : Visuel — naviguer vers chaque page sans données

### Contexte
Plusieurs pages n'ont pas d'état vide (empty state) quand l'utilisateur n'a pas encore créé de données. La page agents et profiles sont particulièrement concernées.

### Modifications

**1. Créer un composant EmptyState réutilisable** (si `@socialcreator/ui/empty-state` n'existe pas déjà) :

Vérifier :

```bash
ls packages/socialcreator-ui/src/empty-state.tsx
```

Si le composant existe, l'utiliser. Sinon, en créer un dans le package UI :

```tsx
// packages/socialcreator-ui/src/empty-state.tsx
import { cn } from "@socialcreator/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-12 px-4", className)}>
      {icon && <div className="mx-auto mb-4 w-12 h-12 text-muted">{icon}</div>}
      <h3 className="text-title-sm text-ink font-medium mb-1">{title}</h3>
      {description && <p className="text-body-md text-muted max-w-sm mx-auto mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
```

**2. Modifier** la page agents :

```tsx
// socialcreator-web/src/app/(main)/agents/page.tsx
import { EmptyState } from "@socialcreator/ui/empty-state";
import { Bot } from "lucide-react";
import Link from "next/link";

export default async function AgentsPage() {
  // ... fetch agents ...

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={<Bot className="w-12 h-12" />}
        title="No agents yet"
        description="Create your first AI agent to start generating social media content automatically."
        action={
          <Link
            href="/agents/new"
            className="inline-flex items-center px-4 py-2 bg-primary text-on-primary rounded-lg"
          >
            Create your first agent
          </Link>
        }
      />
    );
  }

  // ... rest of page ...
}
```

**3. Modifier** les pages manquantes de `loading.tsx` :

Les pages suivantes n'ont pas de `loading.tsx` :
- `settings/page.tsx` → créer `socialcreator-web/src/app/(main)/settings/loading.tsx`
- `pricing/page.tsx` → créer `socialcreator-web/src/app/(main)/pricing/loading.tsx`

### Vérification
1. Naviguer vers `/agents` sans avoir créé d'agent → voir l'empty state avec CTA
2. Naviguer vers `/settings` → voir le skeleton loading
3. `pnpm test:run` — OK

---

## S2.5 — Restructurer `src/lib/` en sous-dossiers

**Fichiers** : Tous les fichiers dans `socialcreator-web/src/lib/` (déplacement)
**Effort** : M (en 2 phases : S2.5a avant S2.1/S2.2, S2.5b après)
**Dépendances** : S1.2 (routes API sécurisées)
**⚠️ Ordre modifié** : S2.5a AVANT S2.1 et S2.2, S2.5b APRÈS
**Test** : `pnpm typecheck` — zéro erreur d'import | `pnpm test:run` — tous les tests passent

### Contexte
`lib/` est un dossier plat avec 38 entrées mélangeant services métier, infrastructure, utilitaires et tests. Le module `entitlements/` est un bon exemple de structuration qu'il faut généraliser.

### ⚠️ Ordre d'exécution modifié

Le plan original mettait S2.5 APRÈS S2.1 et S2.2 (création de `retry.ts`, `request-id.ts`).
Cela force à créer ces fichiers dans `lib/` plat puis à les déplacer — travail redondant.

**Nouvel ordre recommandé :**

**Phase 1 — S2.5a (AVANT S2.1 et S2.2) :**
1. Créer les nouveaux dossiers (`services/`, `infrastructure/`, `middleware/`, `utils/`, `repositories/`)
2. Déplacer les fichiers stables (ceux que S1.x n'a pas modifiés) :
   - `crypto.ts` → `utils/crypto.ts`
   - `logger.ts` → `utils/logger.ts`
   - `prisma.ts` → `infrastructure/prisma.ts`
   - `utils.ts` → `utils/utils.ts`
   - `sanitize.ts` → `utils/sanitize.ts`
   - `validations.ts` → `utils/validations.ts`
   - `metrics.ts` → `utils/metrics.ts`
   - `api-errors.ts` → `middleware/api-errors.ts`
   - `api-middleware.ts` → `middleware/api-middleware.ts`
   - `ownership.ts` → `middleware/ownership.ts`
3. Ne PAS déplacer les fichiers que S1.x modifie (agent-runner, publish-guard, quota-guard, llm, etc.)

**Phase intermédiaire — S2.1 et S2.2 :**
- Créer `retry.ts` directement dans `src/lib/utils/retry.ts`
- Créer `request-id.ts` directement dans `src/lib/middleware/request-id.ts`

**Phase 2 — S2.5b (APRÈS S2.1 et S2.2) :**
- Déplacer les fichiers restants (services, infrastructure)
- Mettre à jour tous les imports
- Exécuter `pnpm typecheck` et corriger

### Modifications

**Nouvelle structure** :

```
src/lib/
├── services/           # Business logic
│   ├── agent-runner.ts
│   ├── publish-guard.ts
│   ├── quota-guard.ts
│   ├── cgu-guard.ts
│   └── team-permissions.ts
├── infrastructure/     # External services
│   ├── llm.ts
│   ├── prisma.ts
│   ├── redis/
│   │   ├── client.ts
│   │   ├── rate-limit.ts
│   │   └── index.ts
│   ├── stripe.ts
│   ├── mux.ts
│   ├── deepgram.ts
│   ├── trigger-client.ts
│   └── uploadthing/
├── repositories/       # Data access (pour le futur pattern repo)
│   └── ...
├── middleware/          # API middleware composable
│   ├── api-middleware.ts
│   ├── api-errors.ts
│   └── request-id.ts
├── publishers/         # Platform publishers (inchangé)
├── entitlements/       # Feature flags (déjà bien structuré)
├── oauth/              # OAuth flows (inchangé)
├── analytics/          # Analytics (inchangé)
├── scheduling/         # Scheduling (inchangé)
├── auth/               # Auth utilities (inchangé)
├── utils/              # Pure utilities
│   ├── crypto.ts
│   ├── logger.ts
│   ├── metrics.ts
│   ├── utils.ts
│   ├── sanitize.ts
│   ├── validations.ts
│   └── retry.ts
└── __tests__/          # Tests (inchangé)
```

**Processus de migration** (étape par étape) :

1. Créer les nouveaux dossiers
2. Déplacer les fichiers un par un
3. Mettre à jour les imports dans TOUS les fichiers qui référencent les chemins déplacés
4. Utiliser Biome pour formater : `pnpm format`
5. Exécuter `pnpm typecheck` pour s'assurer qu'aucun import n'est cassé

**Script de vérification** :

```bash
cd socialcreator-web && pnpm typecheck
```

### Astuce d'exécution
Pour éviter de casser 38 imports d'un coup, utiliser une approche par phase :

1. Phase 1 : Créer les dossiers, déplacer 5 fichiers (les plus autonomes : `retry.ts`, `request-id.ts` nouveaux, `crypto.ts`)
2. Phase 2 : Déplacer les services (`agent-runner.ts`, `publish-guard.ts`, etc.)
3. Phase 3 : Mettre à jour tous les barrel exports
4. Phase 4 : `pnpm typecheck` — corriger les imports cassés

Les imports deviennent :

```tsx
// AVANT :
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// APRÈS :
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/infrastructure/prisma";
// OU si on préfère garder les chemins courts :
import { prisma } from "@/lib/prisma";  // On peut garder un barrel export
```

### Vérification
1. `pnpm typecheck` — 0 erreurs
2. `pnpm test:run` — tous les tests passent
3. `pnpm dev` — l'application démarre sans erreur d'import

---

# 🚀 SPRINT 3 — Amélioration (mois 2-3)

---

## S3.1 — Refactor `triggerAgentRun` en services atomiques

**Fichiers** : `socialcreator-web/src/lib/agent-runner.ts`, `socialcreator-web/src/lib/services/agent-runner.ts` (nouveau)
**Effort** : M
**Dépendances** : S2.5
**Test** : `pnpm test:run` + `pnpm typecheck`

### Contexte
`triggerAgentRun()` fait 6 choses dans une seule fonction de 112 lignes. Le split recommandé est : `validateAgentRun` → `executeAgentRun` → `saveGeneratedContent`.

### Modifications

**1. Nouveaux fichiers** dans `src/lib/services/agent/` :

```tsx
// src/lib/services/agent/validate.ts
export async function validateAgentRun(agentId: string, runId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { profile: { include: { user: { select: { cguAccepted: true } } } } },
  });
  if (!agent) throw new Error("Agent not found");
  if (!agent.profile.user.cguAccepted) {
    await markRunFailed(runId, "CGU acceptance required");
    return null; // soft fail, not an exception
  }
  return agent;
}

// src/lib/services/agent/execute.ts
export async function executeAgentRun(agent: Agent, brief: string) {
  const systemPrompt = buildSystemPrompt({ ... });
  const results = await Promise.all(
    agent.platforms.map(async (platform) => {
      const prompt = buildGenerationPrompt({ brief, platform });
      const content = await generateContent(systemPrompt, prompt);
      return { platform, content };
    }),
  );
  return results;
}

// src/lib/services/agent/persist.ts
export async function saveGeneratedContent(runId: string, profileId: string, results: Array<...>) {
  await prisma.$transaction(results.map((r) =>
    prisma.generatedContent.create({ data: { runId, profileId, ... } })
  ));
}

// src/lib/services/agent/index.ts (orchestrator)
export async function triggerAgentRun(params: { agentId: string; runId: string }) {
  const agent = await validateAgentRun(params.agentId, params.runId);
  if (!agent) return; // soft fail (CGU)
  await markRunRunning(params.runId);
  const results = await executeAgentRun(agent, brief);
  await saveGeneratedContent(params.runId, agent.profileId, results);
  await markRunSuccess(params.runId);
}
```

### Vérification
1. `pnpm typecheck` — OK
2. `pnpm test:run` — les tests existants passent
3. Vérifier que le flux Trigger.dev continue de fonctionner

---

## S3.2 — Extraire les repository interfaces (Prisma)

**Fichiers** : `socialcreator-web/src/lib/repositories/*.ts` (nouveaux fichiers)
**Effort** : L
**Dépendances** : S2.5, S3.1
**Test** : `pnpm test:run` + `pnpm typecheck`

### Contexte
Prisma est appelé directement partout. Pour permettre le test unitaire des services métier sans base de données, il faut extraire des interfaces repository.

### Modifications

**1. Interface Repository** :

```tsx
// src/lib/repositories/interfaces.ts
export interface IContentRepository {
  findById(id: string): Promise<GeneratedContent | null>;
  findByIdAndUser(id: string, userId: string): Promise<GeneratedContent | null>;
  create(data: CreateContentInput): Promise<GeneratedContent>;
  update(id: string, data: UpdateContentInput): Promise<GeneratedContent>;
  delete(id: string): Promise<void>;
  findFiltered(filters: ContentFilters): Promise<{ items: GeneratedContent[]; total: number }>;
}
```

**2. Implémentation Prisma** :

```tsx
// src/lib/repositories/prisma/content-repository.ts
import { prisma } from "@/lib/infrastructure/prisma";
import type { IContentRepository } from "../interfaces";

export class PrismaContentRepository implements IContentRepository {
  async findById(id: string) {
    return prisma.generatedContent.findUnique({ where: { id } });
  }

  async findByIdAndUser(id: string, userId: string) {
    return prisma.generatedContent.findFirst({
      where: { id, profile: { userId } },
    });
  }
  // ... autres méthodes
}
```

**3. Injection** : Créer un conteneur simple (ou utiliser les modules) :

```tsx
// src/lib/repositories/index.ts
import { PrismaContentRepository } from "./prisma/content-repository";

// Pour l'instant, implémentation Prisma directe
// Plus tard, remplacer par injection de dépendances
export const contentRepository = new PrismaContentRepository();
```

### Vérification
1. `pnpm typecheck` — OK
2. `pnpm test:run` — OK
3. Les tests existants utilisent toujours Prisma directement (inchangé)

---

## S3.3 — Métriques business

**Fichiers** : `socialcreator-web/src/lib/metrics.ts`, `socialcreator-web/src/lib/services/agent/persist.ts`, `socialcreator-web/src/lib/publishers/*.ts`
**Effort** : S
**Dépendances** : S3.1
**Test** : `curl http://localhost:3000/api/metrics` — vérifier que les nouvelles métriques apparaissent

### Contexte
Le compteur `contentGenerated` existe dans `metrics.ts` mais n'est jamais incrémenté dans le code.

### Modifications

**1. Incrémenter les métriques** dans les services appropriés :

```tsx
// Dans persist.ts (après création réussie de GeneratedContent) :
import { contentGenerated } from "@/lib/metrics";

results.forEach(({ platform }) => {
  contentGenerated.inc({ platform: platform.toLowerCase(), type: "agent" });
});

// Dans publishers/facebook.ts (après publication réussie) :
contentGenerated.inc({ platform: "facebook", type: "publish" });
// Même pattern pour tous les publishers (instagram.ts, linkedin.ts, etc.)
```

**2. Ajouter métrique de durée d'exécution** :

```tsx
// Dans metrics.ts :
export const agentRunDuration = new Histogram({
  name: "agent_run_duration_seconds",
  help: "Duration of agent runs in seconds",
  labelNames: ["status"] as const,
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register],
});
```

### Vérification
1. Exécuter un agent → `curl http://localhost:3000/api/metrics` doit montrer `content_generated_total`
2. `agent_run_duration_seconds` doit apparaître après un run

---

## S3.4 — Accessibilité : contraste, skip link, aria-labels

**Fichiers** : `socialcreator-web/src/app/globals.css`, `socialcreator-web/src/app/layout.tsx`, `socialcreator-web/src/app/(main)/layout.tsx`, `socialcreator-web/src/components/layout/sidebar.tsx`
**Effort** : M
**Dépendances** : S1.1
**Test** : Lighthouse Accessibility audit ≥ 90

### Contexte
Audit WCAG 2.1 AA a révélé : contraste insuffisant sur `--color-muted` (3.5:1), pas de skip link, pas de focus visible personnalisé, icônes sans aria-label.

### Modifications

**1. Corriger le contraste** dans `globals.css` :

```css
/* AVANT : Problème WCAG 1.4.3 (ratio ~3.5:1) */
--color-muted: #777169;

/* APRÈS : Minimum 4.5:1 sur fond #f5f5f5 */
--color-muted: #6b6559;        /* Plus foncé, ratio ~4.6:1 */
/* ALTERNATIVE : si on veut garder la teinte claire */
--color-muted: #8a8477;        /* Si fond plus foncé */
```

**2. Ajouter skip link** dans `globals.css` :

```css
/* Skip link - accessible uniquement au focus clavier */
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  z-index: 9999;
  padding: 8px 16px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 14px;
  text-decoration: none;
  border-radius: 0 0 4px 0;
}

.skip-link:focus {
  top: 0;
}
```

**3. Ajouter skip link** dans `layout.tsx` :

```tsx
// Dans le RootLayout, juste après <body> :
<body className={`antialiased ...`}>
  <a href="#main-content" className="skip-link">
    Skip to main content
  </a>
  <ToastLayoutWrapper>{children}</ToastLayoutWrapper>
</body>
```

**4. Ajouter `id="main-content"`** dans `(main)/layout.tsx` :

```tsx
<main className="lg:pl-[256px]" id="main-content">
```

**5. Ajouter aria-labels** dans `sidebar.tsx` :

```tsx
// Pour les icônes de navigation :
<item.icon className="w-5 h-5" aria-hidden="true" />
// Les liens ont déjà le texte visible — aria-hidden suffit

// Pour le bouton Sign out :
<button
  onClick={() => signOut({ callbackUrl: "/" })}
  aria-label="Sign out of your account"
  // ...
>
```

**6. Style de focus visible** dans `globals.css` :

```css
/* Custom focus ring accessible */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Suppression du focus ring pour les clicks souris uniquement */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Vérification
1. Exécuter Lighthouse dans Chrome DevTools → Accessibilité ≥ 90
2. Tester navigation au clavier (Tab) → le skip link doit apparaître au premier Tab
3. `Tab` à travers la sidebar → focus visible doit être clairement identifiable
4. `axe DevTools` ou `pa11y` — zéro erreur WCAG 2.1 AA

---

## S3.5 — Tests unitaires pour les 9 publishers

**Fichiers** : `socialcreator-web/src/lib/__tests__/publishers/*.test.ts` (nouveaux fichiers)
**Effort** : M
**Dépendances** : S1.5
**Test** : `pnpm test:run`

### Contexte
9 publishers (TikTok, Instagram, YouTube, Facebook, X, LinkedIn, Threads, Pinterest) qui sont des adaptateurs pour les API des plateformes sociales. Aucun test unitaire actuellement.

### Modifications

**Template de test générique** pour chaque publisher :

```tsx
// socialcreator-web/src/lib/__tests__/publishers/facebook.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishToFacebook } from "@/lib/publishers/facebook";

// Mock fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Facebook Publisher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a text post successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "fb_post_123" }),
    });

    const result = await publishToFacebook({
      accessToken: "token123",
      textContent: "Hello from SocialCreator!",
    });

    expect(result.success).toBe(true);
    expect(result.postId).toBe("fb_post_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    const result = await publishToFacebook({
      accessToken: "bad_token",
      textContent: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid token");
  });

  it("handles network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await publishToFacebook({
      accessToken: "token123",
      textContent: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

Répéter ce template pour chaque publisher en adaptant les appels API spécifiques.

### Vérification
1. `pnpm test:run` — les 9 nouveaux tests passent
2. La couverture des publishers atteint au moins 80%

---

# 📋 RÉCAPITULATIF DES FICHIERS MODIFIÉS

## Sprint 1 (semaine 1-2) — ~10 fichiers

| ID | Fichier | Action |
|----|---------|--------|
| S1.1 | `src/components/layout/mobile-header.tsx` | **NOUVEAU** — Client component pour le menu mobile |
| S1.1 | `src/app/(main)/layout.tsx` | MODIFIER — Remplacer header en dur par MobileHeader |
| S1.1 | `src/components/layout/sidebar.tsx` | MODIFIER — Props isOpen/onClose déjà présentes ✅ |
| S1.2 | `src/app/api/content/[id]/route.ts` | MODIFIER — Utiliser ownership.ts au lieu de helper privé |
| S1.2 | `src/app/api/agents/[id]/route.ts` | MODIFIER — idem |
| S1.2 | `src/app/api/profiles/[id]/route.ts` | MODIFIER — idem |
| S1.2 | `src/app/api/connected-accounts/[id]/route.ts` | VÉRIFIER + MODIFIER si nécessaire |
| S1.2 | `src/app/api/video/[id]/route.ts` | VÉRIFIER + MODIFIER si nécessaire |
| S1.2 | `src/app/api/media/[id]/route.ts` | VÉRIFIER + MODIFIER si nécessaire |
| S1.2 | `src/app/api/api-keys/[id]/route.ts` | VÉRIFIER + MODIFIER si nécessaire |
| S1.2 | `src/app/api/teams/[teamId]/route.ts` | VÉRIFIER + MODIFIER si nécessaire |
| S1.3 | `next.config.mjs` | MODIFIER — Ajouter CSP header |
| S1.4 | `prisma/schema.prisma` | MODIFIER — Supprimer modèle UserRole |
| S1.5 | `src/lib/publish-guard.ts` | MODIFIER — Audit et renforcement des appels canPublish |
| S1.5 | `src/lib/quota-guard.ts` | MODIFIER — Nettoyer deprecated si non utilisé |

## Sprint 2 (semaine 3-6) — ~18 fichiers

| ID | Fichier | Action |
|----|---------|--------|
| S2.1 | `src/lib/retry.ts` | **NOUVEAU** — Fonction retry with backoff |
| S2.1 | `src/lib/llm.ts` | MODIFIER — Ajouter retry sur generateContent |
| S2.1 | `src/lib/__tests__/retry.test.ts` | **NOUVEAU** — Tests unitaires retry |
| S2.2 | `src/lib/request-id.ts` | **NOUVEAU** — Génération/propagation requestId |
| S2.2 | `src/lib/api-middleware.ts` | MODIFIER — Intégrer requestId dans les logs et réponses |
| S2.3 | `vitest.setup.ts` | MODIFIER — Configurer base de test |
| S2.3 | `src/lib/__tests__/api-content.integration.test.ts` | **NOUVEAU** — Tests d'intégration |
| S2.3 | `src/lib/__tests__/stripe-webhook.integration.test.ts` | **NOUVEAU** — Tests Stripe webhook |
| S2.3 | `src/lib/__tests__/agent-runner.integration.test.ts` | **NOUVEAU** — Tests agent runner |
| S2.4 | `packages/socialcreator-ui/src/empty-state.tsx` | **NOUVEAU** — Composant EmptyState réutilisable |
| S2.4 | `src/app/(main)/agents/page.tsx` | MODIFIER — Ajouter empty state |
| S2.4 | `src/app/(main)/profiles/page.tsx` | MODIFIER — Ajouter empty state |
| S2.4 | `src/app/(main)/settings/loading.tsx` | **NOUVEAU** — Skeleton loading |
| S2.4 | `src/app/(main)/pricing/loading.tsx` | **NOUVEAU** — Skeleton loading |
| S2.5 | `src/lib/` (restructuration) | DÉPLACER — Créer services/, infrastructure/, utils/ |

## Sprint 3 (mois 2-3) — ~20 fichiers

| ID | Fichier | Action |
|----|---------|--------|
| S3.1 | `src/lib/services/agent/validate.ts` | **NOUVEAU** — Validation agent run |
| S3.1 | `src/lib/services/agent/execute.ts` | **NOUVEAU** — Exécution LLM |
| S3.1 | `src/lib/services/agent/persist.ts` | **NOUVEAU** — Sauvegarde résultats |
| S3.1 | `src/lib/services/agent/index.ts` | **NOUVEAU** — Orchestrateur |
| S3.2 | `src/lib/repositories/interfaces.ts` | **NOUVEAU** — Interfaces repository |
| S3.2 | `src/lib/repositories/prisma/content-repository.ts` | **NOUVEAU** — Implémentation Prisma |
| S3.2 | `src/lib/repositories/prisma/agent-repository.ts` | **NOUVEAU** — Implémentation Prisma |
| S3.2 | `src/lib/repositories/index.ts` | **NOUVEAU** — Barrel exports |
| S3.3 | `src/lib/metrics.ts` | MODIFIER — Ajouter Histogram agent_run_duration |
| S3.3 | `src/lib/services/agent/persist.ts` | MODIFIER — Incrémenter contentGenerated |
| S3.3 | `src/lib/publishers/*.ts` | MODIFIER — Ajouter incrémentation métriques |
| S3.4 | `src/app/globals.css` | MODIFIER — Contraste, skip-link, focus-visible |
| S3.4 | `src/app/layout.tsx` | MODIFIER — Skip link HTML |
| S3.4 | `src/app/(main)/layout.tsx` | MODIFIER — id="main-content" |
| S3.4 | `src/components/layout/sidebar.tsx` | MODIFIER — aria-label, aria-hidden |
| S3.5 | `src/lib/__tests__/publishers/*.test.ts` | **NOUVEAU** — 9 fichiers de test |

---

# ✅ CHECKLIST DE LIVRAISON PAR SPRINT

## Sprint 1
- [ ] Menu mobile fonctionnel sur 320px
- [ ] Toutes les routes API vérifient l'ownership via `ownership.ts`
- [ ] Header CSP présent dans les réponses HTTP
- [ ] `UserRole` table supprimée, migration ok
- [ ] `pnpm typecheck` OK
- [ ] `pnpm test:run` OK
- [ ] `pnpm dev` démarre sans erreur

## Sprint 2
- [ ] Retry avec backoff sur appels Claude
- [ ] `requestId` propagé dans tous les logs API
- [ ] Tests d'intégration API + DB passent
- [ ] États vides sur agents + profils
- [ ] Loading skeletons sur settings + pricing
- [ ] `src/lib/` restructuré, `pnpm typecheck` OK

## Sprint 3
- [ ] `triggerAgentRun` splité en 3 services atomiques
- [ ] Interfaces repository extraites
- [ ] Métriques `content_generated_total` + `agent_run_duration_seconds`
- [ ] Lighthouse Accessibilité ≥ 90
- [ ] Tests unitaires pour les 9 publishers
- [ ] `pnpm test:coverage` ≥ 20% (était ~5%)
- [ ] `pnpm typecheck` OK

---

# 🔗 DÉPENDANCES ENTRE TÂCHES

```
S1.1 (menu mobile) — aucun prérequis
S1.2 (IDOR) — aucun prérequis
S1.3 (CSP) — aucun prérequis
S1.4 (UserRole) — aucun prérequis
S1.5 (maxPerDay) — aucun prérequis

S2.5a (restructuration phase 1) — S1.2
S2.1 (retry) — S1.2, S2.5a (dossier utils/ existant)
S2.2 (correlation ID) — S1.3, S2.5a (dossier middleware/ existant)
S2.4 (états vides) — S1.1
S2.5b (restructuration phase 2) — S2.1, S2.2, S2.5a
S2.3 (tests intégration) — S1.2, S1.4, S2.5b

S3.5 (tests publishers) — S1.5, S2.3
S3.1 (refactor agent-runner) — S2.5b, S2.3
S3.4 (accessibilité) — S1.1
S3.2 (repository pattern) — S3.1, S1.2
S3.3 (métriques) — S3.1
```

---

**Graphe d'exécution** :

```
Semaine 1 (Sprint 1) :
  S1.1 ─┐
  S1.2 ─┤
  S1.3 ─┤  (parallèle — indépendants)
  S1.4 ─┤
  S1.5 ─┘
              
Semaine 3 (Sprint 2a) :
  S2.5a ──────┐
  S2.1 ──┤    │
  S2.2 ──┤    │  (parallèle — S2.5a crée les dossiers)
  S2.4 ──┤    │
              
Semaine 5 (Sprint 2b) :
  S2.5b ──────────┐
  S2.3 ───────────┤
                   
Semaine 6-8 (Sprint 3) :
  S3.1 ─┐  S3.5 ─┤  S3.4 ──┐
  S3.2 ─┤  S3.3 ──┘        │
```

---

# ⚠️ EDGE CASES ET RISQUES IDENTIFIÉS (post-revue architecte)

## Non couverts par le plan initial

| # | Edge Case | Impact | Correctif |
|---|-----------|--------|-----------|
| 1 | `recordPublish` jamais appelé depuis route API directe | Les caps quotidiens sont contournables par API | Ajouter `recordPublish` après succès (S1.5) |
| 2 | connected-accounts retourne 403 au lieu de 404 | Information disclosure (existence de la ressource) | Remplacer 403 par 404 (S1.2) |
| 3 | CSP `unsafe-eval` en production | Sécurité affaiblie | Rendre conditionnel (S1.3) ✅ déjà fait |
| 4 | `agentRunner.deleteMany` redondant avec cascade | Code mort, risque si schema change | Vérifier et nettoyer (S1.2) |
| 5 | S2.3 `prisma db push --force-reset` sans garde-fou | Risque de destruction de production | Ajouter validation `_test` dans DATABASE_URL |
| 6 | S2.2 requestId limité aux routes `withApiMiddleware` | ~40% des routes sans correlation ID | Plan de migration progressive |
| 7 | S1.2 + S3.2 double modification des routes | Re-travail, risque de régression | Faire S3.2 juste après S1.2 |

## Risques additionnels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| S2.5 imports cassés sur PR | Haute | Haut | Ajouter `pnpm typecheck` dans CI après chaque phase |
| CSP trop restrictif bloque Stripe/Claude/Uploadthing | Moyenne | Haut | Tester TOUS les flux tiers avant merge |
| `typeof` UserRole manquant (type Prisma généré) | Haute | Moyen | Vérifier `pnpm typecheck` après migration |
| S2.5b conflit avec branches parallèles | Haute | Moyen | Geler les modifs dans lib/ pendant la restructuration |

---

---

# 🚀 SPRINT 4 — OAuth Onboarding Flow (semaine 1-2)

---

## S4.1 — Page de gestion des comptes connectés (UI)

**Fichiers** : `socialcreator-web/src/app/(main)/profiles/[id]/accounts/page.tsx` (NOUVEAU), `socialcreator-web/src/components/connected-accounts/account-card.tsx` (NOUVEAU), `socialcreator-web/src/components/connected-accounts/account-list.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 3 (API v1 connected-accounts, Zustand stores)
**Test** : Naviguer vers `/profiles/{id}/accounts` → liste des comptes connectés avec statuts

### Contexte
Les routes OAuth existent (`/api/connected-accounts/callback/[platform]`, `/api/connected-accounts/redirect/[platform]`) et le token exchange fonctionne. Mais il n'y a **aucune UI** pour :
1. Voir la liste des comptes connectés
2. Lancer le flux OAuth (bouton "Connect X")
3. Voir le statut (actif/expiré/erreur)
4. Déconnecter/reconnecter un compte

### Modifications

**1. Nouveau fichier** : `socialcreator-web/src/components/connected-accounts/account-card.tsx`

```tsx
"use client";

import { PLATFORM_DISPLAY, type Platform } from "@socialcreator/types";
import { Card } from "@socialcreator/ui/card";
import { Badge } from "@socialcreator/ui/badge";
import { Button } from "@socialcreator/ui/button";
import {
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  Music,
  MessageCircle,
  Pin,
  Link2,
  RefreshCw,
  Trash2,
  AlertCircle,
} from "lucide-react";

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  X: <Twitter className="w-5 h-5" />,
  INSTAGRAM: <Instagram className="w-5 h-5" />,
  YOUTUBE: <Youtube className="w-5 h-5" />,
  FACEBOOK: <Facebook className="w-5 h-5" />,
  LINKEDIN: <Linkedin className="w-5 h-5" />,
  TIKTOK: <Music className="w-5 h-5" />,
  THREADS: <MessageCircle className="w-5 h-5" />,
  PINTEREST: <Pin className="w-5 h-5" />,
};

interface AccountCardProps {
  account: {
    id: string;
    platform: string;
    accountName: string;
    accountAvatarUrl: string | null;
    isActive: boolean;
    expiresAt: string | null;
  };
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
}

export function AccountCard({ account, onDisconnect, onReconnect }: AccountCardProps) {
  const isExpired = account.expiresAt && new Date(account.expiresAt) < new Date();
  const status = !account.isActive ? "inactive" : isExpired ? "expired" : "active";

  const statusConfig = {
    active: { label: "Connected", color: "bg-green-100 text-green-800" },
    expired: { label: "Token expired", color: "bg-yellow-100 text-yellow-800" },
    inactive: { label: "Disconnected", color: "bg-red-100 text-red-800" },
  } as const;

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center">
        {account.accountAvatarUrl ? (
          <img src={account.accountAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          PLATFORM_ICONS[account.platform] || <Link2 className="w-5 h-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-ink font-medium truncate">{account.accountName}</p>
        <p className="text-caption text-muted">{PLATFORM_DISPLAY[account.platform] || account.platform}</p>
      </div>

      <Badge className={statusConfig[status].color}>{statusConfig[status].label}</Badge>

      <div className="flex items-center gap-2">
        {status === "expired" && (
          <Button variant="outline" size="sm" onClick={() => onReconnect(account.id)}>
            <RefreshCw className="w-4 h-4" />
            Reconnect
          </Button>
        )}
        {status === "active" && (
          <Button variant="ghost" size="sm" onClick={() => onDisconnect(account.id)} aria-label="Disconnect account">
            <Trash2 className="w-4 h-4 text-semantic-error" />
          </Button>
        )}
      </div>
    </Card>
  );
}
```

**2. Nouveau fichier** : `socialcreator-web/src/components/connected-accounts/account-list.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { AccountCard } from "./account-card";
import { Button } from "@socialcreator/ui/button";
import { EmptyState } from "@socialcreator/ui/empty-state";
import { Skeleton } from "@socialcreator/ui/skeleton";
import { useUIStore } from "@/lib/stores";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  accountAvatarUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface AccountListProps {
  profileId: string;
  availablePlatforms: string[];
}

export function AccountList({ profileId, availablePlatforms }: AccountListProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const openModal = useUIStore((s) => s.openModal);

  useEffect(() => {
    fetch(`/api/v1/connected-accounts?profileId=${profileId}`)
      .then((r) => r.json())
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profileId]);

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await fetch("/api/v1/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, platform }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        openModal("error", { message: "Failed to initiate connection" });
      }
    } catch {
      openModal("error", { message: "Network error" });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;
    try {
      await fetch(`/api/v1/connected-accounts/${id}`, { method: "DELETE" });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      openModal("error", { message: "Failed to disconnect" });
    }
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  const unconnectedPlatforms = availablePlatforms.filter((p) => !connectedPlatforms.has(p));

  return (
    <div className="space-y-6">
      {accounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-title-sm text-ink">Connected Accounts</h3>
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onDisconnect={handleDisconnect}
              onReconnect={() => handleConnect(account.platform)}
            />
          ))}
        </div>
      )}

      {unconnectedPlatforms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-title-sm text-ink">Available Platforms</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {unconnectedPlatforms.map((platform) => (
              <Button
                key={platform}
                variant="outline"
                onClick={() => handleConnect(platform)}
                disabled={connecting === platform}
                className="h-20 flex-col gap-1"
              >
                {connecting === platform ? "Connecting..." : `Connect ${platform}`}
              </Button>
            ))}
          </div>
        </div>
      )}

      {accounts.length === 0 && unconnectedPlatforms.length === 0 && (
        <EmptyState
          title="No platforms available"
          description="This profile doesn't have any platforms configured."
        />
      )}
    </div>
  );
}
```

**3. Nouvelle page** : `socialcreator-web/src/app/(main)/profiles/[id]/accounts/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";
import { AccountList } from "@/components/connected-accounts/account-list";
import { PageHeader } from "@/components/layout/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AccountsPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return notFound();

  const { profile: profileRepo } = getRepositories();
  const profile = await profileRepo.findById(id);
  if (!profile || profile.userId !== session.user.id) return notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Connected Accounts"
        description={`Manage social media accounts for ${profile.name}`}
      />
      <AccountList profileId={id} availablePlatforms={profile.platforms as string[]} />
    </div>
  );
}
```

### Vérification
1. Naviguer vers `/profiles/{id}/accounts` → voir liste des comptes connectés
2. Cliquer "Connect X" → redirigé vers OAuth de la plateforme
3. Après callback OAuth → retour sur la page avec le nouveau compte listé
4. Cliquer "Disconnect" → confirmation → compte retiré de la liste
5. Test avec token expiré → bouton "Reconnect" visible

---

## S4.2 — Callback OAuth avec état de succès/erreur (UI notification)

**Fichiers** : `socialcreator-web/src/app/api/connected-accounts/callback/[platform]/route.ts` (MODIFIER), `socialcreator-web/src/app/(main)/profiles/[id]/accounts/page.tsx` (MODIFIER)
**Effort** : S
**Dépendances** : S4.1
**Test** : Simulation d'erreur OAuth → toast d'erreur visible

### Contexte
Actuellement, le callback redirige vers `/profiles/{id}/accounts?connected=success` ou `?error=...`. Mais ces messages ne sont pas affichés dans l'interface — l'utilisateur ne voit rien.

### Modifications

**1. Ajouter un composant toast/sonner** dans la page accounts :

```tsx
// Dans page.tsx, ajouter après le PageHeader :
"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

function OAuthNotification() {
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("connected") === "success") {
      toast.success("Account connected successfully!");
      // Clean URL without full page reload
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")) {
      const messages: Record<string, string> = {
        oauth_error: "Authentication failed. Please try again.",
        missing_params: "Missing OAuth parameters.",
        invalid_state: "Security validation failed. Please try again.",
        profile_not_found: "Profile not found.",
        access_denied: "Access denied.",
        token_exchange_failed: "Failed to exchange token.",
        callback_failed: "Connection failed. Please try again.",
      };
      toast.error(messages[params.get("error")!] || "An error occurred.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [params]);

  return null;
}
```

**2. Ajouter dans la page** :

```tsx
// Dans le JSX de la page :
<OAuthNotification />
```

### Vérification
1. Connecter un compte → redirection → toast "Account connected successfully!"
2. Annuler OAuth → redirection avec erreur → toast d'erreur

---

## S4.3 — Rafraîchissement automatique des tokens expirés

**Fichiers** : `socialcreator-web/src/lib/services/tokens.ts` (MODIFIER)
**Effort** : S
**Dépendances** : Sprint 3 (OAuth encryption déjà en place)
**Test** : Simuler un token expiré → `getValidAccessToken` doit le rafraîchir

### Contexte
`getValidAccessToken()` rafraîchit déjà les tokens expirés dans `tokens.ts` (fonctionnalité existante de Sprint 3). Mais il manque :
1. Un mécanisme pour **notifier l'utilisateur** quand un refresh échoue
2. Un **cron** pour rafraîchir les tokens en arrière-plan avant expiration

### Modifications

**1. Ajouter une notification utilisateur** quand le refresh échoue :

```tsx
// Dans tokens.ts, getValidAccessToken(), quand le refresh échoue :
logger.warn({ accountId, platform: account.platform }, "Token refresh failed — deactivating account");

// Ajouter : création d'un événement de notification
// (à implémenter avec une table Notification ou un webhook)
await createNotification({
  userId: account.userId,
  type: "TOKEN_EXPIRED",
  title: "Account disconnected",
  message: `Your ${account.platform} account needs to be reconnected.`,
  data: { accountId: account.id, platform: account.platform },
});
```

**2. Nouveau trigger** : `socialcreator-web/src/triggers/token-refresh.trigger.ts`

```tsx
/**
 * Token refresh scheduler
 * Runs daily to preemptively refresh tokens before they expire
 */
import { getRepositories } from "@/lib/repositories";
import { getValidAccessToken } from "@/lib/tokens";
import logger from "@/lib/logger";

export async function runTokenRefresh(): Promise<{ refreshed: number; failed: number }> {
  const { connectedAccount: caRepo } = getRepositories();

  // Find tokens expiring in the next 24 hours
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expiringSoon = await caRepo.findExpiringBefore(tomorrow);

  let refreshed = 0;
  let failed = 0;

  for (const account of expiringSoon) {
    try {
      // This triggers refresh if needed
      const token = await getValidAccessToken(account.id);
      if (token) refreshed++;
      else failed++;
    } catch (error) {
      failed++;
      logger.error({ accountId: account.id, err: error }, "Token refresh failed");
    }
  }

  logger.info({ expiringSoon: expiringSoon.length, refreshed, failed }, "Token refresh cycle completed");
  return { refreshed, failed };
}
```

### Vérification
1. Simuler un token expiré → `getValidAccessToken` rafraîchit
2. `runTokenRefresh` termine sans erreur
3. Logger montre le nombre de tokens rafraîchis

---

## S4.4 — Ajouter `findExpiringBefore` au repository ConnectedAccount

**Fichiers** : `socialcreator-web/src/lib/repositories/connected-account.repository.ts` (MODIFIER), `socialcreator-web/src/lib/repositories/connected-account.repository.ts` (interface + implémentation)
**Effort** : XS
**Dépendances** : S4.3
**Test** : `pnpm test:run`

### Modifications

**1. Ajouter à l'interface** :

```tsx
// Dans IConnectedAccountRepository :
findExpiringBefore(date: Date): Promise<ConnectedAccount[]>;
```

**2. Ajouter à l'implémentation** :

```tsx
async findExpiringBefore(date: Date): Promise<ConnectedAccount[]> {
  const accounts = await prisma.connectedAccount.findMany({
    where: {
      isActive: true,
      expiresAt: { lte: date },
    },
  });
  return this.decryptSensitiveArray(accounts);
}
```

### Vérification
1. `pnpm test:run` — tests passent
2. `pnpm typecheck` — OK

---

# 🚀 SPRINT 5 — Content Scheduling UI (semaine 3-4)

---

## S5.1 — Composant Calendar View pour contenu programmé

**Fichiers** : `socialcreator-web/src/components/content/calendar-view.tsx` (NOUVEAU), `socialcreator-web/src/app/(main)/content/calendar/page.tsx` (NOUVEAU)
**Effort** : L
**Dépendances** : Sprint 3 (Zustand stores, API v1 content)
**Test** : Naviguer vers `/content/calendar` → vue calendrier avec contenu programmé

### Contexte
Le champ `scheduledPublishAt` existe sur `GeneratedContent` et le trigger `runScheduledContentPublisher` fonctionne. Mais il n'y a **aucune UI** pour voir le planning éditorial.

### Modifications

**1. Nouveau fichier** : `socialcreator-web/src/components/content/calendar-view.tsx`

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@socialcreator/ui/button";
import { ContentStatusBadge } from "./content-status-badge";
import { PlatformBadge } from "./platform-badge";
import { Skeleton } from "@socialcreator/ui/skeleton";

interface CalendarEvent {
  id: string;
  title: string;
  platform: string;
  status: string;
  scheduledAt: string;
}

interface CalendarViewProps {
  profileId?: string;
  onEventClick?: (id: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export function CalendarView({ profileId, onEventClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch scheduled content
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      status: "SCHEDULED",
      pageSize: "100",
    });
    if (profileId) params.set("profileId", profileId);

    fetch(`/api/v1/content?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const items = data.contents || data || [];
        setEvents(
          items
            .filter((c: any) => c.scheduledPublishAt)
            .map((c: any) => ({
              id: c.id,
              title: c.textContent?.substring(0, 50) || "Untitled",
              platform: c.platform,
              status: c.status,
              scheduledAt: c.scheduledPublishAt,
            })),
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profileId, month, year]);

  // Calendar grid calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: Date; events: CalendarEvent[]; isCurrentMonth: boolean }> = [];

    // Previous month padding
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, events: [], isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayEvents = events.filter((e) => {
        const eventDate = new Date(e.scheduledAt);
        return eventDate.toDateString() === date.toDateString();
      });
      days.push({ date, events: dayEvents, isCurrentMonth: true });
    }

    // Next month padding (to fill 6 rows = 42 cells)
    while (days.length < 42) {
      const nextDate = new Date(year, month, days.length - startPad + 1);
      days.push({ date: nextDate, events: [], isCurrentMonth: false });
    }

    return days;
  }, [year, month, events]);

  if (loading) {
    return <Skeleton className="h-[600px]" />;
  }

  return (
    <div className="bg-surface-card rounded-lg border border-hairline">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-hairline">
        <Button variant="ghost" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-title-md text-ink font-medium">
          {MONTHS[month]} {year}
        </h2>
        <Button variant="ghost" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-hairline">
        {DAYS.map((day) => (
          <div key={day} className="p-2 text-caption text-muted text-center font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, i) => (
          <div
            key={i}
            className={`min-h-[100px] p-1 border-b border-r border-hairline ${
              !day.isCurrentMonth ? "bg-surface-strong/50" : ""
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 text-caption rounded-full ${
                day.date.toDateString() === new Date().toDateString()
                  ? "bg-primary text-on-primary"
                  : "text-muted"
              }`}
            >
              {day.date.getDate()}
            </span>
            <div className="space-y-1 mt-1">
              {day.events.slice(0, 3).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventClick?.(event.id)}
                  className="w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded bg-blue-50 text-blue-700 truncate hover:bg-blue-100 transition-colors"
                  title={event.title}
                >
                  {event.title}
                </button>
              ))}
              {day.events.length > 3 && (
                <span className="text-[10px] text-muted pl-1">+{day.events.length - 3} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**2. Nouvelle page** : `socialcreator-web/src/app/(main)/content/calendar/page.tsx`

```tsx
import { CalendarView } from "@/components/content/calendar-view";
import { PageHeader } from "@/components/layout/page-header";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="View and manage your scheduled content"
      />
      <CalendarView />
    </div>
  );
}
```

**3. Ajouter le lien dans la navigation** (sidebar.tsx) :

```tsx
// Dans navItems, ajouter :
{ href: "/content/calendar", label: "Calendar", icon: Calendar },
```

### Vérification
1. Naviguer vers `/content/calendar` → calendrier mensuel visible
2. Les contenus avec `scheduledPublishAt` apparaissent sur les jours correspondants
3. Navigation mois précédent/suivant fonctionne
4. Cliquer sur un événement → callback ou navigation

---

## S5.2 — Modal de programmation (Schedule Picker)

**Fichiers** : `socialcreator-web/src/components/content/schedule-modal.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : S5.1
**Test** : Approuver un contenu → modal de programmation → choisir date/heure → contenu programmé

### Contexte
Actuellement, approuver un contenu le passe en `APPROVED`. Il faut une UI pour le programmer à une date ultérieure (`scheduledPublishAt`).

### Modifications

**1. Nouveau fichier** : `socialcreator-web/src/components/content/schedule-modal.tsx`

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@socialcreator/ui/dialog";
import { Button } from "@socialcreator/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useContentStore } from "@/lib/stores";
import { toast } from "sonner";

interface ScheduleModalProps {
  contentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleModal({ contentId, open, onOpenChange }: ScheduleModalProps) {
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  });
  const [saving, setSaving] = useState(false);
  const updateItem = useContentStore((s) => s.updateItem);

  const handleSchedule = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/content/${contentId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledPublishAt: scheduledAt.toISOString() }),
      });

      if (!res.ok) throw new Error("Failed to schedule");

      updateItem(contentId, {
        status: "SCHEDULED",
        scheduledPublishAt: scheduledAt.toISOString(),
      } as any);

      toast.success("Content scheduled!");
      onOpenChange(false);
    } catch {
      toast.error("Failed to schedule content");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Publication</DialogTitle>
          <DialogDescription>
            Choose when this content should be published automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-body-sm text-ink font-medium">Date & Time</label>
            <DateTimePicker value={scheduledAt} onChange={setScheduledAt} minDate={new Date()} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule} disabled={saving}>
              {saving ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Vérification
1. Approuver un contenu → bouton "Schedule" disponible
2. Cliquer → modal avec date/time picker
3. Choisir une date future → "Schedule" → contenu passe en `SCHEDULED`
4. Le contenu apparaît dans le calendrier (S5.1)

---

## S5.3 — Pipeline Approve → Schedule → Publish

**Fichiers** : `socialcreator-web/src/app/api/v1/content/[id]/approve/route.ts` (MODIFIER), `socialcreator-web/src/app/api/v1/content/[id]/schedule/route.ts` (MODIFIER ou NOUVEAU)
**Effort** : M
**Dépendances** : S5.2
**Test** : Approuver → programmer → vérifier que le trigger schedule le publie

### Contexte
Le flux actuel est : DRAFT → APPROVED (via approve) → manuellement PUBLISHED (via publish). Il faut ajouter : DRAFT → APPROVED → SCHEDULED (via schedule) → auto-PUBLISHED (via trigger).

### Modifications

**1. Modifier la route d'approbation** pour proposer la programmation :

```tsx
// Dans POST /api/v1/content/[id]/approve
// Ajouter un paramètre optionnel scheduledPublishAt
const body = await request.json();
const schema = z.object({
  scheduledPublishAt: z.string().datetime().optional(),
});

const { scheduledPublishAt } = schema.parse(body);

await contentRepo.updateStatus(id, scheduledPublishAt ? "SCHEDULED" : "APPROVED");

if (scheduledPublishAt) {
  await contentRepo.update(id, {
    scheduledPublishAt: new Date(scheduledPublishAt),
  } as any);
}
```

**2. Route de programmation** : `socialcreator-web/src/app/api/v1/content/[id]/schedule/route.ts` (si pas déjà existante)

```tsx
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";
import { badRequest, notFound } from "@/lib/api-errors";

const scheduleSchema = z.object({
  scheduledPublishAt: z.string().datetime(),
});

export const PUT = withApiMiddleware(async ({ userId, params, request }) => {
  const id = params.id as string;
  const { content: contentRepo } = getRepositories();

  const content = await contentRepo.findById(id);
  if (!content) return notFound("Content");

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const scheduledPublishAt = new Date(parsed.data.scheduledPublishAt);
  if (scheduledPublishAt <= new Date()) {
    return badRequest("Scheduled time must be in the future");
  }

  await contentRepo.updateStatus(id, "SCHEDULED");
  await contentRepo.update(id, { scheduledPublishAt } as any);

  return NextResponse.json({ success: true });
});
```

### Vérification
1. Approuver un contenu sans date → reste APPROVED
2. Approuver avec date future → passe SCHEDULED
3. Programmer un contenu APPROVED → SCHEDULED
4. Le trigger `runScheduledContentPublisher` publie le contenu à l'heure programmée

---

# 🚀 SPRINT 6 — Multi-Platform Publish Pipeline (semaine 5-6)

---

## S6.1 — File d'attente de publication visible (Queue Dashboard)

**Fichiers** : `socialcreator-web/src/app/(main)/content/queue/page.tsx` (NOUVEAU), `socialcreator-web/src/components/job-queue/queue-status.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 3 (job queue), Sprint 5 (content list)
**Test** : Publier un contenu → visible dans la file d'attente

### Contexte
Le job queue (`src/lib/job-queue/`) existe et fonctionne en mémoire. Mais l'utilisateur ne voit pas l'état de publication (en cours, échoué, complété).

### Modifications

**1. Ajouter une API de statut de la queue** : `socialcreator-web/src/app/api/v1/queue/status/route.ts`

```tsx
import { NextResponse } from "next/server";
import { getQueueStatus } from "@/lib/job-queue";

export const GET = async () => {
  const status = getQueueStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store", "X-API-Version": "v1" },
  });
};
```

**2. Nouveau composant** : `socialcreator-web/src/components/job-queue/queue-status.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@socialcreator/ui/card";
import { Badge } from "@socialcreator/ui/badge";

interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

export function QueueStatus() {
  const [stats, setStats] = useState<QueueStats | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/v1/queue/status");
        const data = await res.json();
        setStats({
          pending: data.pending || 0,
          running: data.running || 0,
          completed: data.completed || 0,
          failed: data.failed || 0,
          total: data.total || 0,
        });
      } catch {
        // Ignore
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-5 gap-4">
      <Card className="p-4 text-center">
        <p className="text-title-lg text-ink">{stats.pending}</p>
        <p className="text-caption text-muted">Pending</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-title-lg text-blue-600">{stats.running}</p>
        <p className="text-caption text-muted">Running</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-title-lg text-green-600">{stats.completed}</p>
        <p className="text-caption text-muted">Completed</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-title-lg text-red-600">{stats.failed}</p>
        <p className="text-caption text-muted">Failed</p>
      </Card>
      <Card className="p-4 text-center">
        <p className="text-title-lg text-ink">{stats.total}</p>
        <p className="text-caption text-muted">Total</p>
      </Card>
    </div>
  );
}
```

**3. Nouvelle page** : `socialcreator-web/src/app/(main)/content/queue/page.tsx`

```tsx
import { QueueStatus } from "@/components/job-queue/queue-status";
import { PageHeader } from "@/components/layout/page-header";

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Publish Queue"
        description="Monitor content publishing in real-time"
      />
      <QueueStatus />
    </div>
  );
}
```

### Vérification
1. Publier un contenu → `/content/queue` montre l'état
2. Les compteurs se mettent à jour en temps réel
3. Après publication → compteur Completed incrémenté

---

## S6.2 — Historique des publications (PublishLog UI)

**Fichiers** : `socialcreator-web/src/app/(main)/content/history/page.tsx` (NOUVEAU), `socialcreator-web/src/components/content/publish-history.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 3 (publish-log repository)
**Test** : Naviguer vers `/content/history` → historique des publications

### Contexte
Le `PublishLog` est créé dans `handlers.ts` (Sprint 3) mais il n'y a pas d'UI pour le consulter.

### Modifications

**1. API route** : `socialcreator-web/src/app/api/v1/publish-logs/route.ts`

```tsx
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  const { publishLog: publishLogRepo } = getRepositories();

  if (profileId) {
    const logs = await publishLogRepo.findByProfileId(profileId, { page, pageSize });
    return NextResponse.json(logs);
  }

  const logs = await publishLogRepo.findByUserId(userId, { page, pageSize });
  return NextResponse.json(logs);
});
```

**2. Nouveau composant** : `socialcreator-web/src/components/content/publish-history.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { Card } from "@socialcreator/ui/card";
import { Badge } from "@socialcreator/ui/badge";
import { Skeleton } from "@socialcreator/ui/skeleton";
import { PlatformBadge } from "./platform-badge";
import { formatDistanceToNow } from "date-fns";

interface PublishLog {
  id: string;
  platform: string;
  contentId: string;
  contentHash: string;
  success: boolean;
  error: string | null;
  createdAt: string;
}

export function PublishHistory({ profileId }: { profileId?: string }) {
  const [logs, setLogs] = useState<PublishLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (profileId) params.set("profileId", profileId);

    fetch(`/api/v1/publish-logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs || data || []);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profileId, page]);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        <p>No publish history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id} className="flex items-center gap-4 p-4">
          <PlatformBadge platform={log.platform} />
          <div className="flex-1 min-w-0">
            <p className="text-body-sm text-ink truncate">
              Content published to {log.platform}
            </p>
            <p className="text-caption text-muted">
              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
            </p>
          </div>
          <Badge className={log.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            {log.success ? "Success" : "Failed"}
          </Badge>
          {log.error && (
            <p className="text-caption text-semantic-error max-w-[200px] truncate" title={log.error}>
              {log.error}
            </p>
          )}
        </Card>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-hairline text-body-sm disabled:opacity-50">
            Previous
          </button>
          <span className="px-3 py-1 text-body-sm text-muted">{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-hairline text-body-sm disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

### Vérification
1. Publier du contenu → `/content/history` montre l'historique
2. Les publications réussies et échouées sont visibles
3. Pagination fonctionne avec +20 entrées

---

## S6.3 — Refactor publishers : standardisation du pattern

**Fichiers** : `socialcreator-web/src/lib/publishers/*.ts` (tous les 9 fichiers), `socialcreator-web/src/lib/publishers/index.ts`
**Effort** : M
**Dépendances** : Sprint 3 (repository pattern)
**Test** : `pnpm test:run` — tests des publishers passent

### Contexte
Les 9 publishers ont des signatures légèrement différentes. Certains prennent des paramètres nommés, d'autres des objets. Il faut standardiser.

### Modifications

**1. Définir une interface commune** :

```tsx
// Dans publishers/index.ts ou publishers/types.ts
export interface PublishInput {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

export interface PublishOptions {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export type PublisherFunction = (input: PublishInput, options: PublishOptions) => Promise<PublishResult>;
```

**2. Adapter chaque publisher** à cette interface :

```tsx
// Exemple: facebook.ts
import type { PublishInput, PublishOptions, PublishResult } from "./types";

export async function publishToFacebook(input: PublishInput, options: PublishOptions): Promise<PublishResult> {
  // Implementation standardisée
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${options.accountId}/feed`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: input.textContent,
        link: input.mediaUrls[0] || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error?.message || "Facebook API error" };
    }

    const data = await res.json();
    return { success: true, postId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}
```

**3. Mettre à jour `publishContent`** dans `publishers/index.ts` pour utiliser la factory :

```tsx
const publisherMap: Record<string, PublisherFunction> = {
  X: publishToX,
  INSTAGRAM: publishToInstagram,
  YOUTUBE: publishToYouTube,
  FACEBOOK: publishToFacebook,
  LINKEDIN: publishToLinkedIn,
  TIKTOK: publishToTikTok,
  THREADS: publishToThreads,
  PINTEREST: publishToPinterest,
};

export function getPublisher(platform: string): PublisherFunction {
  const publisher = publisherMap[platform];
  if (!publisher) throw new Error(`Unknown platform: ${platform}`);
  return publisher;
}

export async function publishContent(
  platform: string,
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const publisher = getPublisher(platform);
  return publisher(input, options);
}
```

### Vérification
1. `pnpm test:run` — tous les tests passent (y compris les tests de publishers de Sprint 3)
2. `pnpm typecheck` — OK
3. Tous les publishers retournent `PublishResult`

---

# 🚀 SPRINT 7 — Dashboard + Analytics (semaine 7-8)

---

## S7.1 — Page Dashboard principale

**Fichiers** : `socialcreator-web/src/app/(main)/page.tsx` (MODIFIER), `socialcreator-web/src/components/dashboard/stats-card.tsx` (NOUVEAU), `socialcreator-web/src/components/dashboard/recent-activity.tsx` (NOUVEAU)
**Effort** : L
**Dépendances** : Sprint 5 (content list), Sprint 6 (publish history)
**Test** : Naviguer vers `/` → dashboard avec stats et activités récentes

### Contexte
La page d'accueil actuelle est très probablement une page vide ou un placeholder. Il faut un dashboard utile.

### Modifications

**1. API Dashboard** : `socialcreator-web/src/app/api/v1/dashboard/route.ts`

```tsx
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

export const GET = withApiMiddleware(async ({ userId }) => {
  const { content: contentRepo, publishLog: publishLogRepo, profile: profileRepo } = getRepositories();

  const profiles = await profileRepo.findByUserId(userId);

  // Aggregate stats across profiles
  const profileIds = profiles.map((p) => p.id);

  const [totalContents, totalPublished, todayPublishes, recentLogs] = await Promise.all([
    // Total content count
    Promise.all(profileIds.map((pid) => contentRepo.findByProfileId(pid, { pageSize: 1 }))).then(
      (results) => results.reduce((sum, r) => sum + r.total, 0),
    ),
    // Published count
    Promise.all(profileIds.map((pid) => contentRepo.findByProfileId(pid, { status: "PUBLISHED", pageSize: 1 }))).then(
      (results) => results.reduce((sum, r) => sum + r.total, 0),
    ),
    // Today's publishes from publishLog
    Promise.all(profileIds.map((pid) => publishLogRepo.countPublishedToday(pid, null as any))).then(
      (counts) => counts.reduce((sum, c) => sum + c, 0),
    ),
    // Recent publish logs
    publishLogRepo.findByUserId(userId, { pageSize: 10 }),
  ]);

  return NextResponse.json({
    stats: {
      profiles: profiles.length,
      totalContents,
      totalPublished,
      todayPublishes,
    },
    recentActivity: recentLogs.logs || [],
  });
});
```

**2. Composant StatsCard** :

```tsx
// socialcreator-web/src/components/dashboard/stats-card.tsx
import { Card } from "@socialcreator/ui/card";

interface StatsCardProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

export function StatsCard({ label, value, icon, trend }: StatsCardProps) {
  return (
    <Card className="p-4 flex items-start justify-between">
      <div>
        <p className="text-caption text-muted mb-1">{label}</p>
        <p className="text-display-sm text-ink font-semibold">{value.toLocaleString()}</p>
        {trend && (
          <p className={`text-caption mt-1 ${trend.positive ? "text-green-600" : "text-red-600"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}%
          </p>
        )}
      </div>
      {icon && <div className="text-muted">{icon}</div>}
    </Card>
  );
}
```

**3. Modifier la page d'accueil** :

```tsx
"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { FileText, CheckCircle, Clock, Users, Activity } from "lucide-react";
import { Skeleton } from "@socialcreator/ui/skeleton";

interface DashboardData {
  stats: { profiles: number; totalContents: number; totalPublished: number; todayPublishes: number };
  recentActivity: Array<{ id: string; platform: string; success: boolean; createdAt: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/v1/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-title-lg text-ink font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label="Profiles" value={data.stats.profiles} icon={<Users className="w-5 h-5" />} />
        <StatsCard label="Total Content" value={data.stats.totalContents} icon={<FileText className="w-5 h-5" />} />
        <StatsCard label="Published" value={data.stats.totalPublished} icon={<CheckCircle className="w-5 h-5" />} />
        <StatsCard label="Today" value={data.stats.todayPublishes} icon={<Activity className="w-5 h-5" />} />
      </div>

      <section>
        <h2 className="text-title-md text-ink font-medium mb-4">Recent Activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-muted">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {data.recentActivity.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-surface-card rounded-lg border border-hairline">
                <div className={`w-2 h-2 rounded-full ${log.success ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-body-sm text-ink">
                  {log.success ? "Published to" : "Failed to publish on"} {log.platform}
                </span>
                <span className="text-caption text-muted ml-auto">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

### Vérification
1. `/` → dashboard avec 4 cartes de stats
2. Les stats reflètent les vraies données
3. "Recent Activity" montre les dernières publications
4. Mise en page responsive

---

## S7.2 — Graphiques d'activité (publications par jour)

**Fichiers** : `socialcreator-web/src/components/dashboard/publish-chart.tsx` (NOUVEAU), `socialcreator-web/src/app/api/v1/dashboard/chart-data/route.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : S7.1
**Test** : Dashboard → graphique en barres des 7/30 derniers jours

### Contexte
Les stats brutes sont utiles mais un graphique donne une meilleure vision des tendances.

### Modifications

**1. API Chart Data** :

```tsx
// socialcreator-web/src/app/api/v1/dashboard/chart-data/route.ts
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/api-middleware";
import { getRepositories } from "@/lib/repositories";

export const GET = withApiMiddleware(async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");

  const { publishLog: publishLogRepo } = getRepositories();
  const data = await publishLogRepo.getDailyStats(userId, days);

  return NextResponse.json({ data, days });
});
```

**2. Composant PublishChart** (utilise Recharts déjà dans les dépendances) :

```tsx
"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@socialcreator/ui/card";
import { Skeleton } from "@socialcreator/ui/skeleton";

export function PublishChart() {
  const [data, setData] = useState<Array<{ date: string; success: number; failed: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/dashboard/chart-data?days=7")
      .then((r) => r.json())
      .then((result) => setData(result.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card className="p-4">
      <h3 className="text-title-sm text-ink font-medium mb-4">Publications (7 days)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-muted)" />
          <Tooltip />
          <Bar dataKey="success" fill="var(--color-primary)" name="Success" radius={[4, 4, 0, 0]} />
          <Bar dataKey="failed" fill="var(--color-semantic-error)" name="Failed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
```

### Vérification
1. Dashboard → graphique visible
2. Barres vertes (succès) et rouges (échecs) par jour
3. Tooltip au survol

---

## S7.3 — Ajouter `getDailyStats` et `findByUserId` à PublishLogRepository

**Fichiers** : `socialcreator-web/src/lib/repositories/publish-log.repository.ts` (MODIFIER)
**Effort** : S
**Dépendances** : S7.2
**Test** : `pnpm test:run`

### Modifications

```tsx
// Dans l'interface IPublishLogRepository :
interface PublishLogFilterOptions {
  page?: number;
  pageSize?: number;
}

interface PublishLogPage {
  logs: PublishLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface DailyStatsItem {
  date: string;
  success: number;
  failed: number;
}

// Ajouter :
findByUserId(userId: string, options?: PublishLogFilterOptions): Promise<PublishLogPage>;
getDailyStats(userId: string, days: number): Promise<DailyStatsItem[]>;
```

```tsx
// Implémentation :
async findByUserId(userId: string, options?: PublishLogFilterOptions): Promise<PublishLogPage> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const where = { userId };

  const [logs, total] = await Promise.all([
    prisma.publishLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.publishLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

async getDailyStats(userId: string, days: number): Promise<DailyStatsItem[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.publishLog.findMany({
    where: {
      userId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date
  const grouped: Record<string, { success: number; failed: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    grouped[key] = { success: 0, failed: 0 };
  }

  for (const log of logs) {
    const key = log.createdAt.toISOString().split("T")[0];
    if (grouped[key]) {
      if (log.success) grouped[key].success++;
      else grouped[key].failed++;
    }
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}
```

### Vérification
1. `pnpm test:run` — pass
2. `pnpm typecheck` — OK

---

# 🚀 SPRINT 8 — Observability (semaine 9-10)

---

## S8.1 — Structured error logging avec Pino

**Fichiers** : `socialcreator-web/src/lib/logger.ts` (MODIFIER), `socialcreator-web/src/lib/middleware/api-middleware.ts` (MODIFIER)
**Effort** : M
**Dépendances** : Sprint 2 (requestId déjà en place)
**Test** : Vérifier que les logs Pino sont structurés avec `requestId`, `err`, `duration`

### Contexte
Pino est déjà dans les dépendances et `logger.ts` exporte un logger Pino. Mais les logs ne sont pas structurés correctement — certains utilisent `console.error` au lieu de `logger.error`.

### Modifications

**1. Audit des `console.error`** : Remplacer tous les `console.error` par `logger.error` :

```bash
rg "console\.error" --type ts socialcreator-web/src/
```

Remplacer chaque occurrence :
```tsx
// AVANT :
console.error("Error fetching profiles:", error);

// APRÈS :
logger.error({ err: error }, "Error fetching profiles");
```

**2. Configurer Pino pour production** :

```tsx
// src/lib/logger.ts
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export default pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {
        // Production: JSON structured logs
        formatters: {
          level: (label) => ({ level: label }),
          bindings: () => ({}),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});
```

**3. Ajouter le requestId automatiquement** :

```tsx
// Dans api-middleware.ts, avant d'appeler le handler :
const childLogger = logger.child({ requestId });
// Remplacer logger.info/warn/error par childLogger dans le scope de la requête
```

### Vérification
1. `rg "console.error"` — aucune occurrence restante dans `src/`
2. Logs en production → format JSON valide
3. Chaque log contient `requestId`, `duration`, `err` (si erreur)

---

## S8.2 — Endpoint /api/health enrichi

**Fichiers** : `socialcreator-web/src/app/api/health/route.ts` (MODIFIER), `socialcreator-web/src/app/api/v1/health/route.ts` (MODIFIER)
**Effort** : XS
**Dépendances** : S8.1
**Test** : `curl http://localhost:3000/api/health` → status DB + uptime

### Contexte
Le endpoint `/api/health` existe (Sprint 3) mais ne retourne que `{ status: "ok" }`. Il faut enrichir pour le monitoring.

### Modifications

```tsx
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbStatus = "ok";
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json(
    {
      status: dbStatus === "ok" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: { status: dbStatus, latencyMs: dbLatency },
      },
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-API-Version": "v1",
      },
    },
  );
}
```

### Vérification
1. `curl /api/health` → `{ status: "healthy", checks: { database: { status: "ok" } } }`
2. DB down → `status: "degraded"`, `database.status: "error"`

---

## S8.3 — Rate limiting visible + Monitoring endpoints

**Fichiers** : `socialcreator-web/src/lib/middleware/rate-limit.ts` (MODIFIER), `socialcreator-web/src/app/api/v1/metrics/route.ts` (NOUVEAU)
**Effort** : S
**Dépendances** : S8.1
**Test** : `/api/v1/metrics` → Prometheus metrics incluant les stats de rate limit

### Contexte
Un rate limiting existe probablement mais n'est pas exposé dans les métriques. Il faut l'ajouter au endpoint `/api/metrics`.

### Modifications

**1. Ajouter des métriques de rate limiting** :

```tsx
// Dans rate-limit.ts, exporter un compteur :
import { Counter } from "prom-client";

export const rateLimitHits = new Counter({
  name: "rate_limit_hits_total",
  help: "Total number of rate limit hits",
  labelNames: ["route", "userId"] as const,
  registers: [register], // register existant dans metrics.ts
});
```

**2. Incrémenter** quand un rate limit est atteint :

```tsx
// Dans le middleware rate-limit, quand la requête est bloquée :
rateLimitHits.inc({ route: request.nextUrl.pathname, userId: session?.user?.id || "anonymous" });
```

**3. Vérifier que `/api/metrics` expose les nouvelles métriques** :

```bash
curl http://localhost:3000/api/metrics | grep rate_limit
```

### Vérification
1. `curl /api/metrics | grep rate_limit` → `rate_limit_hits_total` présent
2. Déclencher un rate limit → compteur incrémenté

---

## S8.4 — Documenter l'architecture et l'observabilité

**Fichiers** : `docs/architecture/07-observability.md` (NOUVEAU), `docs/runbooks/monitoring.md` (NOUVEAU)
**Effort** : S
**Dépendances** : S8.1, S8.2, S8.3
**Test** : Revue du doc par l'équipe

### Contexte
Il n'y a pas de documentation centralisée sur comment monitorer l'application, où trouver les logs, comment interpréter les métriques.

### Modifications

**1. Nouveau fichier** : `docs/architecture/07-observability.md`

```markdown
# Observability — SocialCreator

## Logs
- **Format**: JSON structuré via Pino
- **Niveaux**: debug, info, warn, error, fatal
- **Champs communs**: requestId, duration, err, userId
- **Local**: pino-pretty (couleurs, lisible)
- **Production**: JSON brut → CloudWatch / Papertrail / etc.

## Métriques (Prometheus)
- **Endpoint**: `GET /api/metrics`
- **Métriques clés**:
  - `http_requests_total` — Requêtes API
  - `http_request_duration_seconds` — Latence
  - `content_generated_total` — Contenu généré (par plateforme)
  - `rate_limit_hits_total` — Requêtes limitées
  - `agent_run_duration_seconds` — Durée des runs agent

## Health Check
- **Endpoint**: `GET /api/health`
- **Format**: `{ status, checks: { database } }`
- **Utilisation**: Load balancer, Kubernetes probes, uptime monitoring

## Alerting
- Token refresh failure → notification utilisateur
- Rate limit spike → investigation
- DB connection failure → alerte immédiate
```

### Vérification
1. Les docs sont lisibles et complètes
2. Un nouveau développeur peut monitorer l'app sans aide

---

# 📋 RÉCAPITULATIF SPRINTS 4-8

## Sprint 4 — OAuth Onboarding Flow (~5 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S4.1 | `src/components/connected-accounts/account-card.tsx` | **NOUVEAU** — Carte de compte connecté |
| S4.1 | `src/components/connected-accounts/account-list.tsx` | **NOUVEAU** — Liste + boutons Connect |
| S4.1 | `src/app/(main)/profiles/[id]/accounts/page.tsx` | **NOUVEAU** — Page de gestion |
| S4.2 | `src/app/api/connected-accounts/callback/[platform]/route.ts` | MODIFIER — Améliorer les redirections |
| S4.3 | `src/lib/services/tokens.ts` | MODIFIER — Notification refresh failure |
| S4.3 | `src/triggers/token-refresh.trigger.ts` | **NOUVEAU** — Cron de rafraîchissement |
| S4.4 | `src/lib/repositories/connected-account.repository.ts` | MODIFIER — Ajouter `findExpiringBefore` |

## Sprint 5 — Content Scheduling UI (~6 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S5.1 | `src/components/content/calendar-view.tsx` | **NOUVEAU** — Calendrier mensuel |
| S5.1 | `src/app/(main)/content/calendar/page.tsx` | **NOUVEAU** — Page calendrier |
| S5.2 | `src/components/content/schedule-modal.tsx` | **NOUVEAU** — Modal de programmation |
| S5.3 | `src/app/api/v1/content/[id]/approve/route.ts` | MODIFIER — Support scheduling |
| S5.3 | `src/app/api/v1/content/[id]/schedule/route.ts` | **NOUVEAU** — Route de programmation |

## Sprint 6 — Multi-Platform Publish Pipeline (~7 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S6.1 | `src/app/api/v1/queue/status/route.ts` | **NOUVEAU** — API statut queue |
| S6.1 | `src/components/job-queue/queue-status.tsx` | **NOUVEAU** — Dashboard queue |
| S6.1 | `src/app/(main)/content/queue/page.tsx` | **NOUVEAU** — Page queue |
| S6.2 | `src/app/api/v1/publish-logs/route.ts` | **NOUVEAU** — API historique |
| S6.2 | `src/components/content/publish-history.tsx` | **NOUVEAU** — Composant historique |
| S6.2 | `src/app/(main)/content/history/page.tsx` | **NOUVEAU** — Page historique |
| S6.3 | `src/lib/publishers/*.ts` | MODIFIER — Standardisation interface |

## Sprint 7 — Dashboard + Analytics (~8 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S7.1 | `src/app/api/v1/dashboard/route.ts` | **NOUVEAU** — API dashboard |
| S7.1 | `src/components/dashboard/stats-card.tsx` | **NOUVEAU** — Carte de stat |
| S7.1 | `src/app/(main)/page.tsx` | MODIFIER — Dashboard complet |
| S7.2 | `src/app/api/v1/dashboard/chart-data/route.ts` | **NOUVEAU** — API chart |
| S7.2 | `src/components/dashboard/publish-chart.tsx` | **NOUVEAU** — Graphique Recharts |
| S7.3 | `src/lib/repositories/publish-log.repository.ts` | MODIFIER — `getDailyStats`, `findByUserId` |

## Sprint 8 — Observability (~7 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S8.1 | `src/lib/logger.ts` | MODIFIER — Config Pino production |
| S8.1 | `src/lib/middleware/api-middleware.ts` | MODIFIER — Child logger avec requestId |
| S8.1 | Multiples fichiers `src/` | MODIFIER — `console.error` → `logger.error` |
| S8.2 | `src/app/api/health/route.ts` | MODIFIER — Health check enrichi |
| S8.3 | `src/lib/middleware/rate-limit.ts` | MODIFIER — Métriques rate limit |
| S8.4 | `docs/architecture/07-observability.md` | **NOUVEAU** — Documentation |
| S8.4 | `docs/runbooks/monitoring.md` | **NOUVEAU** — Runbook monitoring |

---

# ✅ CHECKLIST DE LIVRAISON PAR SPRINT

## Sprint 4
- [ ] Page `/profiles/{id}/accounts` avec liste des comptes connectés
- [ ] Bouton "Connect X" lance le flux OAuth
- [ ] Callback OAuth avec toast de succès/erreur
- [ ] Déconnexion fonctionnelle
- [ ] `pnpm test:run` OK
- [ ] `pnpm typecheck` OK

## Sprint 5
- [ ] Calendrier mensuel avec contenu programmé
- [ ] Modal de programmation (date + time picker)
- [ ] Approve → Schedule → auto-Publish fonctionnel
- [ ] `pnpm test:run` OK
- [ ] `pnpm typecheck` OK

## Sprint 6
- [ ] Queue dashboard avec stats en temps réel
- [ ] Historique des publications avec pagination
- [ ] Publishers standardisés (interface commune)
- [ ] `pnpm test:run` OK
- [ ] `pnpm typecheck` OK

## Sprint 7
- [ ] Dashboard avec 4 cartes de stats
- [ ] Graphique des publications (7/30 jours)
- [ ] Recent activity list
- [ ] `pnpm test:run` OK
- [ ] `pnpm typecheck` OK

## Sprint 8
- [ ] Aucun `console.error` dans `src/`
- [ ] Logs Pino structurés en production (JSON)
- [ ] Health check avec vérification DB
- [ ] Métriques rate limit exposées
- [ ] Documentation observabilité
- [ ] `pnpm test:run` OK
- [ ] `pnpm typecheck` OK

---

# 🔗 DÉPENDANCES ENTRE SPRINTS

```
Sprint 4 (OAuth) — Sprint 3 (API v1, encryption, stores)
Sprint 5 (Scheduling) — Sprint 3 (API v1 content, triggers)
Sprint 6 (Pipeline) — Sprint 3 (job queue, handlers), Sprint 5 (content status)
Sprint 7 (Dashboard) — Sprint 5 (content list), Sprint 6 (publish history)
Sprint 8 (Observability) — Sprint 2 (requestId), Sprint 7 (metrics endpoint)
```

## Ordre recommandé d'exécution

```
Sprint 4 ─┐
Sprint 5 ─┤  (peuvent être parallèles — dépendent tous deux de Sprint 3)
          │
Sprint 6 ──────┤  (dépend de S5 pour le pipeline complet)
Sprint 7 ──────┤  (dépend de S6 pour les données d'historique)
Sprint 8 ──────────┤  (dépend de S7 pour le endpoint metrics)
Sprint 9 ───────────────┤  (dépend de S8 pour observabilité, S7+S6 pour queue)
```

---

# 🚀 SPRINT 9 — Security Hardening + Queue Activation (semaine 11-12)

---

## S9.1 — Authentifier les endpoints de métriques et monitoring

**Fichiers** : `src/app/api/metrics/route.ts` (MODIFIER), `src/app/api/v1/queue/status/route.ts` (MODIFIER), `src/lib/utils/metrics.ts` (MODIFIER), `src/lib/middleware/api-middleware.ts` (MODIFIER)
**Effort** : M
**Dépendances** : Sprint 8 (observabilité)
**Test** : `curl /api/metrics` → 401 sans auth, 200 avec auth

### Contexte
Audit de sécurité (Sprint 9 planning) a révélé 3 High-severity findings :
- **H-01**: `/api/metrics` est **non authentifié** et expose des resource IDs dans les labels Prometheus
- **H-02**: `/api/v1/queue/status` est **non authentifié**, expose les métriques opérationnelles
- **H-03**: Les labels Prometheus utilisent `request.nextUrl.pathname` (IDs de ressources en clair → cardinalité infinie + fuite de données)

### Modifications

**1. Ajouter l'auth à `/api/metrics`** :

```tsx
// src/app/api/metrics/route.ts
import { register } from "@/lib/utils/metrics";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 🔒 Authentification requise
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metrics = await register.metrics();
  return new NextResponse(metrics, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
```

**2. Sanitiser les labels Prometheus** :

```tsx
// src/lib/middleware/api-middleware.ts (dans le helper de métriques)
// AVANT : request.nextUrl.pathname
// APRÈS : pattern généralisé (/api/v1/content/[id])
function sanitizeRoute(pathname: string): string {
  return pathname.replace(/\/[a-z0-9]{24,}(?:\/|$)/gi, "/[id]$1");
}
```

**3. Ajouter l'auth à `/api/v1/queue/status`** :

```tsx
// src/app/api/v1/queue/status/route.ts
import { withApiMiddleware } from "@/lib/middleware/api-middleware";

export const GET = withApiMiddleware(async ({ userId }) => {
  const { getQueueStatus } = await import("@/lib/job-queue");
  const status = getQueueStatus();

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
});
```

### Vérification
1. `curl /api/metrics` sans cookie → 401
2. `curl /api/metrics` avec session → 200, métriques Prometheus
3. `curl /api/v1/queue/status` sans cookie → 401
4. Labels Prometheus ne contiennent plus d'IDs de ressources
5. `pnpm test:run` OK

---

## S9.2 — Éliminer tous les `console.*` restants

**Fichiers** : Multiples — 135+ occurrences dans `src/`
**Effort** : M
**Dépendances** : Sprint 8 (logger Pino en place)
**Test** : `rg "console\.(error|warn|log|debug)" --type ts src/` → 0 occurrences

### Contexte
Sprint 8 avait pour objectif d'éliminer les `console.error`, mais 135+ appels `console.*` persistent dans :
- `entitlements/cache.ts` (~22 appels)
- Routes API (`api/content/*/route.ts`)
- `components/error-boundary.tsx`
- Divers services et composants

### Modifications

**1. Remplacer systématiquement** :

```bash
# Pattern pour chaque occurrence :
# AVANT :
console.error("Error:", error);
console.warn("Warning:", msg);
console.log("Debug:", data);
console.debug("Trace:", x);

# APRÈS :
logger.error({ err: error }, "Error message");
logger.warn({ ...context }, "Warning message");
logger.info({ ...context }, "Info message");
logger.debug({ ...context }, "Debug message");
```

**2. Cas particuliers** :
- `console.log` de résultats d'appels API → `logger.info`
- `console.warn` de cache → `logger.warn`
- `console.error` dans error-boundary → `logger.error`
- `console.debug` de dev → `logger.debug`

### Vérification
1. `rg "console\.(error|warn|log|debug)" --type ts src/` — 0 occurrences
2. `rg "console\.(error|warn|log|debug)" --type tsx src/` — 0 occurrences (sauf erreurs légitimes dans les tests)
3. `pnpm test:run` OK

---

## S9.3 — Activer le worker de queue via `instrumentation.ts`

**Fichiers** : `socialcreator-web/src/instrumentation.ts` (NOUVEAU), `src/lib/job-queue/worker.ts` (MODIFIER)
**Effort** : S
**Dépendances** : S9.1, S9.2
**Test** : Logs au démarrage → "Job worker started"

### Contexte
Le nouveau job-queue avec handler registry, types typés et file prioritaire existe depuis Sprint 5/6 mais `startWorker()` n'est **jamais appelé**. Les jobs sont enqueués mais jamais exécutés.

Next.js 14+ supporte `instrumentation.ts` comme standard pour l'initialisation serveur.

### Modifications

**1. Nouveau fichier : `src/instrumentation.ts`** :

```tsx
// src/instrumentation.ts
import { startWorker } from "@/lib/job-queue";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startWorker();
  }
}
```

**2. Vérifier `next.config.js`** : `instrumentationHook: true` doit être activé.

### Vérification
1. Logs au démarrage : `"Job worker started"`
2. Enqueuer un job → le handler s'exécute
3. `pnpm test:run` OK

---

## S9.4 — Nettoyage du code mort : supprimer `infrastructure/job-queue.ts`

**Fichiers** : `src/lib/infrastructure/job-queue.ts` (SUPPRIMER), `src/lib/infrastructure/trigger.ts` (MODIFIER)
**Effort** : XS
**Dépendances** : Module resolution fix (déjà fait)
**Test** : `pnpm typecheck` — 0 erreurs

### Contexte
La vieille queue (`infrastructure/job-queue.ts`) est devenue du code mort après le fix de résolution de module (Sprint 9 planning). Le nouveau barrel `job-queue.ts` pointe maintenant vers `./job-queue/index`.

### Modifications

**1. Supprimer `src/lib/infrastructure/job-queue.ts`** :
```bash
Remove-Item -LiteralPath "src/lib/infrastructure/job-queue.ts"
```

**2. Vérifier que `infrastructure/trigger.ts` n'importe plus l'ancienne queue**.

### Vérification
1. `pnpm typecheck` — 0 nouvelles erreurs
2. `pnpm test:run` — tous les tests passent

---

## S9.5 — Hardening de la queue (taille max, timeout, type safety)

**Fichiers** : `src/lib/job-queue/queue.ts` (MODIFIER), `src/lib/job-queue/worker.ts` (MODIFIER), `src/lib/job-queue/handlers.ts` (MODIFIER)
**Effort** : S
**Dépendances** : S9.4
**Test** : `pnpm test:run`

### Contexte
Review de code a identifié :

- **M-02**: Queue non bornée → risque OOM
- **L-04**: Pas de timeout dans le worker → jobs bloquants
- **M-01**: `(payload: any)` dans handler registry → perte de type safety
- **m6**: Archive de jobs jamais nettoyée

### Modifications

**1. Ajouter MAX_QUEUE_SIZE** :

```tsx
// Dans queue.ts
const MAX_QUEUE_SIZE = 10_000;

export function enqueueJob<T extends JobPayload>(...): string {
  if (jobQueue.length >= MAX_QUEUE_SIZE) {
    throw new Error(`Queue full (max ${MAX_QUEUE_SIZE} jobs)`);
  }
  // ... existing logic
}
```

**2. Timeout dans le worker** :

```tsx
// Dans worker.ts
const JOB_TIMEOUT_MS = 30_000;

async function processJob(job: Job): Promise<void> {
  const handler = getJobHandler(job.type);
  if (!handler) { failJob(job.id, `No handler for type: ${job.type}`); return; }

  try {
    await Promise.race([
      handler(job.payload as any),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Job timed out")), JOB_TIMEOUT_MS),
      ),
    ]);
    completeJob(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    failJob(job.id, message);
  }
}
```

**3. Typer handler registry** :

```tsx
// Dans handlers.ts — AVANT :
const handlerRegistry = new Map<JobType, (payload: any) => Promise<void>>();

// APRÈS :
const handlerRegistry = new Map<JobType, (payload: JobPayload) => Promise<void>>();

// Worker.ts aussi : enlever le "as any"
await handler(job.payload);  // plutôt que handler(job.payload as any)
```

**4. Nettoyage périodique des vieux jobs** :

```tsx
// Ajouter à queue.ts
const MAX_ARCHIVE_SIZE = 5_000;

function trimArchive(): void {
  const completedCount = jobQueue.filter(j => j.status === "completed" || j.status === "failed").length;
  if (completedCount > MAX_ARCHIVE_SIZE) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24h
    jobQueue = jobQueue.filter(j =>
      j.status === "queued" || j.status === "running" ||
      (j.completedAt && j.completedAt > cutoff)
    );
  }
}
```

### Vérification
1. `pnpm typecheck` — 0 erreurs
2. `pnpm test:run` — 73 files pass
3. Queue pleine → `enqueueJob` lance une erreur

---

## S9.6 — Rate limiting per-user pour les routes authentifiées

**Fichiers** : `src/lib/middleware/api-middleware.ts` (MODIFIER)
**Effort** : XS
**Dépendances** : Aucune
**Test** : `pnpm test:run`

### Contexte
Le rate limiting utilise l'IP comme identifiant, même pour les routes authentifiées (M-03). Plusieurs utilisateurs derrière un NAT partagent le même bucket, et un attaquant peut contourner avec des IPs rotatives.

### Modifications

```tsx
// Dans api-middleware.ts, remplacer :
const rateLimitResult = await withRateLimit(request);

// Par :
const rateLimitResult = await withRateLimit(request, {
  userId: session?.user?.id,
});
```

### Vérification
1. `pnpm test:run` — OK
2. Utilisateur authentifié → rate limit basé sur userId, pas IP

---

## S9.7 — Ajouter les tests OAuth manquants

**Fichiers** : `src/lib/oauth/__tests__/auth-url.test.ts` (NOUVEAU), `src/lib/oauth/__tests__/encryption.test.ts` (NOUVEAU), `src/lib/oauth/__tests__/token-exchange.test.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : Aucune
**Test** : `pnpm test:run` — nouveaux tests passent

### Contexte
Le module OAuth (7 fichiers, ~1000 lignes) est 0% couvert par les tests. C'est le chemin le plus critique pour la sécurité (token exchange, encryption, refresh).

### Modifications

**1. Tester le chiffrement des tokens** :

```tsx
// src/lib/oauth/__tests__/encryption.test.ts
import { describe, expect, it } from "vitest";
import { encryptToken, decryptToken } from "../encryption";

describe("OAuth Token Encryption", () => {
  it("should encrypt and decrypt a token correctly", () => {
    const token = "my-secret-access-token-12345";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted).toContain(":"); // iv:ciphertext format

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it("should produce different ciphertexts for same plaintext (IV)", () => {
    const token = "constant-token";
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should throw on invalid ciphertext", () => {
    expect(() => decryptToken("invalid:format")).toThrow();
  });
});
```

**2. Tester les auth URLs** :

```tsx
// src/lib/oauth/__tests__/auth-url.test.ts
describe("OAuth Auth URLs", () => {
  it("should generate valid X/Twitter auth URL", () => { /* ... */ });
  it("should include state parameter for CSRF protection", () => { /* ... */ });
  it("should use correct scopes per platform", () => { /* ... */ });
});
```

**3. Tester le token exchange** :

```tsx
// src/lib/oauth/__tests__/token-exchange.test.ts
describe("OAuth Token Exchange", () => {
  it("should validate code before exchange", () => { /* ... */ });
  it("should handle provider error response", () => { /* ... */ });
  it("should persist tokens after exchange", () => { /* ... */ });
});
```

### Vérification
1. `pnpm test:run` — nouveaux tests OAuth passent
2. Coverage OAuth > 70%

---

## S9.8 — Correction des erreurs typecheck restantes

**Fichiers** : `src/lib/infrastructure/stripe.ts`, `src/lib/job-queue/handlers.ts`, `src/lib/observability/__tests__/logger.test.ts`, `src/lib/scheduling/optimizer.ts`, `src/lib/services/cgu-guard.ts`, `src/lib/services/publish-guard.ts`, `src/lib/utils/crypto.ts`
**Effort** : S
**Dépendances** : Aucune
**Test** : `pnpm typecheck` — 0 erreurs

### Contexte
Typecheck révèle ~10 erreurs préexistantes dans des fichiers non liés aux changements des sprints récents. Ces erreurs doivent être corrigées pour rétablir `pnpm typecheck` propre.

### Modifications

| Fichier | Erreur | Correction |
|---------|--------|------------|
| `stripe.ts` | `string \| null` non assignable à `string` | Ajouter `?? ""` ou `String()` |
| `handlers.ts:173` | `processVideoPipeline` inexistant | Vérifier l'import ou ajouter un guard |
| `logger.test.ts` | Types implicits `any` | Ajouter les annotations de type |
| `logger.test.ts:38` | `stdTimeFunctions` sur mock | Étendre le type du mock |
| `optimizer.ts:206` | `_dayOfWeek` non utilisé | Supprimer le préfixe `_` ou utiliser la variable |
| `cgu-guard.ts:50` | `_cguAccepted` non utilisé | Supprimer ou utiliser |
| `publish-guard.ts:67` | `{}` non assignable à `string` | Corriger le typage |
| `crypto.ts:31` | `string \| undefined` non assignable | Ajouter un default |

### Vérification
1. `pnpm typecheck` — 0 erreurs
2. `pnpm test:run` — 73 files pass

---

# 📋 RÉCAPITULATIF SPRINT 9

## Sprint 9 — Security Hardening + Queue Activation (~15 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S9.1 | `src/app/api/metrics/route.ts` | MODIFIER — Auth + label sanitization |
| S9.1 | `src/app/api/v1/queue/status/route.ts` | MODIFIER — Auth middleware |
| S9.1 | `src/lib/middleware/api-middleware.ts` | MODIFIER — Sanitize route labels |
| S9.2 | Multiples fichiers `src/` | MODIFIER — `console.*` → `logger.*` |
| S9.3 | `src/instrumentation.ts` | **NOUVEAU** — Worker startup |
| S9.4 | `src/lib/infrastructure/job-queue.ts` | **SUPPRIMER** — Dead code |
| S9.5 | `src/lib/job-queue/queue.ts` | MODIFIER — MAX_QUEUE_SIZE, archive trim |
| S9.5 | `src/lib/job-queue/worker.ts` | MODIFIER — Job timeout, remove `as any` |
| S9.5 | `src/lib/job-queue/handlers.ts` | MODIFIER — `any` → `JobPayload` |
| S9.6 | `src/lib/middleware/api-middleware.ts` | MODIFIER — Rate limit per-user |
| S9.7 | `src/lib/oauth/__tests__/*.test.ts` | **NOUVEAU** — 3 fichiers de test |
| S9.8 | `src/lib/infrastructure/stripe.ts` | MODIFIER — Null checks |
| S9.8 | `src/lib/scheduling/optimizer.ts` | MODIFIER — Unused variable |
| S9.8 | `src/lib/services/cgu-guard.ts` | MODIFIER — Unused variable |
| S9.8 | `src/lib/services/publish-guard.ts` | MODIFIER — Type mismatch |
| S9.8 | `src/lib/utils/crypto.ts` | MODIFIER — Null check |

---

# ✅ CHECKLIST DE LIVRAISON PAR SPRINT

## Sprint 9
- [ ] `/api/metrics` authentifié — 401 sans session
- [ ] Labels Prometheus sanitisés (pas d'IDs dans les labels)
- [ ] `/api/v1/queue/status` authentifié
- [ ] Aucun `console.*` dans `src/` (sauf tests)
- [ ] `startWorker()` appelé via `instrumentation.ts`
- [ ] `infrastructure/job-queue.ts` supprimé
- [ ] MAX_QUEUE_SIZE (10K) + timeout jobs (30s)
- [ ] Handler registry typé (`JobPayload` au lieu de `any`)
- [ ] Rate limiting per-user pour routes authentifiées
- [ ] Tests OAuth (>70% coverage)
- [ ] `pnpm typecheck` — 0 erreurs
- [ ] `pnpm test:run` — 73+ files pass

---

# 🔗 DÉPENDANCES ENTRE SPRINTS

```
Sprint 9 (Security + Queue Activation) — Sprint 8 (observability, logger),
  Sprint 7 (metrics endpoint), Sprint 6 (job queue)
```

## Ordre recommandé d'exécution

```
Sprint 9.1 (Metrics auth) ─┐
Sprint 9.2 (Console sweep) ─┤  (peuvent être parallélisés)
Sprint 9.6 (Rate limit) ────┤
                           │
Sprint 9.3 (Worker) ─────────┤  (dépend de 9.1-9.2 pour logger)
Sprint 9.4 (Dead code) ─────┤  (dépend du fix module resolution, déjà fait)
Sprint 9.5 (Hardening) ─────┤  (dépend de 9.3 pour le worker)
                           │
Sprint 9.7 (OAuth tests) ───────┤  (indépendant)
Sprint 9.8 (Typecheck fixes) ───┤  (indépendant)
```

---

# 🚀 SPRINT 10 — AI Content Generation (semaine 13-16)

---

## S10.1 — Provider LLM : abstraction OpenAI/Anthropic

**Fichiers** : `src/lib/llm/provider.ts` (NOUVEAU), `src/lib/llm/types.ts` (NOUVEAU), `src/lib/llm/index.ts` (NOUVEAU), `src/lib/llm/__tests__/provider.test.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 3 (agent service), Sprint 9 (queue activée)
**Test** : `pnpm test:run` — tests LLM provider mockés

### Contexte
`src/lib/llm.ts` existe déjà mais est un fichier unique avec une intégration basique. Il faut le structurer en module avec support multi-provider (OpenAI, Anthropic) et fallback.

### Modifications

**1. Définir les types** (`src/lib/llm/types.ts`) :

```ts
export type LLMProvider = "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  config?: Partial<LLMConfig>;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface LLMError {
  code: string;
  message: string;
  retryable: boolean;
}
```

**2. Créer le provider** (`src/lib/llm/provider.ts`) :

```ts
// Provider LLM avec support OpenAI + Anthropic + fallback
// OpenAI via @langchain/openai ou openai SDK
// Anthropic via @langchain/anthropic ou @anthropic-ai/sdk

export async function generateText(request: LLMRequest): Promise<LLMResponse> {
  const config = resolveConfig(request.config);

  // Tentative avec le provider principal, fallback sur le secondaire
  const providers = [config.provider, config.provider === "openai" ? "anthropic" : "openai"];

  for (const provider of providers) {
    try {
      return await callProvider(provider as LLMProvider, request.messages, config);
    } catch (error) {
      logger.warn({ err: error, provider }, "LLM provider failed, trying fallback");
    }
  }

  throw new Error("All LLM providers failed");
}
```

**3. Barrel export** (`src/lib/llm/index.ts`) :

```ts
export { generateText } from "./provider";
export type { LLMConfig, LLMMessage, LLMRequest, LLMResponse, LLMProvider, LLMError } from "./types";
```

**4. Tests mockés** (`src/lib/llm/__tests__/provider.test.ts`) :
- Tester l'appel OpenAI avec mock
- Tester l'appel Anthropic avec mock
- Tester le fallback automatique si le provider principal échoue
- Tester la gestion d'erreur (rate limit, timeout, auth)
- Tester la configuration par défaut

### Vérification
1. `pnpm test:run` — nouveaux tests LLM passent
2. Provider principal → réponse générée
3. Provider principal down → fallback automatique

---

## S10.2 — Templates de prompt par plateforme

**Fichiers** : `src/lib/content/prompts/index.ts` (NOUVEAU), `src/lib/content/prompts/platforms/x.ts` (NOUVEAU), `src/lib/content/prompts/platforms/linkedin.ts` (NOUVEAU), `src/lib/content/prompts/platforms/instagram.ts` (NOUVEAU), `src/lib/content/prompts/platforms/tiktok.ts` (NOUVEAU), `src/lib/content/prompts/platforms/facebook.ts` (NOUVEAU), `src/lib/content/prompts/platforms/threads.ts` (NOUVEAU), `src/lib/content/prompts/platforms/pinterest.ts` (NOUVEAU), `src/lib/content/prompts/platforms/youtube.ts` (NOUVEAU), `src/lib/content/prompts/__tests__/prompts.test.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : S10.1
**Test** : Tests unitaires des templates

### Contexte
Chaque plateforme a son propre format, ton et limites (char max, hashtags, médias). Les templates doivent produire un prompt system + user optimisé pour chaque plateforme.

### Modifications

**1. Template system commun** :

```ts
const SYSTEM_PROMPT_BASE = `You are a professional social media content creator.
Generate engaging, platform-optimized content based on the brief provided.
Follow the specific format, tone, and constraints for the target platform.
Use the brand voice: professional but approachable, authentic, value-driven.
Avoid: clickbait, misleading claims, overused hashtags, generic advice.`;
```

**2. Templates par plateforme** (exemple X/Twitter) :

```ts
// src/lib/content/prompts/platforms/x.ts
export const X_PROMPT = {
  system: `${SYSTEM_PROMPT_BASE}
Platform: X (Twitter)
Style: Concise, witty, opinion-led
Max length: 280 characters (hard limit)
Hashtags: 1-2 max
Tone: Conversational, thought-leadership
Best practices: Hook in first 50 chars, add value, encourage engagement
Structure: Hook → Insight → CTA (optional)`,
  
  buildUserPrompt(brief: string, keywords?: string[]): string {
    return `Create an X post about: ${brief}
${keywords?.length ? `Include these keywords naturally: ${keywords.join(", ")}` : ""}
Remember: max 280 characters, 1-2 hashtags max.`;
  },
};
```

**3. Template LinkedIn** :

```ts
export const LINKEDIN_PROMPT = {
  system: `${SYSTEM_PROMPT_BASE}
Platform: LinkedIn
Style: Professional, insightful, story-driven
Max length: 3000 characters
Hashtags: 3-5 max
Tone: Authoritative, personal, industry-aware
Best practices: Start with a hook, use line breaks, share lessons/insights
Structure: Hook → Context → Insight → Lesson → CTA`,
  
  buildUserPrompt(brief: string, keywords?: string[]): string {
    return `Create a LinkedIn post about: ${brief}
${keywords?.length ? `Include these keywords: ${keywords.join(", ")}` : ""}
Format with line breaks, 3-5 hashtags, professional tone.`;
  },
};
```

**4. Barrel + resolveur** :

```ts
// src/lib/content/prompts/index.ts
import { Platform } from "@prisma/client";
import { X_PROMPT } from "./platforms/x";
import { LINKEDIN_PROMPT } from "./platforms/linkedin";
import { INSTAGRAM_PROMPT } from "./platforms/instagram";
// ... autres plateformes

const promptMap: Record<string, typeof X_PROMPT> = {
  X: X_PROMPT,
  LINKEDIN: LINKEDIN_PROMPT,
  INSTAGRAM: INSTAGRAM_PROMPT,
  TIKTOK: TIKTOK_PROMPT,
  FACEBOOK: FACEBOOK_PROMPT,
  THREADS: THREADS_PROMPT,
  PINTEREST: PINTEREST_PROMPT,
  YOUTUBE: YOUTUBE_PROMPT,
};

export function getPromptForPlatform(platform: Platform) {
  const prompt = promptMap[platform];
  if (!prompt) throw new Error(`No prompt template for platform: ${platform}`);
  return prompt;
}
```

**5. Tests** :
- Chaque template produit un system prompt valide
- `buildUserPrompt` inclut le brief et les keywords
- `getPromptForPlatform` retourne le bon template
- Plateforme inconnue → erreur
- Respect des limites (char max X: 280, LinkedIn: 3000, etc.)

### Vérification
1. `pnpm test:run` — tests templates passent
2. Chaque plateforme a un template distinct
3. Les limites de caractères sont respectées

---

## S10.3 — Handler LLM pour le job-queue

**Fichiers** : `src/lib/job-queue/handlers.ts` (MODIFIER), `src/lib/content/generator.ts` (NOUVEAU), `src/lib/content/__tests__/generator.test.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : S10.1, S10.2
**Test** : Job enqueue → handler LLM → contenu généré en base

### Contexte
Le handler `content-generate` actuel crée un dummy content :
```ts
textContent: `Generated content for ${payload.platform}: ${payload.brief}`,
```
Il faut le remplacer par un vrai appel LLM avec les templates.

### Modifications

**1. Service de génération** (`src/lib/content/generator.ts`) :

```ts
import { generateText } from "@/lib/llm";
import { getPromptForPlatform } from "@/lib/content/prompts";
import { getRepositories } from "@/lib/repositories";
import type { Platform } from "@prisma/client";

export interface GenerateContentInput {
  profileId: string;
  platform: Platform;
  brief: string;
  keywords?: string[];
  agentId?: string;
}

export async function generateAndSaveContent(input: GenerateContentInput) {
  const { content: contentRepo } = getRepositories();
  const prompt = getPromptForPlatform(input.platform);

  const response = await generateText({
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.buildUserPrompt(input.brief, input.keywords) },
    ],
    config: { temperature: 0.7, maxTokens: 1024 },
  });

  // Analyser la réponse : extraire textContent, hashtags, mediaUrls
  const parsed = parseLLMResponse(response.content, input.platform);

  // Sauvegarder en DRAFT
  const content = await contentRepo.create({
    profileId: input.profileId,
    platform: input.platform,
    textContent: parsed.textContent,
    mediaUrls: parsed.mediaUrls,
    hashtags: parsed.hashtags,
    status: "DRAFT",
    runId: input.agentId ? crypto.randomUUID() : null,
  });

  logger.info(
    { contentId: content.id, platform: input.platform, tokens: response.usage },
    "AI content generated and saved",
  );

  return content;
}
```

**2. Mettre à jour le handler** (`src/lib/job-queue/handlers.ts`) :

```ts
// Remplacer le handler "content-generate" existant
registerHandler("content-generate", async (payload: ContentGeneratePayload) => {
  logger.info(
    { profileId: payload.profileId, platform: payload.platform, brief: payload.brief },
    "Processing AI content generation",
  );

  const result = await generateAndSaveContent({
    profileId: payload.profileId,
    platform: payload.platform,
    brief: payload.brief,
    agentId: payload.agentId,
  });

  logger.info({ contentId: result.id }, "AI content generated successfully");
});
```

**3. Tests** (`src/lib/content/__tests__/generator.test.ts`) :
- Mock LLM generateText
- Mock repository
- Vérifier que le contenu généré est sauvegardé en DRAFT
- Tester le parsing de la réponse LLM (extraction hashtags, urls)
- Tester la gestion d'erreur LLM

### Vérification
1. `pnpm test:run` — tests générateur passent
2. Enqueue d'un job content-generate → contenu créé en base
3. Le contenu utilise le vrai LLM (pas de dummy text)

---

## S10.4 — API de génération de contenu

**Fichiers** : `src/app/api/v1/content/generate/route.ts` (NOUVEAU), `src/lib/validations/generate.ts` (NOUVEAU)
**Effort** : S
**Dépendances** : S10.3
**Test** : `curl POST /api/v1/content/generate` → body avec generatedContent[]

### Contexte
Il faut une API pour déclencher la génération depuis l'UI. L'API accepte un brief + plateforme(s) et enqueue un job. Elle peut être synchrone (pour une seule génération) ou asynchrone (via la queue).

### Modifications

**1. Validation Zod** :

```ts
// src/lib/validations/generate.ts
import { z } from "zod";

export const GenerateContentSchema = z.object({
  profileId: z.string().min(1),
  platform: z.enum(["X", "LINKEDIN", "INSTAGRAM", "TIKTOK", "FACEBOOK", "THREADS", "PINTEREST", "YOUTUBE"]),
  brief: z.string().min(10, "Brief must be at least 10 characters").max(2000),
  keywords: z.array(z.string()).max(10).optional(),
  count: z.number().int().min(1).max(5).optional().default(1),
});
```

**2. Route API** :

```ts
// src/app/api/v1/content/generate/route.ts
import { NextResponse } from "next/server";
import { withApiMiddleware } from "@/lib/middleware/api-middleware";
import { generateAndSaveContent } from "@/lib/content/generator";
import { GenerateContentSchema } from "@/lib/validations/generate";

export const POST = withApiMiddleware(async ({ userId, request }) => {
  const body = await request.json();
  const parsed = GenerateContentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { profileId, platform, brief, keywords, count } = parsed.data;

  // Vérifier l'appartenance du profile
  const { profile: profileRepo } = await import("@/lib/repositories");
  const profile = await profileRepo.findById(profileId);
  if (!profile || profile.userId !== userId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    const content = await generateAndSaveContent({ profileId, platform, brief, keywords });
    results.push(content);
  }

  return NextResponse.json({ generated: results }, { status: 201 });
});
```

### Vérification
1. `POST /api/v1/content/generate` avec body valide → 201 + generatedContent[]
2. `POST /api/v1/content/generate` avec brief < 10 chars → 422
3. `POST /api/v1/content/generate` sur profile d'un autre user → 404
4. `pnpm test:run` — tests API passent

---

## S10.5 — UI de génération : panneau de configuration

**Fichiers** : `src/components/content/generation-panel.tsx` (NOUVEAU), `src/components/content/generation-result.tsx` (NOUVEAU), `src/app/(main)/content/generate/page.tsx` (NOUVEAU), `src/components/content/__tests__/generation-panel.test.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : S10.4
**Test** : Rendu UI, soumission du formulaire, affichage des résultats

### Contexte
Interface utilisateur pour la génération de contenu : sélection du profil + plateforme, saisie du brief, bouton de génération, et affichage des résultats (avec possibilité de modifier avant de publier).

### Modifications

**1. Composant GenerationPanel** :

```tsx
"use client";

import { useState } from "react";
import { Card } from "@socialcreator/ui/card";
import { Button } from "@socialcreator/ui/button";
import { Textarea } from "@socialcreator/ui/textarea";
import { Select, SelectItem } from "@socialcreator/ui/select";
import { Spinner } from "@socialcreator/ui/spinner";
import { GenerationResult } from "./generation-result";
import type { Platform } from "@prisma/client";

interface Profile { id: string; name: string; platform: Platform; }

export function GenerationPanel({ profiles }: { profiles: Profile[] }) {
  const [selectedProfile, setSelectedProfile] = useState("");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!selectedProfile || !brief) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedProfile, platform: profiles.find(p => p.id === selectedProfile)?.platform, brief }),
      });
      if (!res.ok) { const err = await res.json(); setError(err.error || "Generation failed"); return; }
      const data = await res.json();
      setResults(data.generated);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h2 className="text-title-md font-semibold">Generate Content</h2>

        <Select value={selectedProfile} onChange={setSelectedProfile} label="Profile">
          {profiles.map(p => (
            <SelectItem key={p.id} value={p.id}>{p.name} ({p.platform})</SelectItem>
          ))}
        </Select>

        <Textarea
          value={brief}
          onChange={setBrief}
          label="Content Brief"
          placeholder="Describe what you want to post..."
          rows={4}
          maxLength={2000}
        />

        <Button onClick={handleGenerate} disabled={loading || !selectedProfile || !brief}>
          {loading ? <Spinner /> : "Generate"}
        </Button>

        {error && <p className="text-semantic-error text-body-sm">{error}</p>}
      </Card>

      {results.map(r => <GenerationResult key={r.id} content={r} />)}
    </div>
  );
}
```

**2. Composant GenerationResult** :

```tsx
// Affiche le contenu généré avec options : éditer, régénérer, publier, programmée
// Champs : textContent éditable, hashtags en tags, mediaUrls, status badge
// Actions : Save as Draft, Schedule, Publish, Regenerate
```

**3. Page dédiée** (`/content/generate`) :

```tsx
export default function GeneratePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  useEffect(() => {
    fetch("/api/v1/profiles").then(r => r.json()).then(setProfiles);
  }, []);
  return <GenerationPanel profiles={profiles} />;
}
```

### Vérification
1. Rendu du panneau avec sélecteur de profil + textarea
2. Soumission → loading state → résultats affichés
3. Gestion des erreurs (réseau, validation)
4. `pnpm test:run` — tests UI passent

---

## S10.6 — Éditeur de contenu généré (brouillon → publication)

**Fichiers** : `src/components/content/content-editor.tsx` (NOUVEAU), `src/app/api/v1/content/[id]/route.ts` (MODIFIER — ajouter PUT), `src/components/content/__tests__/content-editor.test.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : S10.5 (UI génération)
**Test** : Éditer un contenu généré → sauvegarder → publier

### Contexte
Le contenu généré par LLM est rarement parfait. Il faut permettre à l'utilisateur de modifier le texte, les hashtags, ajouter des médias, puis programmer ou publier.

### Modifications

**1. ContentEditor** :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@socialcreator/ui/card";
import { Button } from "@socialcreator/ui/button";
import { Textarea } from "@socialcreator/ui/textarea";
import { Input } from "@socialcreator/ui/input";

interface ContentEditorProps {
  content: {
    id: string;
    textContent: string;
    hashtags: string[];
    mediaUrls: string[];
    platform: string;
    status: string;
  };
  onSave?: (content: typeof content) => void;
}

export function ContentEditor({ content: initial, onSave }: ContentEditorProps) {
  const [text, setText] = useState(initial.textContent);
  const [hashtags, setHashtags] = useState(initial.hashtags.join(" "));
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/content/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textContent: text,
          hashtags: hashtags.split(" ").filter(Boolean),
        }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      onSave?.(updated);
      router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-title-sm font-semibold">Edit Content</h3>
        <span className="text-caption text-muted">{initial.platform} · {text.length} chars</span>
      </div>

      <Textarea value={text} onChange={setText} rows={6} maxLength={3000} />
      <Input value={hashtags} onChange={setHashtags} label="Hashtags" placeholder="#tag1 #tag2" />

      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Save Draft</Button>
        <Button variant="primary" onClick={() => { /* schedule modal */ }}>Schedule</Button>
        <Button variant="primary" onClick={() => { /* publish */ }}>Publish Now</Button>
      </div>
    </Card>
  );
}
```

**2. API PUT** : Ajouter la méthode PUT à la route existante `src/app/api/v1/content/[id]/route.ts` pour mettre à jour content + hashtags.

### Vérification
1. Contenu généré → éditable → sauvegardé
2. Hashtags modifiables
3. Status badges: DRAFT → SCHEDULED → PUBLISHED
4. `pnpm test:run` — tests éditeur passent

---

## S10.7 — Rate limiting et quota LLM

**Fichiers** : `src/lib/llm/rate-limiter.ts` (NOUVEAU), `src/lib/llm/__tests__/rate-limiter.test.ts` (NOUVEAU)
**Effort** : S
**Dépendances** : S10.1
**Test** : Appels API LLM limités par utilisateur/temps

### Contexte
Les appels LLM coûtent de l'argent. Il faut limiter le nombre de générations par utilisateur (ex: 50/jour pour le plan gratuit, illimité pour le plan pro). Le système d'entitlements existe déjà dans `src/lib/entitlements/`.

### Modifications

**1. Rate limiter LLM** :

```ts
// src/lib/llm/rate-limiter.ts
import { getRedis } from "@/lib/infrastructure/redis";

const FREE_TIER_DAILY_LIMIT = 50;
const PRO_TIER_DAILY_LIMIT = 500;

export async function checkGenerationQuota(userId: string, plan: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const redis = getRedis();
  if (!redis) return { allowed: true, remaining: 999, resetAt: new Date() };

  const key = `llm:quota:${userId}:${new Date().toISOString().split("T")[0]}`;
  const current = await redis.incr(key);
  
  if (current === 1) await redis.expire(key, 86400); // 24h TTL

  const limit = plan === "pro" ? PRO_TIER_DAILY_LIMIT : FREE_TIER_DAILY_LIMIT;
  const allowed = current <= limit;

  return { allowed, remaining: Math.max(0, limit - current), resetAt: new Date(Date.now() + 86400000) };
}
```

**2. Intégrer dans le handler** :

```ts
// Dans handler content-generate, avant l'appel LLM :
const quota = await checkGenerationQuota(userId, userPlan);
if (!quota.allowed) {
  throw new Error(`Daily generation quota exceeded. Remaining: ${quota.remaining}`);
}
```

### Vérification
1. Quota non dépassé → génération autorisée
2. Quota dépassé → erreur "quota exceeded"
3. Reset quotidien fonctionnel
4. `pnpm test:run` — tests rate-limiter passent

---

## S10.8 — Génération multiple (batch par planning)

**Fichiers** : `src/app/api/v1/content/generate/batch/route.ts` (NOUVEAU), `src/lib/content/batch-generator.ts` (NOUVEAU)
**Effort** : S
**Dépendances** : S10.4
**Test** : `POST /api/v1/content/generate/batch` → génère X contenus pour Y plateformes

### Contexte
L'utilisateur veut générer du contenu pour une semaine : 7 posts X, 3 LinkedIn, 5 Instagram en un clic. Le batch generator enqueue des jobs individuels et retourne un status.

### Modifications

**1. Batch Generator** :

```ts
// src/lib/content/batch-generator.ts
export interface BatchRequest {
  profileId: string;
  platforms: Platform[];
  briefs: string[]; // Un brief par jour de la semaine
}

export async function enqueueBatchGeneration(input: BatchRequest): Promise<string[]> {
  const contentIds: string[] = [];

  for (const platform of input.platforms) {
    for (const brief of input.briefs) {
      const id = enqueueJob("content-generate", {
        profileId: input.profileId,
        platform,
        brief,
      } satisfies ContentGeneratePayload, { priority: "normal" });
      contentIds.push(id);
    }
  }

  return contentIds;
}
```

**2. Route batch** :

```ts
// POST /api/v1/content/generate/batch
// Body: { profileId, platforms: ["X", "LINKEDIN"], briefs: ["brief1", "brief2", ...] }
// Response: { enqueued: number, jobIds: string[] }
```

### Vérification
1. Batch de 10 contenus → 10 jobs enqueués
2. Status de chaque job traçable via queue
3. `pnpm test:run` — tests batch passent

---

# 📋 RÉCAPITULATIF SPRINT 10

## Sprint 10 — AI Content Generation (~25 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S10.1 | `src/lib/llm/provider.ts` | **NOUVEAU** — Provider LLM OpenAI/Anthropic |
| S10.1 | `src/lib/llm/types.ts` | **NOUVEAU** — Types LLM |
| S10.1 | `src/lib/llm/index.ts` | **NOUVEAU** — Barrel |
| S10.1 | `src/lib/llm/__tests__/provider.test.ts` | **NOUVEAU** — Tests provider |
| S10.2 | `src/lib/content/prompts/platforms/*.ts` | **NOUVEAU** — 8 templates plateforme |
| S10.2 | `src/lib/content/prompts/index.ts` | **NOUVEAU** — Resolveur de templates |
| S10.2 | `src/lib/content/prompts/__tests__/prompts.test.ts` | **NOUVEAU** — Tests templates |
| S10.3 | `src/lib/content/generator.ts` | **NOUVEAU** — Service génération |
| S10.3 | `src/lib/job-queue/handlers.ts` | MODIFIER — Handler content-generate LLM |
| S10.3 | `src/lib/content/__tests__/generator.test.ts` | **NOUVEAU** — Tests générateur |
| S10.4 | `src/app/api/v1/content/generate/route.ts` | **NOUVEAU** — API génération |
| S10.4 | `src/lib/validations/generate.ts` | **NOUVEAU** — Validation Zod |
| S10.5 | `src/components/content/generation-panel.tsx` | **NOUVEAU** — UI génération |
| S10.5 | `src/components/content/generation-result.tsx` | **NOUVEAU** — UI résultat |
| S10.5 | `src/app/(main)/content/generate/page.tsx` | **NOUVEAU** — Page génération |
| S10.6 | `src/components/content/content-editor.tsx` | **NOUVEAU** — Éditeur |
| S10.6 | `src/app/api/v1/content/[id]/route.ts` | MODIFIER — PUT update |
| S10.7 | `src/lib/llm/rate-limiter.ts` | **NOUVEAU** — Rate limiter LLM |
| S10.7 | `src/lib/llm/__tests__/rate-limiter.test.ts` | **NOUVEAU** — Tests rate limiter |
| S10.8 | `src/app/api/v1/content/generate/batch/route.ts` | **NOUVEAU** — API batch |
| S10.8 | `src/lib/content/batch-generator.ts` | **NOUVEAU** — Batch service |
| — | `src/app/(main)/sidebar.tsx` | MODIFIER — Ajouter lien "Generate" |

---

# ✅ CHECKLIST SPRINT 10

- [ ] Provider LLM fonctionnel avec fallback Anthropic ↔ OpenAI
- [ ] Template de prompt par plateforme (8 plateformes)
- [ ] Handler content-generate utilise le vrai LLM
- [ ] API `POST /api/v1/content/generate` — 201 avec generatedContent
- [ ] UI GenerationPanel avec sélecteur profil + brief + bouton
- [ ] ContentEditor : modifier hashtags, text, sauvegarder
- [ ] Quota LLM : 50/jour free, 500/jour pro
- [ ] Batch generation : 1 clic = semaine de contenu
- [ ] `pnpm test:run` — 80+ files pass
- [ ] `pnpm typecheck` — 0 erreurs dans les fichiers modifiés

---

# 🚀 SPRINT 11 — Advanced Analytics (semaine 17-19)

---

## S11.1 — Dashboard analytics enrichi avec Zeitgeist

**Fichiers** : `src/app/api/v1/analytics/insights/route.ts` (NOUVEAU), `src/lib/analytics/insights.ts` (NOUVEAU), `src/components/dashboard/insights-grid.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 7 (dashboard basique)
**Test** : Dashboard avec métriques avancées (engagement, reach, trend)

### Contexte
Le dashboard actuel (Sprint 7) montre 4 stats basiques (profiles, total content, published, today). Il faut ajouter des KPIs plus poussés : engagement rate, reach, best time to post, content mix, etc. Les données sont déjà dans `PublishLog`, `Analytics` et `Content`.

### Modifications

**1. Service d'insights** (`src/lib/analytics/insights.ts`) :

```ts
export interface AnalyticsInsights {
  overview: {
    totalPublished: number;
    totalDrafts: number;
    totalFailed: number;
    successRate: number;
  };
  engagement: {
    avgEngagementRate: number;
    topPlatform: Platform | null;
    bestTimeToPost: string; // ex: "14:00-16:00"
    trendingKeywords: string[];
  };
  publishing: {
    frequencyPerDay: number;
    mostActiveDay: string; // ex: "Wednesday"
    peakHour: number;
    platformMix: Record<Platform, number>;
  };
  comparison: {
    vsLastWeek: number; // % change
    vsLastMonth: number;
    trend: "up" | "down" | "stable";
  };
}

export async function getAnalyticsInsights(userId: string, days: number = 30): Promise<AnalyticsInsights> {
  // Aggréger depuis PublishLog, Analytics, Content
  const { publishLog: plRepo, analytics: aRepo, content: cRepo } = getRepositories();
  
  const publishLogs = await plRepo.findByUserId(userId, { pageSize: 1000 });
  const analyticEvents = await aRepo.findByUserId(userId, days);
  const contents = await cRepo.findByUserId(userId);
  
  return {
    overview: computeOverview(publishLogs, contents),
    engagement: computeEngagement(analyticEvents, publishLogs),
    publishing: computePublishingFrequency(publishLogs),
    comparison: computeComparison(publishLogs, days),
  };
}
```

**2. Route API** : `GET /api/v1/analytics/insights?days=30` — retourne AnalyticsInsights

**3. Composant InsightsGrid** (grille de cartes avec métriques + tendances)

### Vérification
1. Dashboard enrichi avec 12+ indicateurs
2. Tendances (vs semaine dernière, vs mois dernier)
3. `pnpm test:run` — tests insights passent

---

## S11.2 — Export CSV des analytics

**Fichiers** : `src/app/api/v1/analytics/export/csv/route.ts` (NOUVEAU), `src/lib/analytics/export-csv.ts` (NOUVEAU)
**Effort** : S
**Dépendances** : S11.1
**Test** : `GET /api/v1/analytics/export/csv?from=2026-01-01&to=2026-06-01` → CSV valide

### Contexte
Les utilisateurs veulent exporter leurs stats pour les partager ou les analyser dans Excel/Google Sheets.

### Modifications

**1. Service d'export CSV** :

```ts
// src/lib/analytics/export-csv.ts
export async function exportPublishLogsCSV(userId: string, from: Date, to: Date): Promise<string> {
  const { publishLog } = getRepositories();
  const logs = await publishLog.findByUserId(userId, { pageSize: 10000 });

  const headers = ["Date", "Platform", "Status", "Content ID", "Error"];
  const rows = logs.logs
    .filter(l => l.createdAt >= from && l.createdAt <= to)
    .map(l => [
      l.createdAt.toISOString(),
      l.platform,
      l.success ? "Published" : "Failed",
      l.contentId,
      l.error || "",
    ].join(","));

  return [headers.join(","), ...rows].join("\n");
}
```

**2. Route** :

```ts
// GET /api/v1/analytics/export/csv?from=...&to=...
// Headers: Content-Type: text/csv, Content-Disposition: attachment; filename="analytics.csv"
```

### Vérification
1. CSV valide téléchargeable
2. Filtre par date fonctionnel
3. `pnpm test:run` — tests export passent

---

## S11.3 — Export PDF des rapports

**Fichiers** : `src/app/api/v1/analytics/export/pdf/route.ts` (NOUVEAU), `src/lib/analytics/export-pdf.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : S11.2
**Test** : `GET /api/v1/analytics/export/pdf` → PDF bien formaté

### Contexte
Le CSV c'est bien, mais les managers veulent un rapport PDF présentable avec graphiques, tableaux et synthèse.

### Modifications

**1. Service PDF** (utilisation de `@react-pdf/renderer` ou `puppeteer`) :

```ts
// src/lib/analytics/export-pdf.ts
// Générer un rapport PDF avec :
// - Header : période, nom de l'utilisateur
// - Section 1 : KPIs clés (total posts, taux de succès, engagement rate)
// - Section 2 : Graphique barres (publications par jour)
// - Section 3 : Top plateformes (pie chart)
// - Section 4 : Tendances vs période précédente
// - Footer : généré le, page X/Y
```

**2. Route** : `GET /api/v1/analytics/export/pdf?from=...&to=...` → PDF streamé

**Choix technique** : utiliser `@react-pdf/renderer` (render côté serveur, pas de dépendance lourde) plutôt que Puppeteer (plus lourd mais plus flexible).

### Vérification
1. PDF téléchargeable avec sections complètes
2. Graphiques visibles
3. `pnpm test:run` — tests PDF passent

---

## S11.4 — Métriques par plateforme (comparaison)

**Fichiers** : `src/app/api/v1/analytics/platforms/route.ts` (NOUVEAU), `src/components/analytics/platform-comparison.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : S11.1
**Test** : Comparaison X vs LinkedIn vs Instagram en un coup d'œil

### Contexte
L'utilisateur publie sur plusieurs plateformes. Il veut savoir laquelle performe le mieux, où investir son temps, et quel type de contenu fonctionne où.

### Modifications

**1. API comparaison** : `GET /api/v1/analytics/platforms?days=30`

```ts
// Retourne :
{
  platforms: {
    X: { posts: 45, successRate: 93%, avgEngagement: 2.1% },
    LINKEDIN: { posts: 12, successRate: 100%, avgEngagement: 4.5% },
    INSTAGRAM: { posts: 30, successRate: 87%, avgEngagement: 3.2% },
  },
  bestPerformer: "LINKEDIN",
  recommendations: ["Increase LinkedIn posting frequency", "Review Instagram failures"]
}
```

**2. Composant PlatformComparison** : Tableau comparatif + highlights

### Vérification
1. Comparaison claire X vs LinkedIn vs Instagram etc.
2. Recommandations automatiques générées
3. `pnpm test:run` — OK

---

## S11.5 — Meilleur moment de publication (ML léger)

**Fichiers** : `src/lib/scheduling/optimizer.ts` (MODIFIER), `src/app/api/v1/analytics/best-time/route.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 5 (scheduling)
**Test** : Recommandation du meilleur créneau basé sur l'historique

### Contexte
Le module `src/lib/scheduling/optimizer.ts` existe déjà avec des heuristiques basiques. Il faut le nourrir avec les vraies données d'engagement pour produire des recommandations personnalisées.

### Modifications

**1. Analyser l'historique de publications** :

```ts
// 1. Récupérer les PublishLog avec success=true
// 2. Grouper par heure de publication (tranches de 2h)
// 3. Calculer le taux de succès + engagement par créneau
// 4. Retourner le top 3 créneaux par plateforme

export interface BestTimeSlot {
  platform: Platform;
  dayOfWeek: string; // "Monday"
  startHour: number; // 14
  endHour: number; // 16
  confidence: number; // 0-1 basé sur le volume de données
}

export async function getBestTimeSlots(userId: string): Promise<BestTimeSlot[]> {
  // Aggréger les données d'engagement par jour + heure
  // Retourner les meilleurs créneaux avec un score de confiance
}
```

**2. Route API** : `GET /api/v1/analytics/best-time` → crénaux recommandés

### Vérification
1. Recommandation basée sur l'historique réel (pas des heuristiques)
2. Score de confiance basé sur le volume de données
3. `pnpm test:run` — tests optimizer passent

---

# 📋 RÉCAPITULATIF SPRINT 11

## Sprint 11 — Advanced Analytics (~18 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S11.1 | `src/lib/analytics/insights.ts` | **NOUVEAU** — Service insights |
| S11.1 | `src/app/api/v1/analytics/insights/route.ts` | **NOUVEAU** — API insights |
| S11.1 | `src/components/dashboard/insights-grid.tsx` | **NOUVEAU** — UI insights |
| S11.2 | `src/lib/analytics/export-csv.ts` | **NOUVEAU** — Export CSV |
| S11.2 | `src/app/api/v1/analytics/export/csv/route.ts` | **NOUVEAU** — API CSV |
| S11.3 | `src/lib/analytics/export-pdf.ts` | **NOUVEAU** — Export PDF |
| S11.3 | `src/app/api/v1/analytics/export/pdf/route.ts` | **NOUVEAU** — API PDF |
| S11.4 | `src/app/api/v1/analytics/platforms/route.ts` | **NOUVEAU** — API comparaison |
| S11.4 | `src/components/analytics/platform-comparison.tsx` | **NOUVEAU** — UI comparaison |
| S11.5 | `src/lib/scheduling/optimizer.ts` | MODIFIER — ML léger |
| S11.5 | `src/app/api/v1/analytics/best-time/route.ts` | **NOUVEAU** — API best time |

---

# ✅ CHECKLIST SPRINT 11

- [ ] Dashboard enrichi avec 12+ indicateurs et tendances
- [ ] Export CSV fonctionnel avec filtre date
- [ ] Export PDF avec graphiques et sections
- [ ] Comparaison plateforme X vs LinkedIn vs Instagram
- [ ] Meilleur moment de publication basé sur données réelles
- [ ] `pnpm test:run` — 85+ files pass

---

# 🚀 SPRINT 12 — Team Collaboration (semaine 20-25)

---

## S12.1 — Backend équipes : CRUD + invitations

**Fichiers** : `src/app/api/teams/[teamId]/route.ts` (MODIFIER), `src/app/api/teams/[teamId]/invite/route.ts` (MODIFIER), `src/lib/services/team.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : Sprint 4 (auth), Sprint 3 (repositories)
**Test** : Créer une équipe → inviter → membre accepte → accès partagé

### Contexte
Le schéma Prisma a déjà `Team`, `TeamMember`, `TeamRole` mais les routes API sont incomplètes. Il faut finaliser le CRUD, les invitations par email, et les rôles (owner, admin, member, viewer).

### Modifications

**1. Service Team** :

```ts
// src/lib/services/team.ts
export type TeamRole = "owner" | "admin" | "member" | "viewer";

export async function createTeam(name: string, userId: string): Promise<Team> {
  // Créer l'équipe + ajouter le créateur comme owner
}

export async function inviteMember(teamId: string, email: string, role: TeamRole, invitedBy: string): Promise<void> {
  // Vérifier que l'inviteur a les droits (admin+)
  // Créer une invitation (expire dans 7 jours)
  // Envoyer un email (ou notification in-app)
}

export async function acceptInvite(token: string, userId: string): Promise<void> {
  // Valider le token, vérifier expiration
  // Ajouter le membre à l'équipe
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  // Retourner les membres avec leurs rôles
}

export async function updateMemberRole(teamId: string, memberId: string, role: TeamRole, updatedBy: string): Promise<void> {
  // Vérifier les permissions, mettre à jour le rôle
}

export async function removeMember(teamId: string, memberId: string, removedBy: string): Promise<void> {
  // Vérifier les permissions (admin+, ne pas pouvoir retirer un owner)
}
```

### Vérification
1. Création équipe → OK
2. Invitation par email → token généré
3. Acceptation invitation → membre ajouté
4. Gestion des rôles fonctionnelle
5. `pnpm test:run` — tests team service passent

---

## S12.2 — Middleware de permissions par équipe

**Fichiers** : `src/lib/middleware/team-permissions.ts` (NOUVEAU), `src/lib/middleware/__tests__/team-permissions.test.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : S12.1
**Test** : `withTeamAccess` bloque les accès non autorisés

### Contexte
Actuellement, `ownership.ts` vérifie que l'utilisateur est le propriétaire. Avec les équipes, il faut aussi permettre aux membres d'accéder aux resources. Il faut un middleware `withTeamAccess` qui checke si l'utilisateur est owner OU membre de l'équipe qui possède la resource.

### Modifications

**1. Middleware withTeamAccess** :

```ts
// src/lib/middleware/team-permissions.ts
type Permission = "read" | "write" | "admin";

const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  owner: ["read", "write", "admin"],
  admin: ["read", "write", "admin"],
  member: ["read", "write"],
  viewer: ["read"],
};

export async function withTeamAccess(
  teamId: string,
  userId: string,
  requiredPermission: Permission,
): Promise<{ allowed: boolean; role?: TeamRole }> {
  // 1. Vérifier si l'utilisateur est owner via ownership.ts
  // 2. Sinon, vérifier s'il est membre de l'équipe
  // 3. Vérifier que son rôle permet la permission demandée
  // 4. Retourner { allowed, role }
}

// Version middleware pour API routes :
export function requireTeamAccess(requiredPermission: Permission) {
  return async (handler: Function) => {
    return withApiMiddleware(async ({ userId, request, params }) => {
      const teamId = params.teamId;
      const { allowed } = await withTeamAccess(teamId, userId, requiredPermission);
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return handler({ userId, request, params });
    });
  };
}
```

### Vérification
1. Owner → accès total
2. Viewer → lecture seule
3. Non-membre → 403
4. `pnpm test:run` — tests permissions passent

---

## S12.3 — Partage de profils et contenus entre membres

**Fichiers** : `src/app/api/v1/teams/[teamId]/profiles/route.ts` (NOUVEAU), `src/app/api/v1/teams/[teamId]/content/route.ts` (NOUVEAU), `src/lib/services/team-content.ts` (NOUVEAU)
**Effort** : M
**Dépendances** : S12.2
**Test** : Membre peut voir/modifier les profils et contenus de l'équipe

### Contexte
Actuellement, chaque profil appartient à un seul utilisateur (`Profile.userId`). En mode équipe, un profil doit pouvoir être partagé (avec des permissions par membre). Il faut soit : (a) ajouter `teamId` optionnel sur Profile, soit (b) créer une table `TeamProfile`.

### Modifications

**1. Partager un profil avec l'équipe** :

```ts
// POST /api/v1/teams/:teamId/profiles/:profileId/share
// Body: { permission: "read" | "write" }
// Vérifier que le user est owner du profil
// Ajouter le profil à l'équipe avec la permission donnée
```

**2. Lister les contenus de l'équipe** :

```ts
// GET /api/v1/teams/:teamId/content
// Retourne les contenus des profils partagés avec l'équipe
// Filtrable par statut, plateforme, date
// Paginé
```

**3. Workflow review** :
```ts
// Un membre crée un brouillon → un autre membre le review → approbation → publication
// Ajouter status "IN_REVIEW" à Content
// Ajouter reviewedBy, reviewedAt sur Content
```

### Vérification
1. Profil partagé visible par tous les membres
2. Membre avec permission write peut créer/modifier du contenu
3. Workflow review complet
4. `pnpm test:run` — tests partage passent

---

## S12.4 — UI équipe : page de gestion

**Fichiers** : `src/app/(main)/settings/teams/page.tsx` (MODIFIER), `src/components/teams/team-list.tsx` (NOUVEAU), `src/components/teams/team-settings.tsx` (NOUVEAU), `src/components/teams/member-list.tsx` (NOUVEAU), `src/components/teams/invite-dialog.tsx` (NOUVEAU)
**Effort** : L
**Dépendances** : S12.1
**Test** : UI de gestion d'équipe complète

### Contexte
La page `/settings/teams` existe mais est basique. Il faut une UI complète avec :
- Liste des équipes
- Création d'équipe
- Gestion des membres (liste, rôles, retrait)
- Invitation par email
- Paramètres de l'équipe (nom, avatar)

### Vérification
1. CRUD équipe complet depuis l'UI
2. Invitation par email fonctionnelle
3. Gestion des rôles (promouvoir, rétrograder)
4. `pnpm test:run` — tests UI passent

---

## S12.5 — Notifications en temps réel (WebSocket/SSE)

**Fichiers** : `src/lib/notifications/index.ts` (NOUVEAU), `src/lib/notifications/channels.ts` (NOUVEAU), `src/app/api/v1/notifications/route.ts` (NOUVEAU), `src/components/notifications/notification-bell.tsx` (NOUVEAU)
**Effort** : L
**Dépendances** : S12.3
**Test** : Invitation reçue → notification en temps réel

### Contexte
Les actions d'équipe (invitation, nouveau contenu à review, approbation) doivent notifier les membres concernés en temps réel.

### Modifications

**1. SSE endpoint** : `GET /api/v1/notifications/stream` — Server-Sent Events

```ts
// Connexion SSE persistante
// À chaque événement (invitation, review request, etc.), envoyer un event SSE
// Le client recoit la notification et met à jour l'UI

export async function handleSSE(request: Request, userId: string) {
  const stream = new ReadableStream({
    start(controller) {
      // Envoyer les notifications non lues au démarrage
      // Puis écouter les nouveaux événements via un EventEmitter
      // Heartbeat toutes les 30s pour garder la connexion ouverte
    },
    cancel() {
      // Nettoyer l'écouteur d'événements
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**2. NotificationBell** : icône de cloche avec badge (nombre de notifications non lues) + dropdown avec la liste

**3. Types de notifications** :
- `team_invite` : "Vous avez été invité à rejoindre l'équipe X"
- `content_review` : "Un contenu est en attente de votre review"
- `content_approved` : "Votre contenu a été approuvé"
- `member_joined` : "X a rejoint l'équipe"
- `schedule_reminder` : "Un contenu sera publié dans 1h"

### Vérification
1. Connexion SSE établie
2. Notification reçue en temps réel
3. Badge mis à jour
4. `pnpm test:run` — tests notifications passent

---

## S12.6 — Workflow de review : approuver/rejeter le contenu d'équipe

**Fichiers** : `src/app/api/v1/content/[id]/review/route.ts` (NOUVEAU), `src/components/content/review-panel.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : S12.3, S12.5
**Test** : Content DRAFT → IN_REVIEW → APPROVED/REJECTED → PUBLISHED

### Contexte
Dans une équipe, un membre crée du contenu, un autre le review et l'approuve avant publication. Il faut un workflow avec status `IN_REVIEW` et `REJECTED` en plus des status existants.

### Modifications

**1. Route de review** :

```ts
// POST /api/v1/content/:id/review
// Body: { action: "approve" | "reject", comment?: string }
// Vérifier que le user a permission write sur l'équipe du profil
// Si approve : status → "APPROVED" (prêt pour schedule/publish)
// Si reject : status → "REJECTED" + commentaire sauvegardé
// Notifier le créateur via SSE
```

**2. ReviewPanel** : composant qui s'affiche pour les utilisateurs ayant le droit de review
- Affiche le contenu en lecture seule
- Boutons Approve / Reject avec champ commentaire
- Timeline des reviews (qui a fait quoi, quand)

### Vérification
1. Création → DRAFT
2. Soumission pour review → IN_REVIEW
3. Approbation → APPROVED
4. Rejet → REJECTED avec commentaire
5. Notification au créateur
6. `pnpm test:run` — tests review passent

---

## S12.7 — Tableau de bord équipe vs individuel

**Fichiers** : `src/app/api/v1/dashboard/team/route.ts` (NOUVEAU), `src/components/dashboard/team-stats.tsx` (NOUVEAU)
**Effort** : M
**Dépendances** : S12.3, Sprint 7 (dashboard)
**Test** : Dashboard équipe vs dashboard perso

### Contexte
Chaque membre voit son dashboard perso. Les admins voient en plus un dashboard équipe avec les stats agrégées de tous les membres.

### Modifications

**1. API dashboard équipe** :

```ts
// GET /api/v1/dashboard/team?teamId=xxx
// Stats agrégées de tous les membres :
// - Total content published (équipe)
// - Par membre : X posts, Y% success rate
// - Content en attente de review
// - Prochaines publications programmées
// - Activité récente (membre X a publié sur Y)
```

**2. TeamStats** : composant avec :
- Cards de stats agrégées
- Tableau des membres avec leurs KPIs individuels
- File d'attente des contenus à review
- Timeline d'activité récente

### Vérification
1. Admin voit les stats de toute l'équipe
2. Membre voit uniquement ses stats
3. File de review visible
4. `pnpm test:run` — tests dashboard équipe passent

---

# 📋 RÉCAPITULATIF SPRINT 12

## Sprint 12 — Team Collaboration (~40 fichiers)

| ID | Fichier | Action |
|----|---------|--------|
| S12.1 | `src/lib/services/team.ts` | **NOUVEAU** — Service team CRUD |
| S12.1 | Routes `/api/teams/*` | MODIFIER — Finaliser API |
| S12.2 | `src/lib/middleware/team-permissions.ts` | **NOUVEAU** — Permissions middleware |
| S12.3 | `src/lib/services/team-content.ts` | **NOUVEAU** — Partage de contenu |
| S12.3 | Routes `/api/v1/teams/*/profiles` | **NOUVEAU** — API partage profils |
| S12.3 | Routes `/api/v1/teams/*/content` | **NOUVEAU** — API contenu équipe |
| S12.4 | UI components (`team-list`, `team-settings`, etc.) | **NOUVEAU** — 4-5 composants |
| S12.5 | `src/lib/notifications/*` | **NOUVEAU** — SSE + notifications |
| S12.5 | `src/components/notifications/notification-bell.tsx` | **NOUVEAU** — UI notifications |
| S12.6 | `src/app/api/v1/content/[id]/review/route.ts` | **NOUVEAU** — API review |
| S12.6 | `src/components/content/review-panel.tsx` | **NOUVEAU** — UI review |
| S12.7 | `src/app/api/v1/dashboard/team/route.ts` | **NOUVEAU** — Dashboard équipe |
| S12.7 | `src/components/dashboard/team-stats.tsx` | **NOUVEAU** — Stats équipe |

---

# ✅ CHECKLIST SPRINT 12

- [ ] CRUD équipe complet (créer, inviter, gérer rôles)
- [ ] Middleware permissions (owner/admin/member/viewer)
- [ ] Partage de profils entre membres d'équipe
- [ ] UI gestion d'équipe complète
- [ ] Notifications temps réel (SSE)
- [ ] Workflow review (DRAFT → IN_REVIEW → APPROVED/REJECTED)
- [ ] Dashboard équipe avec stats agrégées
- [ ] `pnpm test:run` — 95+ files pass

---

# 🔧 TECHNICAL DEBT — En parallèle des sprints

---

## TD1 — Fixer les erreurs typecheck préexistantes

**Fichiers** : Multiples — ~30 fichiers test sans imports vitest, ~400 erreurs
**Effort** : 2-3 jours
**Priorité** : 🔴 Haute

### Contexte
Le typecheck (`pnpm typecheck`) est cassé depuis le début du projet. Les erreurs sont principalement :
- Fichiers de test qui utilisent `describe`, `it`, `expect` sans les importer de `vitest`
- Fichiers de test qui utilisent `vi.fn`/`vi.mock` sans l'importer
- Quelques erreurs de types dans `prisma/seed.ts`, `scripts/`, `e2e/`

### Modifications

**1. Ajouter les imports vitest manquants** (~15 fichiers) :

```ts
// AVANT : (aucun import)
describe("crypto", () => { ... });

// APRÈS :
import { describe, expect, it } from "vitest";
describe("crypto", () => { ... });
```

Fichiers concernés : `crypto.test.ts`, `prompts.test.ts`, `stripe.test.ts`, `tokens.test.ts`, `utils.test.ts`, `publish-guard.test.ts`, `publish-guard-functions.test.ts`, `validations.test.ts`, `auth.test.ts`, `agent-runner.test.ts`, `video-pipeline.test.ts`, `di/container.test.ts`, `request-id.test.ts`, `validate-url.test.ts`, `retry.test.ts`, `api-errors.test.ts`, `api-version.test.ts`, `rate-limit-redis.test.ts`

**2. Ajouter le type test aux tsconfig** ou utiliser un `tsconfig.test.json` séparé.

### Vérification
1. `pnpm typecheck` — 0 erreurs
2. `pnpm test:run` — tous les tests passent toujours

---

## TD2 — Migration queue Redis (BullMQ)

**Fichiers** : `src/lib/job-queue/queue.ts` (MODIFIER), `src/lib/job-queue/worker.ts` (MODIFIER), `src/lib/job-queue/types.ts` (MODIFIER), `src/instrumentation.ts` (MODIFIER)
**Effort** : 3-5 jours
**Priorité** : 🟡 Moyenne

### Contexte
La queue est actuellement en mémoire : les jobs sont perdus au redémarrage du serveur. Pour la production, il faut une queue persistante. BullMQ + Redis est le standard.

### Modifications

**1. Définir l'interface Queue** pour permettre le swap in-memory ↔ Redis :

```ts
// Abstraction pour permettre le swap entre in-memory et Redis
export interface QueueBackend {
  enqueue(job: Omit<Job, "id">): Promise<string>;
  dequeue(): Promise<Job | null>;
  complete(id: string, result?: unknown): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  getStatus(): Promise<QueueStatus>;
  getJob(id: string): Promise<Job | undefined>;
}
```

**2. Implémentation Redis** avec BullMQ :

```ts
// src/lib/job-queue/backends/redis.ts
import { Queue as BullQueue, Worker as BullWorker } from "bullmq";

export class RedisQueueBackend implements QueueBackend {
  private queue: BullQueue;
  private worker: BullWorker | null = null;

  constructor() {
    this.queue = new BullQueue("socialcreator", {
      connection: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) },
      defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
    });
  }

  async enqueue(job: Omit<Job, "id">): Promise<string> {
    const bullJob = await this.queue.add(job.type, job.payload, {
      priority: PRIORITY_MAP[job.priority],
      attempts: job.maxAttempts,
    });
    return bullJob.id ?? randomUUID();
  }
  // ...
}
```

**3. Factory** pour choisir le backend selon la configuration :

```ts
export function createQueueBackend(): QueueBackend {
  if (process.env.REDIS_HOST) {
    return new RedisQueueBackend();
  }
  return new InMemoryQueueBackend();
}
```

### Vérification
1. Queue Redis fonctionnelle
2. Jobs persistés après redémarrage
3. Fallback in-memory si Redis non configuré
4. `pnpm test:run` — tous les tests passent

---

## TD3 — Body size limit sécurisé

**Fichiers** : `src/lib/middleware/api-middleware.ts` (MODIFIER)
**Effort** : 1 jour
**Priorité** : 🟡 Moyenne

### Contexte
Le body size check utilise le header `Content-Length` qui est contrôlé par le client. Un attaquant peut envoyer un petit header avec un gros body pour contourner la limite.

### Modifications

**Remplacer par une consommation réelle du body** :

```ts
// AVANT (vulnérable) :
if (request.body) {
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return errorResponse(413, "Request body too large");
  }
}

// APRÈS (sécurisé) :
const MAX_BODY_SIZE = 100 * 1024; // 100 KB

export async function consumeBodyWithLimit(request: Request): Promise<string> {
  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) {
    throw new AppError(413, "Request body too large");
  }
  return text;
}
```

### Vérification
1. Body < 100KB → passe
2. Body > 100KB → 413
3. `Content-Length` falsifié → toujours bloqué
4. `pnpm test:run` — OK

---

## TD4 — Health endpoint : retirer version/revision

**Fichiers** : `src/lib/observability/health.ts` (MODIFIER), `src/lib/observability/__tests__/health.test.ts` (MODIFIER)
**Effort** : 0.5 jour
**Priorité** : 🟢 Basse

### Contexte
Le health endpoint expose `version` (package.json) et `revision` (git SHA), ce qui permet le fingerprinting de version pour cibler des CVEs.

### Modifications

**Supprimer `version` et `revision` de la réponse** :

```ts
// AVANT :
return {
  status: dbStatus === "ok" ? "healthy" : "degraded",
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
  revision: process.env.GIT_REVISION || "unknown",
  checks: { database: { status: dbStatus, latencyMs: dbLatency } },
};

// APRÈS :
return {
  status: dbStatus === "ok" ? "healthy" : "degraded",
  timestamp: new Date().toISOString(),
  checks: { database: { status: dbStatus, latencyMs: dbLatency } },
};
```

### Vérification
1. `GET /api/health` → plus de `version`/`revision`
2. Tests mis à jour
3. `pnpm test:run` — OK

---

## TD5 — Tests repository (9/11 manquants)

**Fichiers** : `src/lib/repositories/__tests__/*.repository.test.ts` (NOUVEAU — 9 fichiers)
**Effort** : 1-2 jours
**Priorité** : 🟢 Basse

### Contexte
Seuls `content.repository` et `connected-account.repository` ont des tests. Les 9 autres repositories (profile, agent, publishLog, analytics, team, teamMember, notification, videoAsset, media) sont à 0% de couverture.

### Modifications

Pour chaque repository, créer un test qui :
1. CRUD de base (create → read → update → delete)
2. Méthodes spécifiques (findByUserId, findByStatus, etc.)
3. Gestion des erreurs (not found, doublons, contraintes)
4. Utiliser Prisma mock ou SQLite in-memory

```ts
// Pattern pour chaque test :
import { describe, expect, it, beforeEach } from "vitest";
import { createTestRepository } from "./test-utils";

describe("ProfileRepository", () => {
  let repo: ProfileRepository;

  beforeEach(() => {
    repo = createTestRepository().profile;
  });

  it("should create a profile", async () => {
    const profile = await repo.create({
      userId: "test-user",
      platform: "X",
      handle: "@test",
    });
    expect(profile.id).toBeDefined();
    expect(profile.platform).toBe("X");
  });

  it("should find profile by id", async () => {
    const created = await repo.create({ userId: "user-1", platform: "X", handle: "@test" });
    const found = await repo.findById(created.id);
    expect(found?.id).toBe(created.id);
  });

  it("should return null for non-existent profile", async () => {
    const found = await repo.findById("non-existent");
    expect(found).toBeNull();
  });

  it("should find profiles by userId", async () => {
    // Créer 2 profils pour user-1, 1 pour user-2
    // findByUserId(user-1) → 2 profils
  });
});
```

### Vérification
1. 9 nouveaux fichiers de test
2. Tests CRUD + spécifiques pour chaque repository
3. `pnpm test:run` — 86+ files pass

---

# 🔗 SCHÉMA DES DÉPENDANCES COMPLET

```
Sprint 1  (Security + Mobile)
Sprint 2  (Architecture Patterns)
Sprint 3  (API v1, Queue, Encryption, SSRF)
Sprint 4  (OAuth Onboarding) ─ Sprint 3
Sprint 5  (Scheduling UI) ─── Sprint 3
Sprint 6  (Publish Pipeline) ─ Sprint 3, Sprint 5
Sprint 7  (Dashboard) ─────── Sprint 5, Sprint 6
Sprint 8  (Observability) ─── Sprint 2, Sprint 7
Sprint 9  (Security) ──────── Sprint 6, Sprint 7, Sprint 8
Sprint 10 (AI Content Gen) ── Sprint 3, Sprint 9
Sprint 11 (Analytics) ─────── Sprint 7, Sprint 10 (optional)
Sprint 12 (Team) ──────────── Sprint 4, Sprint 5, Sprint 10
```

## Ordre recommandé d'exécution

```
Sprint 10 (AI Content Gen) ──────┐  (indépendant — peut commencer immédiatement)
Sprint 11 (Analytics) ───────────┤  (indépendant — peut être parallèle)
                                │
Sprint 12 (Team Collaboration) ───────┤  (dépend de S10 pour le contenu partagé)

Technical Debt (en parallèle des sprints ci-dessus) :
  TD1 (typecheck) ── peut être fait à tout moment (max 3 jours)
  TD3 (body size) ── peut être fait à tout moment (1 jour)
  TD4 (health) ───── peut être fait à tout moment (0.5 jour)
  TD2 (Redis queue) ── avant mise en production réelle
  TD5 (repo tests) ─── peut être fait à tout moment (1-2 jours)
```

```
Semaine 13-16 : Sprint 10 — AI Content Generation
Semaine 17-19 : Sprint 11 — Advanced Analytics
Semaine 20-25 : Sprint 12 — Team Collaboration
Between sprints : TD1 (typecheck) + TD3 (body size) + TD4 (health)
```

---

*Plan mis à jour le 2026-06-03 — Sprints 1-9 complétés, Sprints 10-12 + Technical Debt détaillés*
