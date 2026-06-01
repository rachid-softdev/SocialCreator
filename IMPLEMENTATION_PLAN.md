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

*Plan généré le 2026-06-01 — OpenCode Review System*
