# Async Agent Queue — SocialCreator

## 1. Overview

The existing `socialcreator-web/src/lib/infrastructure/job-queue.ts` is a minimal in-process
queue with no persistence, no status tracking, and no job types. This document defines an
enhanced queue system for:

- **Agent execution** (already enqueued via `trigger-client.ts`)
- **Content generation** (LLM calls that can take 10-30s)
- **Publishing** (external API calls with rate limits)
- **Video processing** (Mux + Deepgram pipelines)

The design must be implementable by a single developer, keep the in-memory fallback, and
support a future Redis-backed distributed queue upgrade path.

## 2. Constraints

- Build on the existing `job-queue.ts` — don't replace it
- Keep the in-process queue as the default (no new infra dependency)
- The existing `enqueueJob` signature must remain compatible (backward compat)
- Job persistence via DB is a future concern—start with in-memory

## 3. File Structure

```
socialcreator-web/src/lib/job-queue/
├── index.ts              # Barrel export
├── types.ts              # Job types, status, payloads
├── queue.ts              # Enhanced queue with priority + status tracking
├── worker.ts             # Worker pattern for processing
├── handlers.ts           # Job handler registrations
└── __tests__/
    ├── queue.test.ts
    └── worker.test.ts
```

## 4. Types

```typescript
// types.ts
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
  profileId: string;
  platform: Platform;
  brief: string;
  agentId: string;
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

export type JobPayload = AgentRunPayload | ContentGeneratePayload | PublishPayload | VideoProcessPayload;

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
```

## 5. Enhanced Queue

```typescript
// queue.ts
import { randomUUID } from "crypto";
import logger from "@/lib/utils/logger";
import type { Job, JobOptions, JobPayload, JobPriority, JobStatus, JobType } from "./types";

const DEFAULT_OPTIONS = { priority: "normal" as JobPriority, maxAttempts: 3, retryDelayMs: 1000 };
const PRIORITY_ORDER: Record<JobPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

const jobQueue: Job[] = [];
const activeJobs = new Set<string>();

export function enqueueJob<T extends JobPayload>(type: JobType, payload: T, options: JobOptions = {}): string {
  const id = randomUUID();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const job: Job = {
    id, type, payload, priority: opts.priority, status: "queued",
    attempts: 0, maxAttempts: opts.maxAttempts, retryDelayMs: opts.retryDelayMs, createdAt: Date.now(),
  };
  const insertIndex = jobQueue.findIndex((j) => PRIORITY_ORDER[j.priority] > PRIORITY_ORDER[job.priority]);
  if (insertIndex === -1) jobQueue.push(job);
  else jobQueue.splice(insertIndex, 0, job);
  return id;
}

export function dequeueJob(): Job | null {
  const idx = jobQueue.findIndex((j) => j.status === "queued");
  if (idx === -1) return null;
  const job = jobQueue[idx];
  job.status = "running";
  job.startedAt = Date.now();
  job.attempts++;
  activeJobs.add(job.id);
  return job;
}

export function completeJob(id: string, result?: unknown): void {
  const job = jobQueue.find((j) => j.id === id);
  if (job) { job.status = "completed"; job.completedAt = Date.now(); job.result = result; activeJobs.delete(id); }
}

export function failJob(id: string, error: string): void {
  const job = jobQueue.find((j) => j.id === id);
  if (!job) return;
  if (job.attempts < job.maxAttempts) {
    job.status = "queued";
    job.error = error;
    activeJobs.delete(id);
  } else {
    job.status = "failed";
    job.error = error;
    job.completedAt = Date.now();
    activeJobs.delete(id);
  }
}

export function getJob(id: string): Job | undefined { return jobQueue.find((j) => j.id === id); }

export function getQueueStatus() {
  return {
    queued: jobQueue.filter((j) => j.status === "queued").length,
    running: activeJobs.size,
    completed: jobQueue.filter((j) => j.status === "completed").length,
    failed: jobQueue.filter((j) => j.status === "failed").length,
    total: jobQueue.length,
  };
}

export function getActiveCount(): number { return activeJobs.size; }
```

## 6. Worker Pattern

```typescript
// worker.ts
import logger from "@/lib/utils/logger";
import { dequeueJob, completeJob, failJob, getActiveCount } from "./queue";
import { getJobHandler } from "./handlers";
import type { Job } from "./types";

const POLL_INTERVAL_MS = 500;
const MAX_CONCURRENT = 3;
let running = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startWorker(): void {
  if (running) return;
  running = true;
  pollTimer = setInterval(() => {
    if (getActiveCount() >= MAX_CONCURRENT) return;
    const job = dequeueJob();
    if (!job) return;
    processJob(job).catch((err) => logger.error({ jobId: job.id, err }, "Unhandled worker error"));
  }, POLL_INTERVAL_MS);
}

export function stopWorker(): void {
  running = false;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function processJob(job: Job): Promise<void> {
  const handler = getJobHandler(job.type);
  if (!handler) { failJob(job.id, `No handler for job type: ${job.type}`); return; }
  try {
    await handler(job.payload as any);
    completeJob(job.id);
  } catch (error) {
    failJob(job.id, error instanceof Error ? error.message : "Unknown error");
  }
}
```

## 7. Handler Registration

```typescript
// handlers.ts
import { triggerAgentRun } from "@/lib/services/agent";
import { publishContent } from "@/lib/publishers";
import type { JobType } from "./types";
import type { AgentRunPayload, PublishPayload, VideoProcessPayload } from "./types";

const handlerRegistry = new Map<JobType, (payload: any) => Promise<void>>();

export function registerHandler(type: JobType, handler: (payload: any) => Promise<void>): void {
  handlerRegistry.set(type, handler);
}

export function getJobHandler(type: JobType): ((payload: any) => Promise<void>) | undefined {
  return handlerRegistry.get(type);
}

registerHandler("agent-run", async (payload: AgentRunPayload) => {
  await triggerAgentRun({ runId: payload.runId, agentId: payload.agentId });
});

registerHandler("publish", async (payload: PublishPayload) => {
  const { prisma } = await import("@/lib/infrastructure/prisma");
  const content = await prisma.generatedContent.findUnique({ where: { id: payload.contentId } });
  if (!content) throw new Error("Content not found");
  const account = await prisma.connectedAccount.findFirst({
    where: { profileId: payload.profileId, platform: payload.platform, isActive: true },
  });
  if (!account) throw new Error("No connected account found");
  await publishContent(payload.platform, {
    textContent: content.textContent,
    mediaUrls: content.mediaUrls,
    hashtags: content.hashtags,
  }, { accountId: account.accountId, accessToken: account.accessToken, refreshToken: account.refreshToken ?? undefined });
});

registerHandler("video-process", async (payload: VideoProcessPayload) => {
  const { processVideoPipeline } = await import("@/lib/services/video-pipeline");
  await processVideoPipeline(payload.videoAssetId);
});
```

## 8. Integration with Existing Code

Update `trigger-client.ts` to use the new system:
```typescript
import { enqueueJob } from "@/lib/job-queue/queue";
import type { AgentRunPayload } from "@/lib/job-queue/types";

export async function enqueueAgentRun(payload: AgentRunPayload): Promise<string> {
  return enqueueJob("agent-run", payload, { priority: "high", maxAttempts: 2, retryDelayMs: 5000 });
}
```

## 9. Testing Strategy

- **Unit tests**: Queue ordering (priority), status transitions, backoff delays
- **Handler tests**: Mock handlers, verify they are called with correct payload
- **Worker tests**: Concurrent execution cap, error handling, retry logic
- **Backward compat**: Verify existing `enqueueJob` calls still work
