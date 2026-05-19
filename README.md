# SocialCreator

**AI-powered social media content generation and publishing SaaS** — Clone de ViewCreator.ai

Générez, adaptez et publiez du contenu sur 8 plateformes (Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Threads, Pinterest) via des agents IA avec contrôle humain et conformité platforme.

## Fonctionnalités

### 🤖 Agents IA
- Création d'agents par type : TEXT_POST, VIDEO_CLIP, CROSS_POST
- Génération de contenu platform-adapted via Claude Sonnet 4
- Brand voice personnalisée + content bank
- Scheduling cron pour runs automatiques

### ✅ Mode Approval
- Contenu généré en **DRAFT** par défaut
- Revue humaine avant publication
- Workflow : DRAFT → APPROVED → PUBLISHED / REJECTED

### 📊 Publication multi-plateforme
- 8 publishers officiels (APIs Meta, TikTok, YouTube, LinkedIn, X, Facebook, Threads, Pinterest)
- **Cap de fréquence** : max 4 posts/jour/compte (configurable jusqu'à 8)
- **PublishLog immutable** pour audit trail

### 🎬 Pipeline Vidéo
- Upload via UploadThing
- Transcription via Deepgram (timestamps)
- Identification automatique des moments clés via Claude
- Extraction de clips via Mux
- Génération de captions + hashtags par plateforme

### 📈 Analytics
- Dashboard par profile + global
- Stats par plateforme : impressions, engagements, clicks, followers
- Charts avec Recharts

### 🔐 MCP Server
- API JSON-RPC 2.0 pour intégrations externes
- 5 tools : list_agents, get_agent, create_agent, run_agent, get_run_status
- Auth via API keys SHA-256 hashées

### 💳 Billing Stripe
- Plans : Starter ($50), Pro ($70), Team ($110)
- Checkout, billing portal, webhooks

## Stack technique

| Catégorie | Outil |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Design | Tailwind CSS + shadcn/ui (Design System ElevenLabs) |
| Auth | NextAuth.js v5 (Google OAuth) |
| Base de données | PostgreSQL (Neon serverless) + Prisma ORM |
| IA | Claude Sonnet 4 (Anthropic) |
| Vidéo | Mux (transcoding/clips) + Deepgram (transcription) |
| Upload | UploadThing |
| Jobs | Trigger.dev |
| Billing | Stripe |
| Publication | APIs officielles uniquement |

## Getting Started

### Prérequis

- Node.js 18+
- PostgreSQL (local ou Neon)
- Comptes API : Google OAuth, Anthropic, Stripe, Deepgram, Mux, UploadThing

### Installation

```bash
# Cloner le repo
git clone https://github.com/rachid-softdev/SocialCreator.git
cd SocialCreator

# Installer les dépendances (pnpm)
pnpm install

# Configurer les variables d'environnement
cp .env.local.example .env.local
# Éditer .env.local avec vos clés API

# Générer le client Prisma
pnpm --filter=socialcreator-web prisma generate

# Push le schéma vers la base de données
pnpm --filter=socialcreator-web prisma db push

# Lancer en développement
pnpm dev
```

### Configuration .env.local

```env
# Auth
AUTH_SECRET="openssl rand -base64 32"
AUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="openssl rand -base64 32"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/socialcreator"

# APIs
ANTHROPIC_API_KEY="sk-ant-api03-..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
DEEPGRAM_API_KEY="your-deepgram-key"
MUX_TOKEN_ID="your-mux-token-id"
MUX_TOKEN_SECRET="your-mux-token-secret"
UPLOADTHING_SECRET="your-uploadthing-secret"
UPLOADTHING_APP_ID="your-uploadthing-app-id"

# Trigger.dev
TRIGGER_SECRET_KEY="your-trigger-secret"
NEXT_PUBLIC_TRIGGER_PUBLIC_KEY="your-trigger-public"
```

### Build production

```bash
pnpm build
pnpm start
```

### Commandes

```bash
# Installation des dépendances
pnpm install

# Développement
pnpm dev              # Lance tous les packages en mode dev
pnpm dev:web         # Lance uniquement l'app web
pnpm dev:all         # Lance web + scheduler

# Build
pnpm build           # Build tous les packages
pnpm build:web       # Build uniquement l'app web

# Tests
pnpm test            # Tests unitaires tous packages
pnpm test:run        # Tests unitaires sans watch
pnpm test:coverage   # Tests avec coverage
pnpm test:e2e        # Tests end-to-end
pnpm test:e2e:headed # Tests e2e avec navigateur visible

# Linting & Typecheck
pnpm lint            # Lint tous les packages
pnpm typecheck       # Typecheck tous les packages
```

## Packages

Ce projet est un **monorepo** utilisant [Turborepo](https://turbo.build/) et pnpm workspaces.

### Applications

| Package | Description | Commandes |
|---------|-------------|-----------|
| **socialcreator-web** | Application Next.js principale (Dashboard, Agents, Analytics) | `pnpm web:dev`, `pnpm web:build`, `pnpm web:start`, `pnpm web:lint`, `pnpm web:typecheck` |
| **socialcreator-desktop** | Application desktop (Electron/Tauri) | `pnpm desktop:dev`, `pnpm desktop:build`, `pnpm desktop:test` |
| **socialcreator-mobile** | Application mobile (React Native/Expo) | `pnpm mobile:dev`, `pnpm mobile:build`, `pnpm mobile:test` |
| **socialcreator-extension** | Extension navigateur | `pnpm extension:dev`, `pnpm extension:build`, `pnpm extension:test` |

### Packages partagés

| Package | Description |
|---------|-------------|
| **@socialcreator/ui** | Composants UI, design system |
| **@socialcreator/types** | Types TypeScript partagés |
| **@socialcreator/utils** | Utilitaires et helpers |
| **@socialcreator/config** | Configuration Tailwind, ESLint, etc. |

### Commandes par package

```bash
# Web
pnpm web:dev
pnpm web:build
pnpm web:start
pnpm web:test
pnpm web:lint
pnpm web:typecheck

# Desktop
pnpm desktop:dev
pnpm desktop:build
pnpm desktop:test

# Mobile
pnpm mobile:dev
pnpm mobile:build
pnpm mobile:test

# Extension
pnpm extension:dev
pnpm extension:build
pnpm extension:test

# Environment
pnpm check-env     # Valider les variables d'environnement
pnpm push-env      # Pousser les variables vers Vercel
```

## Architecture

```
src/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (main)/          # Dashboard, Profiles, Agents, Content, etc.
│   ├── (onboarding)/    # CGU
│   └── api/             # API routes
│       ├── agents/
│       ├── content/
│       ├── connected-accounts/
│       ├── mcp/
│       ├── profiles/
│       ├── stripe/
│       ├── video/
│       └── uploadthing/
├── components/
│   ├── agent/            # Agent cards, forms, run list
│   ├── analytics/        # Charts, stats cards
│   ├── auth/             # Login, register, CGU forms
│   ├── billing/          # Pricing table, plan selector
│   ├── content/           # Content cards, approval panel
│   ├── connected-accounts/ # Account cards, connect modal
│   ├── dashboard/        # Stats grid, quick actions
│   ├── mcp/              # API key manager, MCP tester
│   ├── profile/          # Profile cards, forms
│   ├── settings/         # Settings tabs
│   ├── ui/               # Design system components
│   └── video/            # Upload, transcript, clips
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── crypto.ts         # AES-256 encryption
│   ├── deepgram.ts       # Transcription API
│   ├── llm.ts            # Claude integration
│   ├── mux.ts            # Mux video API
│   ├── oauth/            # OAuth flows (Meta, TikTok, LinkedIn, X...)
│   ├── prompts.ts        # Platform-specific prompts
│   ├── publish-guard.ts # Frequency cap
│   ├── publishers/       # 8 platform publishers
│   ├── quota-guard.ts    # Profile quota by plan
│   ├── stripe.ts         # Stripe checkout/portal
│   └── video-pipeline.ts # Video pipeline orchestrator
├── triggers/
│   ├── agent-run.trigger.ts
│   ├── agent-scheduler.trigger.ts
│   ├── publish-worker.trigger.ts
│   └── video-pipeline.trigger.ts
└── types/
    └── agent.ts
```

## Règles de conformité

1. **Cap de fréquence** — max 4 posts/jour/compte, configurable jusqu'à 8
2. **Contenu adapté** — chaque plateforme a son propre prompt (ton, longueur, hashtags)
3. **Mode approval** — `auto_publish: false` par défaut, contenu passe en DRAFT
4. **Audit log** — PublishLog immutable (CREATE only, jamais UPDATE)
5. **CGU onboarding** — acceptation obligatoire avant accès à la publication
6. **Pas d'engagement automatique** — likes, follows, comments, DMs automatiques = hors scope

## Plans Stripe

| Plan | Prix | Profils inclus | +profiles |
|---|---|---|---|
| **Starter** | $50/mois | 1 | +$20/profil |
| **Pro** | $70/mois | 2 | +$20/profil |
| **Team** | $110/mois | 4 | +$20/profil |

## API MCP (JSON-RPC 2.0)

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "list_agents",
    "params": { "profileId": "xxx" }
  }'
```

**Methods disponibles :**
- `list_agents` — liste des agents avec statut
- `get_agent` — config complète d'un agent
- `create_agent` — crée un nouvel agent
- `run_agent` — lance un run, retourne {run_id}
- `get_run_status` — statut + contenu généré

## License

MIT — voir [LICENSE](LICENSE)
