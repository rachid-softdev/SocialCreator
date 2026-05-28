import type {
  Agent,
  AgentRun,
  AgentType,
  ContentStatus,
  GeneratedContent,
  RunStatus,
} from "@prisma/client";
import type { Platform } from "./platforms";

export type { Agent, AgentRun, AgentType, ContentStatus, GeneratedContent, Platform, RunStatus };

export type AgentWithRelations = Agent & {
  profile: { id: string; name: string };
  _count: { runs: number };
  runs?: AgentRun[];
};

export type AgentRunWithRelations = AgentRun & {
  agent: { id: string; name: string; type: AgentType };
  generatedContents?: GeneratedContent[];
};

export type GeneratedContentWithRelations = GeneratedContent & {
  profile?: { id: string; name: string };
  run?: { id: string; agent?: { id: string; name: string } } | null;
};

export interface CreateAgentRequest {
  profileId: string;
  name: string;
  type: AgentType;
  platforms: Platform[];
  scheduleCron?: string;
  autoPublish?: boolean;
  maxPerDay?: number;
  config?: Record<string, unknown>;
}

export interface UpdateAgentRequest {
  name?: string;
  type?: AgentType;
  platforms?: Platform[];
  scheduleCron?: string;
  isActive?: boolean;
  autoPublish?: boolean;
  maxPerDay?: number;
  config?: Record<string, unknown>;
}

export interface CreateRunRequest {
  brief: string;
}

export interface UpdateContentRequest {
  textContent?: string;
  hashtags?: string[];
  status?: ContentStatus;
}

export interface RejectContentRequest {
  reason?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  TEXT_POST: "Text Post",
  VIDEO_CLIP: "Video Clip",
  CROSS_POST: "Cross Post",
};

export const AGENT_TYPE_DESCRIPTIONS: Record<AgentType, string> = {
  TEXT_POST: "Generate engaging text posts for your social media channels",
  VIDEO_CLIP: "Create content optimized for short-form video platforms",
  CROSS_POST: "Adapt content across multiple platforms automatically",
};

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const RUN_STATUS_COLORS: Record<RunStatus, string> = {
  PENDING: "bg-muted-soft text-muted",
  RUNNING: "bg-blue-100 text-blue-800 animate-pulse",
  SUCCESS: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export { PLATFORM_CONSTRAINTS } from "./platforms";
