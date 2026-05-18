Tu es un ingénieur full-stack senior. Implémente un clone fonctionnel de ViewCreator.ai en respectant IMPÉRATIVEMENT les règles de conformité des plateformes sociales et en utilisant les services tiers recommandés pour aller vite.

## RÈGLES DE CONFORMITÉ — NON NÉGOCIABLES

Avant tout code de publication, intègre ces garde-fous :

1. CAP DE FRÉQUENCE : max 4 posts/jour/compte social par défaut, configurable par l'utilisateur mais plafonné à 8. Bloqué côté serveur via vérification en base avant chaque publication.

2. CONTENU ADAPTÉ PAR PLATEFORME : le même brief NE DOIT PAS produire du contenu identique sur plusieurs plateformes. Le system prompt doit explicitement demander une réécriture adaptée à chaque réseau (ton, longueur, hashtags, format différents).

3. MODE APPROBATION : chaque agent a un toggle "auto_publish: boolean". Si false, le contenu généré passe en statut DRAFT et attend une approbation humaine avant publication. Ce mode est activé par défaut.

4. AUDIT LOG : toute publication (réussie ou non) est loggée avec user_id, profile_id, platform, content_hash, timestamp. Immutable.

5. DÉCLARATION CGU : à l'onboarding, l'utilisateur doit cocher qu'il est propriétaire des comptes connectés et qu'il respecte les CGU de chaque plateforme. Sans ça, pas d'accès à la publication.

6. PAS D'AUTOMATISATION D'ENGAGEMENT : aucune feature de like, follow, comment, DM automatiques. Hors scope et contraire aux CGU de toutes les plateformes.

## STACK TECHNIQUE

Framework : Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
Auth : Clerk (gère l'OAuth social de façon propre)
Base de données : PostgreSQL via Neon (serverless) + Prisma ORM
Upload fichiers : UploadThing (SDK Next.js natif, pas de config S3 manuelle)
Vidéo / Transcoding : Mux (ne pas coder ffmpeg soi-même — transcoding, clips, HLS, thumbnails via Mux API)
Transcription : Deepgram API (Whisper managé, rapide, pas de GPU à gérer)
Queue / Jobs background : Trigger.dev (long-running tasks, retry natif, observabilité)
Workflows événementiels : Inngest (workflows multi-étapes avec retry/rollback)
LLM : Anthropic claude-sonnet-4-20250514 (text generation + adaptation plateforme)
Billing : Stripe (subscriptions + customer portal)
Déploiement : Vercel + Trigger.dev cloud

## MODÈLE DE DONNÉES (Prisma)

model User {
  id                String    @id @default(cuid())
  clerkId           String    @unique
  email             String    @unique
  stripeCustomerId  String?
  cguAccepted       Boolean   @default(false)
  cguAcceptedAt     DateTime?
  profiles          Profile[]
  apiKeys           ApiKey[]
  createdAt         DateTime  @default(now())
}

model Profile {
  id               String             @id @default(cuid())
  userId           String
  user             User               @relation(fields: [userId], references: [id])
  name             String
  brandVoice       String             @db.Text
  contentBank      String?            @db.Text
  platforms        String[]
  avatarUrl        String?
  connectedAccounts ConnectedAccount[]
  agents           Agent[]
  analytics        Analytics[]
  createdAt        DateTime           @default(now())
}

model ConnectedAccount {
  id           String    @id @default(cuid())
  profileId    String
  profile      Profile   @relation(fields: [profileId], references: [id])
  platform     Platform
  accessToken  String    // Chiffré AES-256
  refreshToken String?   // Chiffré AES-256
  expiresAt    DateTime?
  accountId    String
  accountName  String
  createdAt    DateTime  @default(now())

  @@unique([profileId, platform])
}

enum Platform {
  TIKTOK INSTAGRAM YOUTUBE FACEBOOK X LINKEDIN THREADS PINTEREST
}

model Agent {
  id           String      @id @default(cuid())
  profileId    String
  profile      Profile     @relation(fields: [profileId], references: [id])
  name         String
  type         AgentType
  platforms    Platform[]
  scheduleCron String?
  isActive     Boolean     @default(false)
  autoPublish  Boolean     @default(false) // false = draft mode par défaut
  maxPerDay    Int         @default(2)     // cap sécurité, max 8
  config       Json
  runs         AgentRun[]
  createdAt    DateTime    @default(now())
}

enum AgentType {
  TEXT_POST VIDEO_CLIP CROSS_POST
}

model AgentRun {
  id               String             @id @default(cuid())
  agentId          String
  agent            Agent              @relation(fields: [agentId], references: [id])
  status           RunStatus          @default(PENDING)
  brief            String             @db.Text
  generatedContent GeneratedContent[]
  startedAt        DateTime?
  finishedAt       DateTime?
  error            String?
}

enum RunStatus {
  PENDING RUNNING SUCCESS FAILED CANCELLED
}

model GeneratedContent {
  id         String          @id @default(cuid())
  runId      String
  run        AgentRun        @relation(fields: [runId], references: [id])
  profileId  String
  platform   Platform
  textContent String         @db.Text
  mediaUrls  String[]
  status     ContentStatus   @default(DRAFT)
  publishedAt DateTime?
  postId     String?
  createdAt  DateTime        @default(now())
}

enum ContentStatus {
  DRAFT APPROVED PUBLISHED FAILED REJECTED
}

model PublishLog {
  id          String   @id @default(cuid())
  userId      String
  profileId   String
  platform    Platform
  contentId   String
  contentHash String   // SHA-256 du contenu publié
  success     Boolean
  error       String?
  publishedAt DateTime @default(now())
  // Immutable — jamais de UPDATE sur cette table
}

model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  name      String
  keyHash   String   @unique // SHA-256, jamais la clé en clair
  prefix    String            // ex: "vc_live_" pour identifier
  lastUsed  DateTime?
  createdAt DateTime @default(now())
  revokedAt DateTime?
}

## PIPELINE VIDÉO AVEC MUX (ne pas coder ffmpeg)

Étape 1 — Upload via UploadThing
- L'utilisateur upload une vidéo longue directement depuis le browser
- UploadThing stocke le fichier et retourne une URL

Étape 2 — Transcription via Deepgram
- POST à l'API Deepgram avec l'URL UploadThing
- Retourne transcript avec timestamps mot par mot

Étape 3 — Identification des moments clés via Claude
- System prompt : "Voici le transcript d'une vidéo avec timestamps. Identifie 3 à 5 segments de 30-90 secondes qui constituent les moments les plus impactants pour les réseaux sociaux. Retourne un JSON : [{start: seconds, end: seconds, reason: string}]"
- Retourne les timestamps des clips à extraire

Étape 4 — Création des clips via Mux
- Utilise Mux Asset API pour créer des clips : POST /assets avec input_url + start_time + end_time
- Mux gère le transcoding, pas de ffmpeg local
- Récupère les URLs HLS des clips prêts

Étape 5 — Génération des captions et texte par plateforme
- Pour chaque clip et chaque plateforme cible, Claude génère : caption adaptée, hashtags, description (brand voice du profil)
- Stockage en GeneratedContent avec status DRAFT

Tout ce pipeline est orchestré comme un job Trigger.dev (long-running, retry par étape).

## ADAPTATION CONTENU PAR PLATEFORME (system prompt)

Pour chaque plateforme, utilise ce template de system prompt :

const platformPrompts = {
  INSTAGRAM: "Tu crées du contenu pour Instagram. Ton : visuel, émotionnel, inspirant. Max 2200 chars. 3-5 hashtags pertinents. Commence par un hook accrocheur.",
  TIKTOK: "Tu crées du contenu pour TikTok. Ton : authentique, direct, energique. Max 150 chars pour la caption. Hashtags tendance. Le premier mot doit capter l'attention.",
  LINKEDIN: "Tu crées du contenu pour LinkedIn. Ton : professionnel, réflexif, apportant de la valeur. 1300 chars idéal. Pas de hashtags excessifs (max 3). Structure avec des espaces.",
  YOUTUBE: "Tu crées du contenu pour YouTube Shorts. Titre accrocheur max 100 chars. Description SEO-friendly. Tags pertinents.",
  X: "Tu crées du contenu pour X (Twitter). Max 280 chars. Ton : concis, direct, opinionated. Un seul point clé.",
  FACEBOOK: "Tu crées du contenu pour Facebook. Ton : convivial, engageant. Mix texte + call-to-action. 40-80 mots idéal.",
}

// System prompt complet pour un agent
const buildSystemPrompt = (profile, platform) => `
Tu es l'agent content de ${profile.name}.

BRAND VOICE : ${profile.brandVoice}

EXEMPLES DE CONTENUS PASSÉS : ${profile.contentBank || "Aucun exemple fourni."}

RÈGLES PLATEFORME : ${platformPrompts[platform]}

RÈGLES ABSOLUES :
- Ne jamais reproduire mot pour mot un contenu publié récemment
- Adapter le ton ET le format à la plateforme (pas de copier-coller entre plateformes)
- Respecter la brand voice en toutes circonstances
- Ne pas dépasser les limites de caractères de la plateforme
`

## MCP SERVER (5 tools)

Endpoint : /api/mcp (API Route Next.js)
Auth : Bearer token → hash SHA-256 → lookup en base ApiKey

Tools à implémenter selon spec JSON-RPC 2.0 :
- list_agents(profile_id?) → liste des agents avec statut
- get_agent(agent_id) → config complète d'un agent
- create_agent({profile_id, name, type, platforms, schedule?, auto_publish?}) → crée et retourne l'agent
- run_agent({agent_id, brief}) → lance un run, retourne {run_id}
- get_run_status({run_id}) → statut + contenu généré + URLs si applicable

## PUBLICATION SOCIALE — APIS OFFICIELLES UNIQUEMENT

Pour chaque plateforme, utilise uniquement les APIs officielles :
- Instagram : Meta Content Publishing API (nécessite Instagram Business Account)
- TikTok : TikTok Content Posting API v2
- YouTube : YouTube Data API v3 (videos.insert pour Shorts)
- Facebook : Meta Graph API Pages
- LinkedIn : LinkedIn UGC Post API
- X : X API v2 (tweets endpoint)

Avant chaque publication :
1. Vérifier le cap quotidien (PublishLog count du jour pour ce compte)
2. Si auto_publish = false, sauvegarder en DRAFT et stopper
3. Vérifier validité du token (refresh si nécessaire)
4. Publier via l'API officielle
5. Logger dans PublishLog (immutable)
6. Mettre à jour GeneratedContent.status → PUBLISHED

## BILLING STRIPE

- Prix : $50/mois (1 profil) + $20/mois par profil additionnel
- Implémenter avec Stripe metered billing OU subscription items (1 item par profil)
- Webhook stripe pour sync : checkout.session.completed, customer.subscription.updated/deleted, invoice.payment_failed
- Middleware Next.js qui vérifie le quota de profils avant création

## ORDRE D'IMPLÉMENTATION MVP

Phase 1 (semaine 1-2) : Setup + Auth + Profils
- Init Next.js + Prisma + Neon + Clerk
- Schema complet + migrations
- Auth + onboarding avec acceptation CGU
- CRUD profils + brand voice

Phase 2 (semaine 3) : Connexion comptes sociaux
- OAuth flows pour chaque plateforme
- Stockage tokens chiffrés
- Page de gestion des comptes connectés

Phase 3 (semaine 4) : Agents IA texte
- Création d'agents + config
- Pipeline de génération avec Trigger.dev
- Mode draft + approbation UI

Phase 4 (semaine 5) : Publication
- Workers de publication via APIs officielles
- Cap quotidien + audit log
- Scheduling via Trigger.dev cron

Phase 5 (semaine 6) : Vidéo
- UploadThing pour upload
- Mux pour transcoding + clips
- Deepgram pour transcription
- Claude pour timestamps + captions

Phase 6 (semaine 7-8) : MCP + Billing + Analytics
- MCP server 5 tools
- Stripe integration
- Dashboard analytics

Commence par la Phase 1 : setup Next.js + schema Prisma complet + Clerk auth.