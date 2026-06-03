/**
 * Content Generation — Validation Schema
 */

import { z } from "zod";

export const generateContentSchema = z.object({
  profileId: z.string().min(1),
  brief: z.string().min(10).max(2000),
  platform: z.enum([
    "TIKTOK",
    "INSTAGRAM",
    "YOUTUBE",
    "FACEBOOK",
    "X",
    "LINKEDIN",
    "THREADS",
    "PINTEREST",
  ]),
  count: z.number().int().min(1).max(5).optional().default(1),
  keywords: z.array(z.string()).max(10).optional(),
  brandVoice: z.string().max(500).optional(),
});

export const generateContentBatchSchema = z.object({
  profileId: z.string().min(1),
  brief: z.string().min(10).max(2000),
  platforms: z
    .array(
      z.enum([
        "TIKTOK",
        "INSTAGRAM",
        "YOUTUBE",
        "FACEBOOK",
        "X",
        "LINKEDIN",
        "THREADS",
        "PINTEREST",
      ]),
    )
    .min(1)
    .max(8),
  count: z.number().int().min(1).max(5).optional().default(1),
  keywords: z.array(z.string()).max(10).optional(),
  brandVoice: z.string().max(500).optional(),
});
