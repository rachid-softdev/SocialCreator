/**
 * Platform Prompt Templates — Types
 */

import type { Platform } from "@prisma/client";

export interface PlatformPromptTemplate {
  platform: Platform;
  systemPrompt: string;
  maxChars: number;
  buildUserPrompt(params: {
    brief: string;
    keywords?: string[];
    brandVoice?: string;
    contentType?: string;
  }): string;
}
