/**
 * Publisher interfaces and factory
 * Each platform has its own publisher implementation
 */

import type { Platform } from "@prisma/client";
import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { publishToLinkedIn } from "./linkedin";
import { publishToPinterest } from "./pinterest";
import { publishToThreads } from "./threads";
import { publishToTikTok } from "./tiktok";
import { publishToX } from "./x";
import { publishToYouTube } from "./youtube";

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface Publisher {
  publish(
    content: {
      textContent: string;
      mediaUrls: string[];
      hashtags: string[];
    },
    account: {
      accountId: string;
      accessToken: string;
      refreshToken?: string;
    },
  ): Promise<PublishResult>;
}

// Publisher map for O(1) lookup
const publisherMap = new Map<Platform, Publisher>();

// Helper to register a publisher
function registerPublisher(platform: Platform, fn: Publisher["publish"]): void {
  publisherMap.set(platform, { publish: fn });
}

// Register all publishers
registerPublisher("INSTAGRAM", (content, account) => publishToInstagram(content, account));
registerPublisher("TIKTOK", (content, account) => publishToTikTok(content, account));
registerPublisher("YOUTUBE", (content, account) => publishToYouTube(content, account));
registerPublisher("FACEBOOK", (content, account) => publishToFacebook(content, account));
registerPublisher("X", (content, account) => publishToX(content, account));
registerPublisher("LINKEDIN", (content, account) => publishToLinkedIn(content, account));
registerPublisher("THREADS", (content, account) => publishToThreads(content, account));
registerPublisher("PINTEREST", (content, account) => publishToPinterest(content, account));

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
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
    refreshToken?: string;
  },
): Promise<PublishResult> {
  const publisher = getPublisher(platform);
  return publisher.publish(content, account);
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
