// Trigger.dev integration placeholder
// This file provides the structure for Trigger.dev integration
// In production, you would install @trigger.dev/sdk and configure it

// The agent run job definition would look like:
// import { client } from "@/trigger"
// import { triggerHttpPayload } from "@trigger.dev/sdk"
// import { z } from "zod"
//
// export const agentRunJob = client.defineJob({
//   id: "agent-run",
//   name: "Agent Run",
//   version: "0.0.1",
//   trigger: triggerHttpPayload({
//     schema: z.object({
//       agentId: z.string(),
//       runId: z.string(),
//     }),
//   }),
//   run: async (job) => {
//     const { triggerAgentRun } = await import("@/lib/agent-runner");
//     await triggerAgentRun(job.payload);
//   },
// });

// For now, we use direct execution via triggerAgentRun
// which can be called from API routes

export interface AgentRunPayload {
  agentId: string;
  runId: string;
}

// Export a function to get the trigger endpoint URL
export function getTriggerEndpoint(): string {
  return process.env.TRIGGER_API_URL || "https://trigger.dev";
}

// Export a function to check if trigger is configured
export function isTriggerConfigured(): boolean {
  return !!(
    process.env.TRIGGER_API_URL &&
    process.env.TRIGGER_API_KEY
  );
}
