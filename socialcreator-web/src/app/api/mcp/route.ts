import type { AgentType, Platform } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { triggerAgentRun } from "@/lib/agent-runner";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getIdentifier } from "@/lib/rate-limit-redis";
import { authenticateMcpRequest } from "./auth";

// JSON-RPC error codes
const ERROR_INVALID_REQUEST = -32600;
const ERROR_METHOD_NOT_FOUND = -32601;
const ERROR_INVALID_PARAMS = -32602;
const ERROR_AUTH_ERROR = -32000;
const ERROR_NOT_FOUND = -32001;
const ERROR_CONFLICT = -32002;
const ERROR_INTERNAL_ERROR = -32003;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Validation schemas
const CreateAgentSchema = z.object({
  profile_id: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(["TEXT_POST", "VIDEO_CLIP", "CROSS_POST"]),
  platforms: z.array(
    z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN", "THREADS", "PINTEREST"]),
  ),
  schedule: z.string().optional(),
  auto_publish: z.boolean().optional(),
  max_per_day: z.number().optional(),
});

const RunAgentSchema = z.object({
  agent_id: z.string(),
  brief: z.string().min(1),
});

const _GetRunStatusSchema = z.object({
  run_id: z.string(),
});

export async function POST(request: NextRequest) {
  // 1. AUTHENTICATE FIRST — before rate limiting or any processing
  //    This prevents unauthenticated requests from consuming rate-limit capacity
  //    and ensures rate-limit identifier uses the authenticated userId
  const auth = await authenticateMcpRequest();
  if (!auth) {
    return createJsonRpcErrorResponse(null, ERROR_AUTH_ERROR, "Invalid or missing API key");
  }

  // 2. Rate limit AFTER auth — uses userId for more accurate rate limiting
  const identifier = getIdentifier(request, auth.userId);
  const rateLimitResult = await checkRateLimit(request, identifier);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
      },
      { status: 429 },
    );
  }

  try {
    const body: JsonRpcRequest = await request.json();

    // Validate JSON-RPC structure
    if (!body.jsonrpc || body.jsonrpc !== "2.0") {
      return createJsonRpcErrorResponse(body.id, ERROR_INVALID_REQUEST, "Invalid JSON-RPC version");
    }

    if (!body.method || typeof body.method !== "string") {
      return createJsonRpcErrorResponse(body.id, ERROR_INVALID_REQUEST, "Method is required");
    }

    const { method, params = {}, id } = body;

    // Route to handler
    let result: unknown;
    switch (method) {
      case "list_agents":
        result = await handleListAgents(auth.userId, params.profile_id as string | undefined);
        break;

      case "get_agent":
        result = await handleGetAgent(auth.userId, params.agent_id as string);
        break;

      case "create_agent":
        result = await handleCreateAgent(auth.userId, params);
        break;

      case "run_agent":
        result = await handleRunAgent(auth.userId, params);
        break;

      case "get_run_status":
        result = await handleGetRunStatus(auth.userId, params.run_id as string);
        break;

      case "list_profiles":
        result = await handleListProfiles(auth.userId);
        break;

      default:
        return createJsonRpcErrorResponse(
          id,
          ERROR_METHOD_NOT_FOUND,
          `Method '${method}' not found`,
        );
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result,
    } as JsonRpcResponse);
  } catch (error) {
    logger.error({ err: error, handler: "mcp" }, "MCP handler error");

    if (error instanceof z.ZodError) {
      return createJsonRpcErrorResponse(null, ERROR_INVALID_PARAMS, error.errors[0].message);
    }

    return createJsonRpcErrorResponse(null, ERROR_INTERNAL_ERROR, "Internal server error");
  }
}

function getHttpStatusFromJsonRpcCode(code: number): number {
  switch (code) {
    case -32001:
      return 404; // NOT_FOUND
    case -32000:
      return 401; // AUTH_ERROR
    case -32002:
      return 409; // CONFLICT
    case -32602:
      return 400; // INVALID_PARAMS
    case -32600:
      return 400; // INVALID_REQUEST
    case -32601:
      return 404; // METHOD_NOT_FOUND
    case -32003:
      return 500; // INTERNAL_ERROR
    default:
      return 500;
  }
}

function createJsonRpcErrorResponse(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data,
      },
    } as JsonRpcResponse,
    { status: getHttpStatusFromJsonRpcCode(code) },
  );
}

// Handler implementations
async function handleListAgents(userId: string, profileId?: string) {
  const where: { profile: { userId: string }; profileId?: string } = {
    profile: { userId },
  };

  if (profileId) {
    where.profileId = profileId;
  }

  const agents = await prisma.agent.findMany({
    where,
    select: {
      id: true,
      name: true,
      type: true,
      platforms: true,
      isActive: true,
      autoPublish: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { agents };
}

async function handleGetAgent(userId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      profile: { userId },
    },
    include: {
      runs: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          brief: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  if (!agent) {
    throw { code: ERROR_NOT_FOUND, message: "Agent not found" };
  }

  return { agent };
}

async function handleCreateAgent(userId: string, params: unknown) {
  const parsed = CreateAgentSchema.parse(params);

  // Verify profile ownership
  const profile = await prisma.profile.findFirst({
    where: {
      id: parsed.profile_id,
      userId,
    },
  });

  if (!profile) {
    throw { code: ERROR_NOT_FOUND, message: "Profile not found" };
  }

  // Create the agent first, then we can check runs on this specific agent
  const agent = await prisma.agent.create({
    data: {
      profileId: parsed.profile_id,
      name: parsed.name,
      type: parsed.type as AgentType,
      platforms: parsed.platforms as Platform[],
      scheduleCron: parsed.schedule,
      autoPublish: parsed.auto_publish ?? false,
      maxPerDay: parsed.max_per_day ?? 2,
      isActive: true,
    },
  });

  return { agent_id: agent.id };
}

async function handleRunAgent(userId: string, params: unknown) {
  const parsed = RunAgentSchema.parse(params);

  const agent = await prisma.agent.findFirst({
    where: {
      id: parsed.agent_id,
      profile: { userId },
    },
    include: {
      profile: true,
    },
  });

  if (!agent) {
    throw { code: ERROR_NOT_FOUND, message: "Agent not found" };
  }

  // Check if agent is already running
  const runningRun = await prisma.agentRun.findFirst({
    where: {
      agentId: agent.id,
      status: "RUNNING",
    },
  });

  if (runningRun) {
    throw { code: ERROR_CONFLICT, message: "Agent is already running" };
  }

  // Create run record
  const run = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      brief: parsed.brief,
      status: "PENDING",
    },
  });

  // Trigger async execution
  // In production, this would be queued via Trigger.dev
  // For now, we execute immediately
  queueMicrotask(async () => {
    try {
      await triggerAgentRun({ runId: run.id, agentId: agent.id });
    } catch (error) {
      logger.error({ err: error, handler: "agent-run" }, "Agent run error");
      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  });

  return { run_id: run.id, status: "PENDING" };
}

async function handleGetRunStatus(userId: string, runId: string) {
  const run = await prisma.agentRun.findFirst({
    where: {
      id: runId,
      agent: { profile: { userId } },
    },
    include: {
      generatedContents: {
        select: {
          id: true,
          platform: true,
          status: true,
          publishedAt: true,
        },
      },
    },
  });

  if (!run) {
    throw { code: ERROR_NOT_FOUND, message: "Run not found" };
  }

  return {
    run: {
      id: run.id,
      status: run.status,
      brief: run.brief,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      error: run.error,
      contents: run.generatedContents,
    },
  };
}

async function handleListProfiles(userId: string) {
  const profiles = await prisma.profile.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      platforms: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { profiles };
}
