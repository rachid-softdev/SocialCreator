/**
 * generate-blog-posts.ts
 *
 * Script IA pour générer de nouveaux articles de blog.
 * Usage : node scripts/generate-blog-posts.js
 * Nécessite : ANTHROPIC_API_KEY dans l'environnement
 *
 * Ce script :
 * 1. Lit le posts.json existant
 * 2. Extrait les titres existants pour éviter les doublons
 * 3. Appelle Claude API pour générer 1 post "long" et 1 post "short"
 * 4. Vérifie que les titres ne sont pas similaires aux existants
 * 5. Append les nouveaux posts dans posts.json
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_FILE = path.join(__dirname, "../src/content/blog/posts.json");

// Thèmes possibles pour les nouveaux articles
const TOPICS = [
  "social media marketing",
  "création de contenu",
  "IA et productivité",
  "tendances réseaux sociaux",
  "engagement communautaire",
  "LinkedIn B2B",
  "Instagram growth",
  "TikTok stratégie",
  "content calendar",
  "copywriting réseaux sociaux",
  "analytics et métriques",
  "personal branding",
  "entrepreneuriat digital",
];

const AUTHORS = [
  {
    name: "Équipe SocialCreator",
    avatar: "https://api.dicebear.com/7.x/initials/svg?seed=SC&backgroundColor=292524&textColor=ffffff",
  },
  {
    name: "Marie Dubois",
    avatar: "https://api.dicebear.com/7.x/initials/svg?seed=MD&backgroundColor=292524&textColor=ffffff",
  },
  {
    name: "Thomas Martin",
    avatar: "https://api.dicebear.com/7.x/initials/svg?seed=TM&backgroundColor=292524&textColor=ffffff",
  },
  {
    name: "Sophie Bernard",
    avatar: "https://api.dicebear.com/7.x/initials/svg?seed=SB&backgroundColor=292524&textColor=ffffff",
  },
  {
    name: "Alexandre Petit",
    avatar: "https://api.dicebear.com/7.x/initials/svg?seed=AP&backgroundColor=292524&textColor=ffffff",
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function isSimilarTitle(newTitle: string, existingTitles: string[]): boolean {
  const newWords = extractWords(newTitle);
  for (const existing of existingTitles) {
    const existingWords = extractWords(existing);
    // Count overlapping significant words
    let overlap = 0;
    newWords.forEach((w) => {
      if (existingWords.has(w)) overlap++;
    });
    // If more than 3 significant words overlap, consider it similar
    if (overlap >= 3) return true;
  }
  return false;
}

function selectRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function generatePost(
  client: Anthropic,
  type: "short" | "long",
  existingTitles: string[],
  topic: string
): Promise<{
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: { name: string; avatar: string };
  tags: string[];
  readTime: number;
  coverImage: string;
  featured: boolean;
  type: "short" | "long";
} | null> {
  const isLong = type === "long";
  const wordCount = isLong ? "1000-2000" : "400-800";
  const readTime = isLong ? 7 : 4;

  const systemPrompt = `Tu es un expert en création de contenu pour réseaux sociaux et marketing digital. Tu écris des articles de blog en français, engageants et optimisés pour le SEO.

Ta réponse DOIT être un JSON valide avec cette structure exacte :
{
  "title": "Le titre de l'article (max 80 caractères, accrocheur, avec mots-clés)",
  "excerpt": "Un résumé de 120-150 caractères qui donne envie de lire",
  "content": "Le contenu EN ENTIER en Markdown. Utilise ## pour les titres, ** pour gras, > pour blockquotes, etc. Inclue des tableaux si pertinent. Le contenu doit être substantiel et utile.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

RÈGLES CRITÉRQUES :
- Le titre doit être unique et ne PAS ressembler à : ${existingTitles.join(" | ")}
- Écris en français, ton professionnel mais accessible
- Le contenu doit avoir au moins ${wordCount} mots
- Utilise Markdown riche : ## h2, ### h3, **gras**, > blockquote, tableaux, listes
- Les tags doivent être pertinents (en français si possible)
- L'article doit inclure un CTA naturel vers la fin`;

  const userPrompt = `Écris un article de blog de type "${type}" sur le sujet : ${topic}.
  
${isLong ? "Cet article doit être un guide complet et approfondi." : "Cet article doit être un tips rapide et actionnable."}
  
Choisis un angle unique. Pas de titre générique tipo "5 tips pour..." — cherche quelque chose de plus spécifique et accrocheur.
  
Renvoie UNIQUEMENT le JSON, sans texte avant ou après. Pas de backticks, pas de code blocks, juste le JSON brut.`;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`  Tentative ${attempts}/${maxAttempts}...`);

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const rawText = response.content[0];
      if (rawText.type !== "text") throw new Error("Unexpected response type");

      const text = rawText.text.trim();

      // Parse JSON — strip markdown code fences if present
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("  ⚠️ Pas de JSON trouvé dans la réponse");
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Verify title uniqueness
      if (isSimilarTitle(parsed.title, existingTitles)) {
        console.warn(`  ⚠️ Titre similaire détecté : "${parsed.title}"`);
        continue;
      }

      // Generate slug
      const slug = slugify(parsed.title);

      // Select random author
      const author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];

      // Select random cover image based on topic
      const coverImages = {
        default: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&h=630&fit=crop",
        strategy: "https://images.unsplash.com/photo-1560472354-b33ff850c0ef?w=1200&h=630&fit=crop",
        ia: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop",
        growth: "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=1200&h=630&fit=crop",
        productivity: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=1200&h=630&fit=crop",
      };

      let coverImage = coverImages.default;
      if (topic.includes("IA")) coverImage = coverImages.ia;
      else if (topic.includes("algorithme") || topic.includes("Instagram"))
        coverImage = coverImages.growth;
      else if (topic.includes("stratégie") || topic.includes("LinkedIn"))
        coverImage = coverImages.strategy;
      else if (topic.includes("productivité") || topic.includes("calendar"))
        coverImage = coverImages.productivity;

      console.log(`  ✅ Post généré : "${parsed.title}"`);
      console.log(`     Type: ${type} | Mots: ~${parsed.content?.split(/\s+/).length || "?"}`);

      return {
        slug,
        title: parsed.title,
        excerpt: parsed.excerpt,
        content: parsed.content,
        date: new Date().toISOString(),
        author,
        tags: parsed.tags || [],
        readTime,
        coverImage,
        featured: false,
        type,
      };
    } catch (err) {
      console.warn(`  ⚠️ Erreur tentative ${attempts}:`, (err as Error).message);
    }
  }

  console.error(`  ❌ Échec après ${maxAttempts} tentatives pour le post ${type}`);
  return null;
}

async function main() {
  console.log("🚀 Génération d'articles de blog\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ ANTHROPIC_API_KEY manquant dans l'environnement");
    process.exit(1);
  }

  // Read existing posts
  if (!fs.existsSync(POSTS_FILE)) {
    console.error(`❌ Fichier introuvable : ${POSTS_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(POSTS_FILE, "utf8");
  const data = JSON.parse(rawData);
  const existingTitles = data.posts.map((p: { title: string }) => p.title);

  console.log(`📋 ${data.posts.length} articles existants`);
  console.log(`   Thèmes disponibles : ${TOPICS.join(", ")}\n`);

  // Select 2 random topics for the 2 new posts
  const selectedTopics = selectRandomItems(TOPICS, 2);

  const client = new Anthropic({ apiKey });

  // Generate 1 long + 1 short
  console.log(`📝 Génération de 2 nouveaux articles...\n`);

  const newPosts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    date: string;
    author: { name: string; avatar: string };
    tags: string[];
    readTime: number;
    coverImage: string;
    featured: boolean;
    type: "short" | "long";
  }> = [];

  // Long post
  console.log(`\n--- Post LONG sur "${selectedTopics[0]}" ---`);
  const longPost = await generatePost(client, "long", existingTitles, selectedTopics[0]);
  if (longPost) {
    newPosts.push(longPost);
    existingTitles.push(longPost.title);
  }

  // Short post
  console.log(`\n--- Post SHORT sur "${selectedTopics[1]}" ---`);
  const shortPost = await generatePost(client, "short", existingTitles, selectedTopics[1]);
  if (shortPost) {
    newPosts.push(shortPost);
  }

  if (newPosts.length === 0) {
    console.error("\n❌ Aucun post n'a pu être généré.");
    process.exit(1);
  }

  // Append new posts
  data.posts.push(...newPosts);

  fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2), "utf8");

  console.log(`\n✅ ${newPosts.length} article(s) ajouté(s) à posts.json`);
  console.log("   Nouveaux articles :");
  newPosts.forEach((p) => {
    console.log(`   - ${p.title} (${p.type}, ${p.readTime} min)`);
  });
}

main().catch((err) => {
  console.error("❌ Erreur fatale:", err);
  process.exit(1);
});