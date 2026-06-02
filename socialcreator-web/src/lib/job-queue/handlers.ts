/**
 * Job handler registry
 * Maps job types to their handler functions
 */

import logger from "@/lib/logger";
import { publishContent } from "@/lib/publishers";
import { triggerAgentRun } from "@/lib/services/agent";
import type {
  AgentRunPayload,
  ContentGeneratePayload,
  JobType,
  PublishPayload,
  VideoProcessPayload,
} from "./types";

const handlerRegistry = new Map<JobType, (payload: any) => Promise<void>>();

/**
 * Register a handler for a job type
 */
export function registerHandler(type: JobType, handler: (payload: any) => Promise<void>): void {
  handlerRegistry.set(type, handler);
}

/**
 * Get the handler for a job type
 */
export function getJobHandler(type: JobType): ((payload: any) => Promise<void>) | undefined {
  return handlerRegistry.get(type);
}

// ── Built-in handler registrations ────────────────────────────

registerHandler("agent-run", async (payload: AgentRunPayload) => {
  logger.info({ agentId: payload.agentId, runId: payload.runId }, "Processing agent-run job");

  const { prisma } = await import("@/lib/prisma");
  const agent = await prisma.agent.findUnique({
    where: { id: payload.agentId },
    select: { profile: { select: { userId: true } } },
  });

  if (!agent) throw new Error("Agent not found");
  if (agent.profile.userId !== payload.userId) {
    throw new Error("Unauthorized: agent does not belong to user");
  }

  await triggerAgentRun({ runId: payload.runId, agentId: payload.agentId });
});

registerHandler("content-generate", async (payload: ContentGeneratePayload) => {
  logger.info(
    { profileId: payload.profileId, platform: payload.platform },
    "Content generation not yet implemented",
  );
});

registerHandler("publish", async (payload: PublishPayload) => {
  logger.info(
    { contentId: payload.contentId, platform: payload.platform },
    "Processing publish job",
  );

  const { prisma } = await import("@/lib/prisma");

  const content = await prisma.generatedContent.findUnique({
    where: { id: payload.contentId },
    include: { profile: { select: { userId: true } } },
  });

  if (!content) throw new Error("Content not found");
  if (content.profile.userId !== payload.userId) {
    throw new Error("Unauthorized: content does not belong to user");
  }

  const account = await prisma.connectedAccount.findFirst({
    where: {
      profileId: payload.profileId,
      platform: payload.platform,
      isActive: true,
    },
  });

  if (!account) throw new Error("No connected account found");

  await publishContent(
    payload.platform,
    {
      textContent: content.textContent,
      mediaUrls: content.mediaUrls,
      hashtags: content.hashtags,
    },
    {
      accountId: account.accountId,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken ?? undefined,
    },
  );
});

registerHandler("video-process", async (payload: VideoProcessPayload) => {
  logger.info({ videoAssetId: payload.videoAssetId }, "Processing video-process job");

  const { processVideoPipeline } = await import("@/lib/services/video-pipeline");
  await processVideoPipeline(payload.videoAssetId);
});
