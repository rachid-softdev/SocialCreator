/**
 * Agent run job queue helper
 * Replaced Trigger.dev with in-process job queue for async execution
 */

import type { AgentRunPayload } from "@/lib/job-queue";
import { enqueueJob } from "@/lib/job-queue";

export interface AgentRunJobPayload {
  agentId: string;
  runId: string;
  userId: string;
  profileId: string;
}

/**
 * Enqueue an agent run for async execution
 * Uses the in-process job queue with retry support
 */
export async function enqueueAgentRun(payload: AgentRunJobPayload): Promise<void> {
  enqueueJob(
    "agent-run",
    {
      agentId: payload.agentId,
      runId: payload.runId,
      userId: payload.userId,
    } satisfies AgentRunPayload,
    { maxAttempts: 2, retryDelayMs: 5000 },
  );
}

/**
 * Check if Trigger.dev configuration exists (legacy check)
 * @deprecated Trigger.dev has been replaced by in-process job queue
 */
export function isTriggerConfigured(): boolean {
  return !!(process.env.TRIGGER_API_URL && process.env.TRIGGER_API_KEY);
}
