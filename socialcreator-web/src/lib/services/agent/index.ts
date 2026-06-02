/**
 * Agent runner orchestrator
 *
 * Coordinates the agent run lifecycle: validate → execute → persist
 */

import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { agentRunDuration } from "@/lib/utils/metrics";
import { executeAgentRun } from "./execute";
import { markRunFailed, markRunRunning, markRunSuccess, saveGeneratedContent } from "./persist";
import { validateAgentRun } from "./validate";

export interface TriggerAgentRunParams {
  agentId: string;
  runId: string;
}

/**
 * Trigger an agent run: validate, execute, save, and mark result.
 */
export async function triggerAgentRun(params: TriggerAgentRunParams): Promise<void> {
  const { agentId, runId } = params;

  // 1. Validate: agent exists + CGU accepted
  const agent = await validateAgentRun(agentId, runId);
  if (!agent) return; // soft fail (CGU not accepted)

  // 2. Mark run as RUNNING
  await markRunRunning(runId);

  // 3. Fetch run for brief
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new Error("Run not found");
  }

  const startTime = performance.now();
  try {
    // 4. Execute: generate content for all platforms in parallel
    const results = await executeAgentRun(agent, run.brief);

    // 5. Persist: save generated content atomically
    await saveGeneratedContent(runId, agent.profileId, results);

    // 6. Mark run as SUCCESS
    await markRunSuccess(runId);

    agentRunDuration.observe({ status: "success" }, (performance.now() - startTime) / 1000);
  } catch (error) {
    // 7. On error, mark run as FAILED
    logger.error({ err: error }, "Agent run failed");
    await markRunFailed(runId, error instanceof Error ? error.message : "Unknown error");

    agentRunDuration.observe({ status: "failed" }, (performance.now() - startTime) / 1000);
    throw error;
  }
}
