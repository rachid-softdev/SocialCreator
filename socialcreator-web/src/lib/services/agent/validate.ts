/**
 * Agent validation — checks agent exists and CGU is accepted
 */
import type { Agent, Profile, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AgentWithProfile = Agent & {
  profile: Profile & { user: Pick<User, "cguAccepted"> };
};

/**
 * Validate that the agent exists and the user has accepted CGU.
 * If CGU is not accepted, marks the run as FAILED (soft fail).
 */
export async function validateAgentRun(
  agentId: string,
  runId: string,
): Promise<AgentWithProfile | null> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      profile: {
        include: {
          user: { select: { cguAccepted: true } },
        },
      },
    },
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  if (!agent.profile.user.cguAccepted) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: "CGU acceptance required to run agents",
      },
    });
    return null;
  }

  return agent;
}
