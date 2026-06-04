/**
 * Agent persistence — run status updates and content storage
 */
import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { contentGenerated } from "@/lib/utils/metrics";
import type { GenerationResult } from "./execute";

/**
 * Mark a run as RUNNING (started).
 */
export async function markRunRunning(runId: string): Promise<void> {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

/**
 * Save generated content atomically in a single transaction.
 * Status is always DRAFT — auto-publish workflow handled separately.
 */
export async function saveGeneratedContent(
  runId: string,
  profileId: string,
  results: GenerationResult[],
): Promise<void> {
  await prisma.$transaction(
    results.map(({ platform, textContent, hashtags }) =>
      prisma.generatedContent.create({
        data: {
          runId,
          profileId,
          platform: platform as Platform,
          textContent,
          hashtags: hashtags || [],
          mediaUrls: [],
          status: "DRAFT",
        },
      }),
    ),
  );

  // Track business metric (platform label always lowercase for Prometheus consistency)
  for (const { platform, textContent } of results) {
    const platformLower = platform.toLowerCase();
    contentGenerated.inc({ platform: platformLower, type: textContent ? "text" : "media" });
    contentGenerated.inc({ platform: platformLower, type: "agent" });
  }
}

/**
 * Mark a run as SUCCESS.
 */
export async function markRunSuccess(runId: string): Promise<void> {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "SUCCESS", finishedAt: new Date() },
  });
}

/**
 * Mark a run as FAILED with an error message.
 */
export async function markRunFailed(runId: string, error: string): Promise<void> {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "FAILED", finishedAt: new Date(), error },
  });
}
