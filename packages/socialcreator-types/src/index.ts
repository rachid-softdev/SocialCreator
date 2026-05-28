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
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .transform((v) => v.trim()),
  brandVoice: z
    .string()
    .max(5000, "Brand voice must be at most 5000 characters")
    .optional()
    .transform((v) => v?.trim()),
  contentBank: z
    .string()
    .max(10000, "Content bank must be at most 10000 characters")
    .optional()
    .transform((v) => v?.trim()),
  avatarUrl: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
  platforms: z.array(z.enum(PLATFORMS)).optional().default([]),
});

export const updateProfileSchema = createProfileSchema.partial();
export const profileIdSchema = z.object({ profileId: z.string().min(1, "Profile ID is required") });

export const createAgentSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .transform((v) => v.trim()),
  type: z.enum(AGENT_TYPES, {
    errorMap: () => ({ message: "Invalid agent type" }),
  }),
  platforms: z
    .array(z.enum(PLATFORMS, { errorMap: () => ({ message: "Invalid platform" }) }))
    .min(1, "At least one platform is required")
    .max(8, "Maximum 8 platforms allowed"),
  scheduleCron: z
    .string()
    .regex(
      /^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|0?[1-9]|[12]\d|3[01]) (\*|0?[1-9]|1[0-2]) (\*|[0-6])$/,
      "Invalid cron format",
    )
    .optional()
    .or(z.literal("")),
  autoPublish: z.boolean().optional(),
  maxPerDay: z
    .number()
    .int()
    .min(1, "Max per day must be at least 1")
    .max(8, "Max per day must be at most 8")
    .optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateAgentSchema = createAgentSchema.partial().omit({ profileId: true });
export const agentIdSchema = z.object({ agentId: z.string().min(1, "Agent ID is required") });
export const runAgentSchema = z.object({
  brief: z
    .string()
    .min(1, "Brief is required")
    .max(5000, "Brief must be at most 5000 characters")
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
    .max(1000, "Rejection reason must be at most 1000 characters")
    .optional()
    .transform((v) => v?.trim()),
});
export const publishContentSchema = z.object({
  scheduledAt: z
    .string()
    .datetime({ message: "Invalid date format" })
    .optional()
    .refine((v) => !v || new Date(v) > new Date(), {
      message: "Scheduled time must be in the future",
    }),
});
export const contentIdSchema = z.object({ contentId: z.string().min(1, "Content ID is required") });

export const connectAccountSchema = z.object({
  platform: z.enum(PLATFORMS, { errorMap: () => ({ message: "Invalid platform" }) }),
  profileId: z.string().min(1, "Profile ID is required"),
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().optional(),
});
export const refreshAccountSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
});

export const videoUploadSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  fileName: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name must be at most 255 characters")
    .regex(/\.(mp4|mov|avi|webm)$/i, "Invalid video format"),
  fileSize: z
    .number()
    .int()
    .min(1, "File size must be at least 1 byte")
    .max(524288000, "File size must be at most 500MB"),
});
export const videoIdSchema = z.object({ videoId: z.string().min(1, "Video ID is required") });
export const transcribeVideoSchema = z.object({
  videoAssetId: z.string().min(1, "Video asset ID is required"),
});
export const generateClipsSchema = z.object({
  videoAssetId: z.string().min(1, "Video asset ID is required"),
  platforms: z.array(z.enum(PLATFORMS)).min(1, "At least one platform required"),
  clipCount: z.number().int().min(1).max(10).default(5),
});

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters")
    .transform((v) => v.trim()),
});
export const apiKeyIdSchema = z.object({ keyId: z.string().min(1, "API key ID is required") });

export const analyticsIngestSchema = z.object({
  platform: z.enum(PLATFORMS),
  profileId: z.string().min(1, "Profile ID is required"),
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
export const mcpGetAgentSchema = z.object({ agent_id: z.string().min(1, "Agent ID is required") });
export const mcpCreateAgentSchema = z.object({
  profile_id: z.string().min(1, "Profile ID is required"),
  name: z.string().min(1).max(100),
  type: z.enum(AGENT_TYPES),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  schedule: z.string().optional(),
  auto_publish: z.boolean().optional(),
  max_per_day: z.number().optional(),
});
export const mcpRunAgentSchema = z.object({
  agent_id: z.string().min(1, "Agent ID is required"),
  brief: z.string().min(1),
});
export const mcpGetRunStatusSchema = z.object({ run_id: z.string().min(1, "Run ID is required") });

export type { Platform } from "./platforms";
export type ContentStatus = (typeof CONTENT_STATUS)[number];
export type AgentType = (typeof AGENT_TYPES)[number];
