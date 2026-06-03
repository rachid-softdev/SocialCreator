/**
 * Platform Prompt Templates — Resolver
 * Maps Platform enum to the correct template
 */

import type { Platform } from "@prisma/client";
import { facebookTemplate } from "./facebook";
import { instagramTemplate } from "./instagram";
import { linkedinTemplate } from "./linkedin";
import { pinterestTemplate } from "./pinterest";
import { threadsTemplate } from "./threads";
import { tiktokTemplate } from "./tiktok";
import type { PlatformPromptTemplate } from "./types";
import { xTemplate } from "./x";
import { youtubeTemplate } from "./youtube";

const registry: Record<string, PlatformPromptTemplate> = {
  X: xTemplate,
  LINKEDIN: linkedinTemplate,
  INSTAGRAM: instagramTemplate,
  TIKTOK: tiktokTemplate,
  FACEBOOK: facebookTemplate,
  THREADS: threadsTemplate,
  PINTEREST: pinterestTemplate,
  YOUTUBE: youtubeTemplate,
};

/**
 * Resolve the prompt template for a given platform.
 * @throws {Error} If platform is not supported
 */
export function getPromptForPlatform(platform: Platform): PlatformPromptTemplate {
  const template = registry[platform];
  if (!template) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return template;
}

/**
 * Get all registered prompt templates.
 */
export function getAllPromptTemplates(): PlatformPromptTemplate[] {
  return Object.values(registry);
}
