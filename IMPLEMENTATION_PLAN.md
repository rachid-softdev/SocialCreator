# 🏗️ Plan d'implémentation — Admin Dashboard

> **Date** : 04/06/2026
> **Branch** : `admin-dashboard`
> **Baseline initiale** : 106 test files, 1467 tests passing, Biome 100% clean
> **État final** : ✅ Tout implémenté — 109 test files, 1503 tests passing, Biome 100% clean

---

## ✅ Bilan de l'implémentation

Toutes les phases du plan original ont été exécutées avec succès :

| Phase | Statut | Fichiers créés | Tests |
|-------|--------|----------------|-------|
| **P1** APIs | ✅ Fait | `stats/route.ts`, `users/[id]/route.ts`, `orgs/route.ts` | 3 fichiers, 36 tests |
| **P2** Composants | ✅ Fait | `admin-guard.tsx`, `confirm-dialog.tsx` | — |
| **P3** Pages | ✅ Fait | 5 pages + 5 loading states | — |
| **P4** Sidebar | ✅ Fait | `sidebar.tsx` (modifié) | — |
| **P5** Tests | ✅ Fait | 3 fichiers de test | 36 tests |

### Ce qui a été livré

#### APIs (3 nouvelles routes)
- `GET /api/admin/stats` — Statistiques globales (users, orgs, content, publications)
- `GET /api/admin/users/[id]` + `PATCH` + `DELETE` — CRUD complet utilisateur
- `GET /api/admin/orgs` — Liste paginée avec recherche

#### Composants (2)
- `AdminGuard` — Client component wrapper qui vérifie `session.user.role === "ADMIN"`
- `ConfirmDialog` — Modal de confirmation réutilisable (basé sur shadcn Dialog)

#### Pages (5)
- `/admin` — Dashboard avec 4 KPIs + loading/error states
- `/admin/users` — Tableau, recherche, édition rôle (dialog), suppression (confirm)
- `/admin/users/[id]` — Détail avec profils, stats d'usage, équipes
- `/admin/orgs` — Liste paginée avec recherche (composant Pagination existant réutilisé)
- `/admin/entitlements` — 3 onglets (Plans, Features, Overrides), création/suppression d'overrides

#### Sidebar
- Lien "Admin" conditionnel visible uniquement si `role === "ADMIN"` (via `useAuthStore`)

#### Tests (3 nouveaux fichiers, 36 tests)
- `stats/__tests__/route.test.ts` — 10 tests (auth, shape, compteurs)
- `users/[id]/__tests__/route.test.ts` — 15 tests (GET, PATCH, DELETE, validation, auto-suppression)
- `orgs/__tests__/route.test.ts` — 11 tests (auth, pagination, recherche, limites)

---

## 📋 Tâches restantes (post-MVP)

Ces tâches ont été identifiées mais **non implémentées** dans cette phase :

### 1. Page orgs/[id] — Détail organisation
**Fichier** : `socialcreator-web/src/app/(main)/admin/orgs/[id]/page.tsx`
**API** : `GET /api/admin/orgs/[id]` (à créer)
**Contenu** :
- Infos générales (nom, subscription, dates)
- Membres de l'équipe associée
- Usage tracking (featureKey, usageCount, period)
- Entitlement overrides de cette org
- Actions : invalider le cache, voir abonnement

### 2. StatsCards v2 — Graphiques dashboard
**Composant** : Dashboard enrichi avec graphiques d'évolution (recharts)
**API** : Ajout de `trends.usersLast30Days`, `trends.contentLast30Days` à `/api/admin/stats`
**Bibliothèque** : `recharts` (déjà dans le projet)

### 3. Audit logging admin
**Mécanisme** : Logger chaque action admin (modification rôle, suppression user, création override) dans un format structuré
**Stockage** : Table `AuditLog` dans Prisma (à créer) ou simple logging structuré
**Données** : `adminId`, `action`, `targetType`, `targetId`, `metadata`, `timestamp`

### 4. Tests AdminGuard
**Fichier** : `socialcreator-web/src/components/admin/__tests__/admin-guard.test.tsx`
**Tests** :
- Rendu avec session admin → children visibles
- Rendu sans session → loading spinner
- Rendu avec session non-admin → redirect appelé

### 5. Barre de recherche réutilisable
**Fichier** : `socialcreator-web/src/components/admin/search-input.tsx`
**Note** : Le composant `SearchBar` existe déjà dans `src/components/shared/search-bar.tsx`. À réutiliser dans les pages admin à la place des inputs inline.

---

## 📐 Architecture finale

### Patterns utilisés

**Toutes les pages admin** suivent le même pattern :
```
AdminGuard (vérifie role)
  └── useEffect(fetch) → API
      ├── loading → Skeleton
      ├── error → Alert banner
      ├── empty → Message centré
      └── data → Rendu
```

**Toutes les routes API admin** suivent le même pattern :
```
requireAdmin() [throw AuthError si non-admin]
  └── Zod validation (si mutation)
      └── Prisma query
          └── NextResponse.json()
```

### Contrôle qualité
- ✅ Biome : 0 erreurs, 0 warnings
- ✅ Tests : 1503 passants (109 fichiers)
- ✅ Pas de nouvelles dépendances npm
- ✅ Composants réutilisés : `Breadcrumb`, `PageHeader`, `Pagination`, `Badge`, `Button`, `Dialog`, `Skeleton`, `TextInput`
