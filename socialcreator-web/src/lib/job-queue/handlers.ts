/**
 * Job handler registry
 * Maps job types to their handler functions
 * Uses repository pattern for data access
 */

import { computeContentHash } from "@socialcreator/utils";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
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

  const { generateAndSaveContent } = await import("@/lib/content/generator");

  const results = await generateAndSaveContent({
    profileId: payload.profileId,
    platform: payload.platform,
    brief: payload.brief,
    keywords: payload.keywords,
    brandVoice: payload.brandVoice,
    count: payload.count,
  });

  logger.info(
    { count: results.length, platform: payload.platform },
    "Content generated successfully via LLM",
  );
});

registerHandler("publish", async (payload: PublishPayload) => {
  logger.info(
    { contentId: payload.contentId, platform: payload.platform },
    "Processing publish job",
  );

  const {
    content: contentRepo,
    connectedAccount: caRepo,
    profile: profileRepo,
    publishLog: publishLogRepo,
  } = getRepositories();

  const content = await contentRepo.findById(payload.contentId);
  if (!content) throw new Error("Content not found");

  // ── Atomic claim: prevent concurrent publish of the same content ──
  // Atomically transition from APPROVED/SCHEDULED → PUBLISHING.
  // If another worker has already claimed it, 0 rows are affected → skip.
  const claimed = await prisma.generatedContent.updateMany({
    where: {
      id: payload.contentId,
      status: { in: ["APPROVED", "SCHEDULED"] },
    },
    data: { status: "PUBLISHING" },
  });
  if (claimed.count === 0) {
    logger.warn(
      { contentId: payload.contentId },
      "Content already claimed by another worker (status not APPROVED/SCHEDULED), skipping",
    );
    return;
  }

  // Compute content hash for idempotency
  const contentHash =
    payload.contentHash ??
    computeContentHash({
      profileId: payload.profileId,
      platform: payload.platform,
      textContent: content.textContent,
      mediaUrls: content.mediaUrls,
      hashtags: content.hashtags,
    });

  // Idempotency check: skip if already published successfully
  const existing = await publishLogRepo.findSuccessfulByContentHash(contentHash, payload.profileId);
  if (existing) {
    logger.info(
      { contentId: payload.contentId, contentHash },
      "Content already published, skipping",
    );
    await contentRepo.updateStatus(payload.contentId, "PUBLISHED");
    return;
  }

  // Resolve userId from profile if not provided
  if (!payload.userId) {
    const profile = await profileRepo.findById(content.profileId);
    if (profile) {
      payload = { ...payload, userId: profile.userId };
    }
  }

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

  // Check daily cap (per-profile, per-platform)
  // NOTE: This check has a TOCTOU window: two different content items for the
  // same profile could both pass this check concurrently. For strict atomicity,
  // use Redis INCR with daily TTL as described in the TODO below.
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
    // Release the publishing lock so content can be retried
    await contentRepo.updateStatus(payload.contentId, "APPROVED");
    return;
  }

  // Lookup connected account
  const account = await caRepo.findByProfileAndPlatform(payload.profileId, payload.platform as any);

  if (!account?.isActive) {
    await contentRepo.updateStatus(payload.contentId, "FAILED");
    throw new Error("No active connected account found");
  }

  // Get valid access token
  const accessToken = await getValidAccessToken(account.id);
  if (!accessToken) {
    await contentRepo.updateStatus(payload.contentId, "FAILED");
    throw new Error("Failed to get access token");
  }

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
    try {
      await publishLogRepo.create({
        userId: payload.userId || "",
        profileId: payload.profileId,
        platform: payload.platform as any,
        contentId: payload.contentId,
        contentHash,
        success: true,
      });
    } catch (err) {
      // Expected when the @@unique([contentHash, profileId, success]) constraint
      // catches a duplicate — this is an idempotency safety net, not an error.
      logger.warn(
        { contentId: payload.contentId, contentHash, err },
        "PublishLog already exists (duplicate prevention via unique constraint)",
      );
    }
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
      contentHash,
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
