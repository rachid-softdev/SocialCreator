import { z } from "zod";
import { PLATFORMS } from "./platforms";

export { PLATFORMS, platformSchema, platformsArraySchema } from "./platforms";
export const CONTENT_STATUS = [
  "DRAFT",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "FAILED",
  "SCHEDULED",
] as const;
export const AGENT_TYPES = ["TEXT_POST", "VIDEO_CLIP", "CROSS_POST"] as const;

export const createProfileSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(100)
    .transform((v) => v.trim()),
  brandVoice: z
    .string()
    .max(5000)
    .optional()
    .transform((v) => v?.trim()),
  contentBank: z
    .string()
    .max(10000)
    .optional()
    .transform((v) => v?.trim()),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  platforms: z.array(z.enum(PLATFORMS)).optional().default([]),
});

export const updateProfileSchema = createProfileSchema.partial();
export const profileIdSchema = z.object({ profileId: z.string().min(1) });

export const createAgentSchema = z.object({
  profileId: z.string().min(1),
  name: z
    .string()
    .min(2)
    .max(100)
    .transform((v) => v.trim()),
  type: z.enum(AGENT_TYPES),
  platforms: z.array(z.enum(PLATFORMS)).min(1).max(8),
  scheduleCron: z
    .string()
    .regex(/^(\*|[0-5]?\d) (\*|[0-5]?\d) (\*|[12]\d|3[01]|[1-9]) (\*|1[0-2]|[1-9]) (\*|[0-6])$/)
    .optional()
    .or(z.literal("")),
  autoPublish: z.boolean().optional(),
  maxPerDay: z.number().int().min(1).max(10).optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateAgentSchema = createAgentSchema.partial().omit({ profileId: true });
export const agentIdSchema = z.object({ agentId: z.string().min(1) });
export const runAgentSchema = z.object({
  brief: z
    .string()
    .min(1)
    .max(5000)
    .transform((v) => v.trim()),
});

export const contentFilterSchema = z.object({
  profileId: z.string().optional(),
  status: z.enum(CONTENT_STATUS).optional(),
  platform: z.enum(PLATFORMS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveContentSchema = z.object({ status: z.literal("APPROVED") });
export const rejectContentSchema = z.object({
  status: z.literal("REJECTED"),
  rejectionReason: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => v?.trim()),
});
export const publishContentSchema = z.object({
  scheduledAt: z
    .string()
    .datetime()
    .optional()
    .refine((v) => !v || new Date(v) > new Date(), { message: "Must be future date" }),
});
export const contentIdSchema = z.object({ contentId: z.string().min(1) });

export const connectAccountSchema = z.object({
  platform: z.enum(PLATFORMS),
  profileId: z.string().min(1),
  code: z.string().min(1),
  state: z.string().optional(),
});
export const refreshAccountSchema = z.object({ accountId: z.string().min(1) });

export const videoUploadSchema = z.object({
  profileId: z.string().min(1),
  fileName: z
    .string()
    .min(1)
    .max(255)
    .regex(/\.(mp4|mov|avi|webm)$/i),
  fileSize: z.number().int().min(1).max(524288000),
});
export const videoIdSchema = z.object({ videoId: z.string().min(1) });
export const transcribeVideoSchema = z.object({ videoAssetId: z.string().min(1) });
export const generateClipsSchema = z.object({
  videoAssetId: z.string().min(1),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  clipCount: z.number().int().min(1).max(10).default(5),
});

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((v) => v.trim()),
});
export const apiKeyIdSchema = z.object({ keyId: z.string().min(1) });

export const analyticsIngestSchema = z.object({
  platform: z.enum(PLATFORMS),
  profileId: z.string().min(1),
  date: z.string().transform((v) => new Date(v)),
  impressions: z.number().int().min(0).default(0),
  engagements: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  followers: z.number().int().min(0).default(0),
});
export const analyticsFilterSchema = z.object({
  profileId: z.string().optional(),
  platform: z.enum(PLATFORMS).optional(),
  startDate: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  endDate: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
});

export const mcpListAgentsSchema = z.object({ profile_id: z.string().optional() });
export const mcpGetAgentSchema = z.object({ agent_id: z.string().min(1) });
export const mcpCreateAgentSchema = z.object({
  profile_id: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(AGENT_TYPES),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  schedule: z.string().optional(),
  auto_publish: z.boolean().optional(),
  max_per_day: z.number().optional(),
});
export const mcpRunAgentSchema = z.object({
  agent_id: z.string().min(1),
  brief: z.string().min(1),
});
export const mcpGetRunStatusSchema = z.object({ run_id: z.string().min(1) });

export type { Platform } from "./platforms";
export type ContentStatus = (typeof CONTENT_STATUS)[number];
export type AgentType = (typeof AGENT_TYPES)[number];
