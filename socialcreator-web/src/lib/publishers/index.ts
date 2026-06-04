/**
 * Publisher interfaces and factory
 * Each platform has its own publisher implementation
 */

import type { Platform } from "@prisma/client";
import { contentGenerated } from "@/lib/utils/metrics";
import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { publishToLinkedIn } from "./linkedin";
import { publishToPinterest } from "./pinterest";
import { publishToThreads } from "./threads";
import { publishToTikTok } from "./tiktok";
import type { PublishInput, PublishOptions, PublishResult } from "./types";
import { publishToX } from "./x";
import { publishToYouTube } from "./youtube";

export interface Publisher {
  publish(input: PublishInput, options: PublishOptions): Promise<PublishResult>;
}

// Publisher map for O(1) lookup
const publisherMap = new Map<Platform, Publisher>();

// Helper to register a publisher
function registerPublisher(platform: Platform, fn: Publisher["publish"]): void {
  publisherMap.set(platform, { publish: fn });
}

// Register all publishers
registerPublisher("INSTAGRAM", (input, options) => publishToInstagram(input, options));
registerPublisher("TIKTOK", (input, options) => publishToTikTok(input, options));
registerPublisher("YOUTUBE", (input, options) => publishToYouTube(input, options));
registerPublisher("FACEBOOK", (input, options) => publishToFacebook(input, options));
registerPublisher("X", (input, options) => publishToX(input, options));
registerPublisher("LINKEDIN", (input, options) => publishToLinkedIn(input, options));
registerPublisher("THREADS", (input, options) => publishToThreads(input, options));
registerPublisher("PINTEREST", (input, options) => publishToPinterest(input, options));

// Factory function to get the right publisher for a platform
export function getPublisher(platform: Platform): Publisher {
  const publisher = publisherMap.get(platform);
  if (!publisher) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return publisher;
}

/**
 * Publish content to a platform (convenience function)
 */
export async function publishContent(
  platform: Platform,
  input: PublishInput,
  options: PublishOptions,
): Promise<PublishResult> {
  const publisher = getPublisher(platform);
  const result = await publisher.publish(input, options);

  // Track business metric
  if (result.success) {
    contentGenerated.inc({ platform: platform.toLowerCase(), type: "publish" });
  }

  return result;
}

// Export individual publishers for direct use
export {
  publishToFacebook,
  publishToInstagram,
  publishToLinkedIn,
  publishToPinterest,
  publishToThreads,
  publishToTikTok,
  publishToX,
  publishToYouTube,
};

// ============================================
// Enhanced Publisher Strategy — new exports
// Backward compatible: all existing exports above remain unchanged
// ============================================

export type { PipelineContext } from "./pipeline";
export { runPublishPipeline } from "./pipeline";
export {
  getPublisherRegistration,
  hasPublisher,
  registerPublisherWithConfig,
  registerSimplePublisher,
} from "./registry";
export type {
  ContentValidator,
  OnErrorHook,
  PostPublishHook,
  PrePublishHook,
  PublishAccount,
  PublishContent as PublishContentInput,
  PublishContext,
  PublisherHooks,
  PublisherRegistration,
  PublishInput,
  PublishOptions,
  PublishResult,
  RetryConfig,
  ValidationResult,
} from "./types";
export {
  characterLimitValidator,
  instagramValidator,
  linkedinValidator,
  mediaRequiredValidator,
  tiktokValidator,
  xValidator,
} from "./validators";
