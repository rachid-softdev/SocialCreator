/**
 * Agent Scheduler - checks active agents with scheduleCron and triggers due runs
 * Called by cron job or manually
 */

import parser from "cron-parser";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enqueueAgentRun } from "@/lib/trigger-client";

export async function runAgentScheduler(): Promise<{
  agentsProcessed: number;
  runsTriggered: number;
}> {
  logger.info("Starting agent scheduler check");

  const agents = await prisma.agent.findMany({
    where: { isActive: true, scheduleCron: { not: null } },
    include: {
      profile: { select: { id: true, name: true, userId: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  let runsTriggered = 0;

  for (const agent of agents) {
    if (!agent.scheduleCron) continue;
    try {
      const interval = parser.parseExpression(agent.scheduleCron, {
        currentDate: new Date(),
        iterator: true,
      });

      const now = new Date();
      let shouldRun = false;

      for (let i = 0; i < 60; i++) {
        const next = interval.next();
        const nextDate = next.value.toDate();
        if (
          nextDate.getUTCHours() === now.getUTCHours() &&
          nextDate.getUTCMinutes() === now.getUTCMinutes()
        ) {
          shouldRun = true;
          break;
        }
        if (nextDate.getTime() > now.getTime() + 60000) break;
      }

      if (shouldRun && agent.platforms.length > 0) {
        logger.info({ agentId: agent.id, agentName: agent.name }, "Triggering agent run");

        try {
          const run = await prisma.agentRun.create({
            data: {
              agentId: agent.id,
              brief: `Scheduled run for ${agent.name}`,
              status: "PENDING",
            },
          });

          await enqueueAgentRun({
            agentId: agent.id,
            runId: run.id,
            userId: agent.profile.userId,
            profileId: agent.profile.id,
          });

          runsTriggered++;
        } catch (error) {
          logger.error({ agentId: agent.id, err: error }, "Failed to trigger agent run");
        }
      }
    } catch (error) {
      logger.warn(
        { agentId: agent.id, scheduleCron: agent.scheduleCron, err: error },
        "Invalid cron expression",
      );
    }
  }

  logger.info({ agentsFound: agents.length, runsTriggered }, "Scheduler check completed");
  return { agentsProcessed: agents.length, runsTriggered };
}
