import type { Platform } from "@prisma/client";
import { generateContent } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { buildGenerationPrompt, buildSystemPrompt } from "@/lib/prompts";

interface TriggerAgentRunParams {
  agentId: string;
  runId: string;
}

export async function triggerAgentRun(params: TriggerAgentRunParams): Promise<void> {
  const { agentId, runId } = params;

  // 1. Fetch agent + profile
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { profile: true },
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  // 2. Update run status to RUNNING
  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const systemPrompt = buildSystemPrompt({
    name: agent.profile.name,
    brandVoice: agent.profile.brandVoice,
    contentBank: agent.profile.contentBank,
  });

  const run = await prisma.agentRun.findUnique({ where: { id: runId } });

  if (!run) {
    throw new Error("Run not found");
  }

  try {
    // 3. Pour chaque plateforme, générer le contenu
    for (const platform of agent.platforms) {
      const userPrompt = buildGenerationPrompt({
        brief: run.brief,
        platform: platform as Platform,
      });

      const result = await generateContent(systemPrompt, userPrompt);

      // 4. Sauvegarder le GeneratedContent
      await prisma.generatedContent.create({
        data: {
          runId: runId,
          profileId: agent.profileId,
          platform: platform as Platform,
          textContent: result.textContent,
          hashtags: result.hashtags || [],
          mediaUrls: [],
          status: agent.autoPublish ? "APPROVED" : "DRAFT",
        },
      });
    }

    // 5. Update run status to SUCCESS
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "SUCCESS", finishedAt: new Date() },
    });
  } catch (error) {
    // 6. On error, update run status to FAILED
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
