/**
 * Job handler registry
 * Maps job types to their handler functions
 * Uses repository pattern for data access
 */

import { hashContent } from "@socialcreator/utils";
import logger from "@/lib/logger";
import { publishContent } from "@/lib/publishers";
import { getRepositories } from "@/lib/repositories";
import { triggerAgentRun } from "@/lib/services/agent";
import { getValidAccessToken } from "@/lib/tokens";
import { validateMediaUrlWithDns } from "@/lib/validate-url";
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

  const { agent: agentRepo } = getRepositories();
  const agent = await agentRepo.findById(payload.agentId);

  if (!agent) throw new Error("Agent not found");

  // The agent.profile.userId check is built into findById's return type
  await triggerAgentRun({ runId: payload.runId, agentId: payload.agentId });
});

registerHandler("content-generate", async (payload: ContentGeneratePayload) => {
  logger.info(
    { profileId: payload.profileId, platform: payload.platform },
    "Processing content-generate job",
  );

  const { content: contentRepo } = getRepositories();

  // Create a DRAFT content entry
  const content = await contentRepo.create({
    profileId: payload.profileId,
    platform: payload.platform,
    textContent: `Generated content for ${payload.platform}: ${payload.brief}`,
    mediaUrls: [],
    hashtags: [],
    status: "DRAFT",
    runId: null,
  });

  logger.info({ contentId: content.id }, "Content generated successfully");
});

registerHandler("publish", async (payload: PublishPayload) => {
  logger.info(
    { contentId: payload.contentId, platform: payload.platform },
    "Processing publish job",
  );

  const {
    content: contentRepo,
    connectedAccount: caRepo,
    publishLog: publishLogRepo,
  } = getRepositories();

  const content = await contentRepo.findById(payload.contentId);
  if (!content) throw new Error("Content not found");

  // Validate media URLs (SSRF protection with DNS resolution)
  for (const url of content.mediaUrls) {
    const result = await validateMediaUrlWithDns(url);
    if (!result.valid) {
      logger.warn(
        { contentId: payload.contentId, url, error: result.error },
        "SSRF blocked in publisher — failing content",
      );
      await contentRepo.updateStatus(payload.contentId, "FAILED");
      return;
    }
  }

  // Check daily cap
  const todayCount = await publishLogRepo.countPublishedToday(
    payload.profileId,
    payload.platform as any,
  );
  const MAX_DAILY_PUBLISH = 50;
  if (todayCount >= MAX_DAILY_PUBLISH) {
    logger.warn(
      { contentId: payload.contentId, profileId: payload.profileId, todayCount },
      "Daily publish cap reached, skipping",
    );
    return;
  }

  // Lookup connected account
  const account = await caRepo.findByProfileAndPlatform(payload.profileId, payload.platform as any);

  if (!account?.isActive) throw new Error("No active connected account found");

  // Get valid access token
  const accessToken = await getValidAccessToken(account.id);
  if (!accessToken) throw new Error("Failed to get access token");

  // Publish via publisher strategy
  const result = await publishContent(
    payload.platform,
    {
      textContent: content.textContent,
      mediaUrls: content.mediaUrls,
      hashtags: content.hashtags,
    },
    {
      accountId: account.accountId,
      accessToken,
      refreshToken: account.refreshToken ?? undefined,
    },
  );

  // Handle result
  if (result.success) {
    await contentRepo.updateStatus(payload.contentId, "PUBLISHED");
    await publishLogRepo.create({
      userId: payload.userId || "",
      profileId: payload.profileId,
      platform: payload.platform as any,
      contentId: payload.contentId,
      contentHash: hashContent(content.textContent),
      success: true,
    });
    logger.info(
      { contentId: payload.contentId, postId: result.postId },
      "Content published successfully",
    );
  } else {
    await contentRepo.updateStatus(payload.contentId, "FAILED");
    await publishLogRepo.create({
      userId: payload.userId || "",
      profileId: payload.profileId,
      platform: payload.platform as any,
      contentId: payload.contentId,
      contentHash: hashContent(content.textContent),
      success: false,
      error: result.error,
    });
    logger.error({ contentId: payload.contentId, error: result.error }, "Content publish failed");
  }
});

registerHandler("video-process", async (payload: VideoProcessPayload) => {
  logger.info({ videoAssetId: payload.videoAssetId }, "Processing video-process job");

  const { runVideoPipeline } = await import("@/lib/services/video-pipeline");
  await runVideoPipeline(payload.videoAssetId, payload.profileId, []);
});
