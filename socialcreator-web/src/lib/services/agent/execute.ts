/**
 * Agent execution — generates content for all platforms in parallel
 */
import type { Platform } from "@prisma/client";
import { generateContent } from "@/lib/llm";
import { buildGenerationPrompt, buildSystemPrompt } from "@/lib/prompts";
import type { AgentWithProfile } from "./validate";

export interface GenerationResult {
  platform: string;
  textContent: string;
  hashtags: string[];
  hook?: string;
}

/**
 * Execute an agent run: generate content for each platform in parallel.
 */
export async function executeAgentRun(
  agent: AgentWithProfile,
  brief: string,
): Promise<GenerationResult[]> {
  const systemPrompt = buildSystemPrompt({
    name: agent.profile.name,
    brandVoice: agent.profile.brandVoice,
    contentBank: agent.profile.contentBank,
  });

  const results = await Promise.all(
    agent.platforms.map(async (platform) => {
      const userPrompt = buildGenerationPrompt({
        brief,
        platform: platform as Platform,
      });
      const result = await generateContent(systemPrompt, userPrompt);
      return { platform, ...result };
    }),
  );

  return results;
}
