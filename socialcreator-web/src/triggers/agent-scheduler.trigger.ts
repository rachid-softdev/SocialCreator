/**
 * Trigger.dev job for agent scheduling
 * Cron job: runs every hour, checks active agents with scheduleCron
 * For each agent due: triggers agentRunJob with the schedule brief
 */

import { client } from "@/lib/trigger";

// Mock triggerHttpPayload - will be replaced with actual implementation
const triggerHttpPayload = (config: any) => config;
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueAgentRun } from "@/lib/trigger-client";
import parser from "cron-parser";

// Payload schema for scheduler job
const SchedulerPayloadSchema = z.object({
  agentId: z.string(),
});

// Cron trigger: runs every hour
// In production, configure this via Trigger.dev dashboard
export const agentSchedulerJob = client.defineJob({
  id: "agent-scheduler",
  name: "Agent Scheduler",
  version: "0.0.1",
  trigger: triggerHttpPayload({
    schema: z.object({
      // Empty payload for cron-triggered jobs
    }),
  }),
  output: z.object({
    agentsProcessed: z.number(),
    runsTriggered: z.number(),
  }),
  // No retries for scheduler - it's a lightweight check
  run: async (payload: any, io: any) => {
    await io.logger.info("Starting agent scheduler check");

    // Fetch all active agents with scheduleCron
    const agents = await io.runTask(
      "fetch-scheduled-agents",
      { timeout: "30s" },
      async () => {
        return await prisma.agent.findMany({
          where: {
            isActive: true,
            scheduleCron: { not: null },
          },
          include: {
            profile: {
              select: { id: true, name: true, userId: true },
            },
            runs: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });
      }
    );

    let runsTriggered = 0;

    // Check each agent for due run using cron-parser
    for (const agent of agents) {
      if (!agent.scheduleCron) continue;

      try {
        // Use cron-parser to properly evaluate the schedule
        const interval = parser.parseExpression(agent.scheduleCron, {
          currentDate: new Date(),
          iterator: true,
        });

        // Get the next few occurrences to see if we're at the right time
        const now = new Date();
        let shouldRun = false;

        // Check if current minute matches any of the next occurrences
        for (let i = 0; i < 60; i++) {
          const next = interval.next();
          const nextDate = next.value.toDate();

          // If next occurrence is within the current minute, trigger
          if (
            nextDate.getUTCHours() === now.getUTCHours() &&
            nextDate.getUTCMinutes() === now.getUTCMinutes()
          ) {
            shouldRun = true;
            break;
          }

          // If we've gone past the current minute by more than 1 minute, stop
          if (nextDate.getTime() > now.getTime() + 60000) {
            break;
          }
        }

        if (shouldRun && agent.platforms.length > 0) {
        await io.logger.info("Triggering agent run", {
          agentId: agent.id,
          agentName: agent.name,
        });

        try {
          // Create a new run
          const run = await io.runTask(
            "create-run",
            { timeout: "10s" },
            async () => {
              return await prisma.agentRun.create({
                data: {
                  agentId: agent.id,
                  brief: `Scheduled run for ${agent.name}`,
                  status: "PENDING",
                },
              });
            }
          );

          // Enqueue the run
          await enqueueAgentRun({
            agentId: agent.id,
            runId: run.id,
            userId: agent.profile.userId,
            profileId: agent.profile.id,
          });

          runsTriggered++;
        } catch (error) {
          await io.logger.error("Failed to trigger agent run", {
            agentId: agent.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        }
      } catch (error) {
        await io.logger.warn("Invalid cron expression for agent", {
          agentId: agent.id,
          scheduleCron: agent.scheduleCron,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await io.logger.info("Scheduler check completed", {
      agentsFound: agents.length,
      runsTriggered,
    });

    return {
      agentsProcessed: agents.length,
      runsTriggered,
    };
  },
});

/**
 * Manually trigger scheduler check
 */
export async function triggerSchedulerCheck(): Promise<void> {
  const apiUrl = process.env.TRIGGER_API_URL;
  const apiKey = process.env.TRIGGER_API_KEY;

  if (!apiUrl || !apiKey) {
    console.warn("Trigger.dev not configured, scheduler runs synchronously");
    return;
  }

  const response = await fetch(
    `${apiUrl}/v1/jobs/agent-scheduler/trigger`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to trigger scheduler: ${response.statusText}`);
  }
}
