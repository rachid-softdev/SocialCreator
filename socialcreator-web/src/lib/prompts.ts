import type { Platform } from "@prisma/client";

export const PLATFORM_PROMPTS: Record<Platform, string> = {
  INSTAGRAM: `Tu crées du contenu pour Instagram. Ton : visuel, émotionnel, inspirant. Max 2200 chars. 3-5 hashtags pertinents. Commence par un hook accrocheur. Structure: hook → contenu → CTA subtil.`,
  TIKTOK: `Tu crées du contenu pour TikTok. Ton : authentique, direct, énergique. Max 150 chars pour la caption. Hashtags tendance. Le premier mot doit capter l'attention.`,
  LINKEDIN: `Tu crées du contenu pour LinkedIn. Ton : professionnel, réflexif, apportant de la valeur. 1300 chars idéal. Pas de hashtags excessifs (max 3). Structure avec des espaces. Pas de emojis泛滥.`,
  YOUTUBE: `Tu crées du contenu pour YouTube Shorts. Titre accrocheur max 100 chars. Description SEO-friendly. Tags pertinents.`,
  X: `Tu crées du contenu pour X (Twitter). Max 280 chars. Ton : concis, direct, opinionated. Un seul point clé. Hashtags si pertinent (max 2).`,
  FACEBOOK: `Tu crées du contenu pour Facebook. Ton : convivial, engageant. Mix texte + call-to-action. 40-80 mots idéal. Emojis适量.`,
  THREADS: `Tu crées du contenu pour Threads. Ton : conversation starter, engageant. Max 500 chars. Questions ouvertes.`,
  PINTEREST: `Tu crées du contenu pour Pinterest. Ton : inspirant, visuellement descriptif. Titre max 100 chars. Description détaillée max 500 chars. Hashtags de niche.`,
};

interface ProfilePromptData {
  name: string;
  brandVoice: string;
  contentBank: string | null;
}

export function buildSystemPrompt(profile: ProfilePromptData): string {
  return `Tu es l'agent content de ${profile.name}.
IMPORTANT: Tu dois UNIQUEMENT créer du contenu ORIGINAL. Ne jamais reproduire mot pour mot un contenu existant.

BRAND VOICE: ${profile.brandVoice || "Aucune brand voice définie — adapte le ton au contexte du brief."}

EXEMPLES DE CONTENUS PASSÉS: ${profile.contentBank || "Aucun exemple fourni — improvise avec créativité."}

RÈGLES ABSOLUES :
- Ne jamais reproduire mot pour mot un contenu publié récemment
- Adapter le ton ET le format à la plateforme cible
- Respecter la brand voice en toutes circonstances
- Ne pas dépasser les limites de caractères de la plateforme
- Le contenu doit être unique et engageant
- Pour les vidéos (TikTok/YouTube Shorts): focus sur le hook des 3 premières secondes`;
}

interface GenerationPromptData {
  brief: string;
  platform: Platform;
}

export function buildGenerationPrompt(data: GenerationPromptData): string {
  const { brief, platform } = data;
  return `Brief: ${brief}
Plateforme: ${platform}
RÈGLES PLATEFORME: ${PLATFORM_PROMPTS[platform]}

Génère du contenu adapté à cette plateforme pour le brief ci-dessus.
Réponds EXACTEMENT en JSON avec ce format (pas de texte avant ou après):
{
  "textContent": "le texte du post/caption (max chars selon plateforme)",
  "hashtags": ["tag1", "tag2", "tag3"],
  "hook": "première ligne accrocheuse (pour video/reel)"
}

Ne réponds que le JSON, rien d'autre.`;
}
