import type { Agent, AgentRun, GeneratedContent, AgentType, RunStatus, ContentStatus, Platform } from "@prisma/client";

// Re-export types
export type { Agent, AgentRun, GeneratedContent, AgentType, RunStatus, ContentStatus, Platform }

// Agent with relations
export type AgentWithRelations = Agent & {
  profile: {
    id: string;
    name: string;
  };
  _count: {
    runs: number;
  };
  runs?: AgentRun[];
};

// AgentRun with relations
export type AgentRunWithRelations = AgentRun & {
  agent: {
    id: string;
    name: string;
    type: AgentType;
  };
  generatedContents?: GeneratedContent[];
};

// GeneratedContent with relations
export type GeneratedContentWithRelations = GeneratedContent & {
  profile?: {
    id: string;
    name: string;
  };
  run?: {
    id: string;
    agent?: {
      id: string;
      name: string;
    };
  } | null;
};

// API Request/Response types
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

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Agent type labels
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

// Run status
export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  SUCCESS: "Success",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const RUN_STATUS_COLORS: Record<RunStatus, string> = {
  PENDING: "bg-muted-soft text-muted",
  RUNNING: "bg-gradient-sky text-ink animate-pulse",
  SUCCESS: "bg-semantic-success/10 text-semantic-success",
  FAILED: "bg-semantic-error/10 text-semantic-error",
  CANCELLED: "bg-muted-soft text-muted",
};

// Platform constraints for content preview
export const PLATFORM_CONSTRAINTS: Record<Platform, {
  maxChars: number;
  maxHashtags: number;
  supportsVideo: boolean;
  supportsImages: boolean;
}> = {
  INSTAGRAM: { maxChars: 2200, maxHashtags: 30, supportsVideo: true, supportsImages: true },
  TIKTOK: { maxChars: 150, maxHashtags: 10, supportsVideo: true, supportsImages: false },
  LINKEDIN: { maxChars: 3000, maxHashtags: 5, supportsVideo: true, supportsImages: true },
  YOUTUBE: { maxChars: 5000, maxHashtags: 15, supportsVideo: true, supportsImages: false },
  X: { maxChars: 280, maxHashtags: 3, supportsVideo: true, supportsImages: true },
  FACEBOOK: { maxChars: 63206, maxHashtags: 10, supportsVideo: true, supportsImages: true },
  THREADS: { maxChars: 500, maxHashtags: 10, supportsVideo: true, supportsImages: true },
  PINTEREST: { maxChars: 500, maxHashtags: 20, supportsVideo: false, supportsImages: true },
};
