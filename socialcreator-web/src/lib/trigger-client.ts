// Trigger.dev integration
// To use Trigger.dev in production:
// 1. Install @trigger.dev/sdk: npm install @trigger.dev/sdk
// 2. Set environment variables:
//    TRIGGER_API_KEY=your_api_key
//    TRIGGER_API_URL=https://api.trigger.dev
// 3. Configure your trigger endpoint in trigger.config.ts
// 4. Import and register jobs in src/triggers/index.ts

import { triggerAgentRun } from "@/lib/agent-runner";

export interface AgentRunJobPayload {
  agentId: string;
  runId: string;
  userId: string;
  profileId: string;
}

// Example Trigger.dev job definition (for production use)
/*
import { client, triggerHttpPayload } from "@trigger.dev/sdk";
import { z } from "zod";

export const agentRunJob = client.defineJob({
  id: "agent-run",
  name: "Agent Run",
  version: "0.0.1",
  trigger: triggerHttpPayload({
    schema: z.object({
      agentId: z.string(),
      runId: z.string(),
    }),
  }),
  output: z.object({
    runId: z.string(),
    contentsCreated: z.number(),
    status: z.enum(["SUCCESS", "FAILED"]),
  }),
  retries: {
    maxAttempts: 3,
    backoff: {
      type: "exponential",
      seconds: [10, 30, 60],
    },
  },
  run: async (payload, io) => {
    await io.logger.info("Starting agent run", payload);

    const result = await io.runTask(
      "execute-agent-run",
      { timeout: "10m" },
      async () => {
        return await triggerAgentRun(payload);
      }
    );

    await io.logger.info("Agent run completed", result);

    return {
      runId: payload.runId,
      contentsCreated: result.contentsCreated,
      status: "SUCCESS",
    };
  },
});
*/

// Export a function to send job to Trigger.dev (for production)
export async function enqueueAgentRun(payload: AgentRunJobPayload): Promise<void> {
  const apiUrl = process.env.TRIGGER_API_URL;
  const apiKey = process.env.TRIGGER_API_KEY;

  if (!apiUrl || !apiKey) {
    console.warn("Trigger.dev not configured, running job synchronously");
    await triggerAgentRun(payload);
    return;
  }

  const response = await fetch(`${apiUrl}/v1/jobs/agent-run/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to enqueue job: ${response.statusText}`);
  }
}

// Export a function to check Trigger.dev configuration
export function isTriggerConfigured(): boolean {
  return !!(process.env.TRIGGER_API_URL && process.env.TRIGGER_API_KEY);
}
