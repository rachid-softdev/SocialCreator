/**
 * Async Agent Queue - Types
 * Job types, statuses, payloads, and interfaces
 */

import type { Platform } from "@prisma/client";

export type JobType = "agent-run" | "content-generate" | "publish" | "video-process";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobPriority = "low" | "normal" | "high" | "critical";

export interface AgentRunPayload {
  agentId: string;
  runId: string;
  userId: string;
}

export interface ContentGeneratePayload {
  userId: string;
  profileId: string;
  platform: Platform;
  brief: string;
  agentId: string;
  keywords?: string[];
  brandVoice?: string;
  count?: number;
}

export interface PublishPayload {
  contentId: string;
  profileId: string;
  platform: Platform;
  userId: string;
}

export interface VideoProcessPayload {
  videoAssetId: string;
  profileId: string;
}

export type JobPayload =
  | AgentRunPayload
  | ContentGeneratePayload
  | PublishPayload
  | VideoProcessPayload;

export interface Job {
  id: string;
  type: JobType;
  payload: JobPayload;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  retryDelayMs: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
}

export interface JobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  retryDelayMs?: number;
  delayMs?: number;
}

export type JobHandler<T extends JobPayload = JobPayload> = (payload: T) => Promise<void>;

export interface JobHandlerRegistration {
  type: JobType;
  handler: JobHandler;
}
