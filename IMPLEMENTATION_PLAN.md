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
```

---

*Plan mis à jour le 2026-06-02 — Sprints 1-3 complétés, Sprints 4-8 détaillés*
