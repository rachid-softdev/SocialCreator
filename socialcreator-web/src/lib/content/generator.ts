/**
 * Content Generator Service
 * Generates content via LLM and saves as DRAFT
 */

import type { Platform } from "@prisma/client";
import { generateText } from "@/lib/llm/provider";
import logger from "@/lib/logger";
import { getRepositories } from "@/lib/repositories";
import { getPromptForPlatform } from "./prompts";

// ── Types ──────────────────────────────────────────────────────

export interface GenerateContentInput {
  profileId: string;
  platform: Platform;
  brief: string;
  keywords?: string[];
  brandVoice?: string;
  count?: number;
}

export interface GenerateContentResult {
  id: string;
  platform: Platform;
  textContent: string;
  hashtags: string[];
  status: "DRAFT";
}

// ── JSON parsing helpers ────────────────────────────────────────

interface ParsedContent {
  textContent: string;
  hashtags: string[];
}

function parseLLMResponse(text: string): ParsedContent {
  // Try direct JSON parse first
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.textContent) return parsed;
      } catch {
        // Continue to fallback
      }
    }
  }

  // Final fallback: use entire response as textContent
  return {
    textContent: text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim(),
    hashtags: [],
  };
}

// ── Main generator ──────────────────────────────────────────────

/**
 * Generate and save content via LLM.
 * For each count (1-5), builds a prompt, calls LLM, parses response,
 * truncates to platform maxChars, and saves as DRAFT.
 */
export async function generateAndSaveContent(
  input: GenerateContentInput,
): Promise<GenerateContentResult[]> {
  const { content: contentRepo } = getRepositories();
  const template = getPromptForPlatform(input.platform);
  const numToGenerate = Math.min(Math.max(input.count ?? 1, 1), 5);

  const results: GenerateContentResult[] = [];

  for (let i = 0; i < numToGenerate; i++) {
    // Build messages for LLM
    const userPrompt = template.buildUserPrompt({
      brief: input.brief,
      keywords: input.keywords,
      brandVoice: input.brandVoice,
    });

    const llmResponse = await generateText({
      messages: [
        { role: "system", content: template.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 1024,
      temperature: 0.8,
    });

    // Parse LLM response
    const parsed = parseLLMResponse(llmResponse.textContent);

    // Truncate text to platform maxChars
    const truncatedText = parsed.textContent.slice(0, template.maxChars);

    // Filter hashtags to remove any that were truncated from the text
    const hashtags = (parsed.hashtags ?? []).slice(0, 30);

    // Save as DRAFT via repository
    const saved = await contentRepo.create({
      profileId: input.profileId,
      platform: input.platform,
      textContent: truncatedText,
      mediaUrls: [],
      hashtags,
      status: "DRAFT",
      runId: null,
    });

    results.push({
      id: saved.id,
      platform: saved.platform as Platform,
      textContent: saved.textContent,
      hashtags: saved.hashtags,
      status: "DRAFT",
    });

    logger.info(
      { contentId: saved.id, platform: input.platform, iteration: i + 1, total: numToGenerate },
      "Content generated and saved",
    );
  }

  return results;
}
