import type { Platform } from "@prisma/client";
import { generateContent } from "@/lib/llm";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildGenerationPrompt, buildSystemPrompt } from "@/lib/prompts";

interface TriggerAgentRunParams {
  agentId: string;
  runId: string;
}

export async function triggerAgentRun(params: TriggerAgentRunParams): Promise<void> {
  const { agentId, runId } = params;

  // 1. Fetch agent + profile + user (for CGU check)
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      profile: {
        include: {
          user: { select: { cguAccepted: true } },
        },
      },
    },
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  // 2. CGU CHECK — user must accept terms before running agents
  if (!agent.profile.user.cguAccepted) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: "CGU acceptance required to run agents",
      },
    });
    return;
  }

  // 3. Update run status to RUNNING
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
    // 4. Generate content for ALL platforms IN PARALLEL using Promise.all
    const results = await Promise.all(
      agent.platforms.map(async (platform) => {
        const userPrompt = buildGenerationPrompt({
          brief: run.brief,
          platform: platform as Platform,
        });
        const result = await generateContent(systemPrompt, userPrompt);
        return { platform, result };
      }),
    );

    // 5. Save all GeneratedContent atomically in a single transaction
    //    STATUS IS ALWAYS DRAFT — auto-publish workflow is handled separately
    //    This ensures human approval gate is never bypassed
    await prisma.$transaction(
      results.map(({ platform, result }) =>
        prisma.generatedContent.create({
          data: {
            runId: runId,
            profileId: agent.profileId,
            platform: platform as Platform,
            textContent: result.textContent,
            hashtags: result.hashtags || [],
            mediaUrls: [],
            status: "DRAFT",
          },
        }),
      ),
    );

    // 6. Update run status to SUCCESS
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "SUCCESS", finishedAt: new Date() },
    });
  } catch (error) {
    // 7. On error, update run status to FAILED
    logger.error({ err: error }, "Agent run failed");
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
