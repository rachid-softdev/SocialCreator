/**
 * Publisher interfaces and factory
 * Each platform has its own publisher implementation
 */

import { Platform } from "@prisma/client";
import { publishToInstagram } from "./instagram";
import { publishToTikTok } from "./tiktok";
import { publishToYouTube } from "./youtube";
import { publishToFacebook } from "./facebook";
import { publishToX } from "./x";
import { publishToLinkedIn } from "./linkedin";
import { publishToThreads } from "./threads";
import { publishToPinterest } from "./pinterest";

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

// Factory function to get the right publisher for a platform
export function getPublisher(platform: Platform): Publisher {
  switch (platform) {
    case "INSTAGRAM":
      return instagramPublisher;
    case "TIKTOK":
      return tiktokPublisher;
    case "YOUTUBE":
      return youtubePublisher;
    case "FACEBOOK":
      return facebookPublisher;
    case "X":
      return xPublisher;
    case "LINKEDIN":
      return linkedinPublisher;
    case "THREADS":
      return threadsPublisher;
    case "PINTEREST":
      return pinterestPublisher;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
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
  publishToInstagram,
  publishToTikTok,
  publishToYouTube,
  publishToFacebook,
  publishToX,
  publishToLinkedIn,
  publishToThreads,
  publishToPinterest,
};

// Stub implementations for factory pattern
const instagramPublisher: Publisher = {
  async publish(content, account) {
    return publishToInstagram(content, account);
  },
};

const tiktokPublisher: Publisher = {
  async publish(content, account) {
    return publishToTikTok(content, account);
  },
};

const youtubePublisher: Publisher = {
  async publish(content, account) {
    return publishToYouTube(content, account);
  },
};

const facebookPublisher: Publisher = {
  async publish(content, account) {
    return publishToFacebook(content, account);
  },
};

const xPublisher: Publisher = {
  async publish(content, account) {
    return publishToX(content, account);
  },
};

const linkedinPublisher: Publisher = {
  async publish(content, account) {
    return publishToLinkedIn(content, account);
  },
};

const threadsPublisher: Publisher = {
  async publish(content, account) {
    return publishToThreads(content, account);
  },
};

const pinterestPublisher: Publisher = {
  async publish(content, account) {
    return publishToPinterest(content, account);
  },
};
