/**
 * YouTube publisher via YouTube Data API v3 + Resumable Upload
 * Supports uploading videos and creating Shorts
 *
 * Required scopes: youtube.upload, youtube.force-ssl
 */

import type { PublishResult } from "./index";

const YOUTUBE_UPLOAD_URL = "https://upload.youtube.com/upload/gateway";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeUploadOptions {
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: "public" | "private" | "unlisted";
  isShort?: boolean;
}

/**
 * Publish content to YouTube
 * Note: Requires video content - YouTube doesn't support text-only posts
 */
export async function publishToYouTube(
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
  },
  options: Partial<YouTubeUploadOptions> = {},
): Promise<PublishResult> {
  // YouTube requires video content
  if (content.mediaUrls.length === 0) {
    return {
      success: false,
      error: "YouTube requires video content. No media URLs provided.",
    };
  }

  const maxRetries = 3;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const videoTitle = (content.textContent.slice(0, 100) || "Untitled Video").trim();
      const description = `${content.textContent}\n\n${content.hashtags.map((t) => `#${t}`).join(" ")}`;
      const tags = content.hashtags.slice(0, 15);

      // Step 1: Initiate resumable upload
      const initResponse = await fetch(
        `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Length": "0", // Will be updated
            "X-Upload-Content-Type": "video/mp4",
          },
          body: JSON.stringify({
            snippet: {
              title: videoTitle,
              description: description,
              tags: tags,
              categoryId: options.categoryId || "22", // People & Blogs
            },
            status: {
              privacyStatus: options.privacyStatus || "public",
              selfDeclaredMadeForKids: false,
            },
          }),
        },
      );

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        throw new Error(
          errorData.error?.message || `Upload initiation failed: ${initResponse.status}`,
        );
      }

      // Get the upload URL from Location header
      const uploadUrl = initResponse.headers.get("Location");
      if (!uploadUrl) {
        throw new Error("No upload URL returned from YouTube");
      }

      // Step 2: Upload the video file
      // Note: In production, you'd implement chunked upload for large files
      // For this implementation, we'll do a simple upload
      const videoResponse = await fetch(content.mediaUrls[0]);
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }

      const videoBlob = await videoResponse.blob();

      // Upload to YouTube
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": videoBlob.size.toString(),
          "Content-Type": "video/mp4",
        },
        body: videoBlob,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(
          errorData.error?.message || `Video upload failed: ${uploadResponse.status}`,
        );
      }

      const videoData = await uploadResponse.json();

      return {
        success: true,
        postId: videoData.id,
        postUrl: `https://youtu.be/${videoData.id}`,
      };
    } catch (error) {
      console.error(`YouTube upload attempt ${attempt} failed:`, error);

      // Retry on network errors or 5xx status codes
      if (attempt < maxRetries && error instanceof Error) {
        const shouldRetry =
          error.message.includes("500") ||
          error.message.includes("503") ||
          error.message.includes("network") ||
          error.message.includes("ETIMEDOUT");

        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, baseDelay * attempt));
          continue;
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown YouTube upload error",
      };
    }
  }

  return {
    success: false,
    error: "YouTube upload failed after multiple attempts",
  };
}

/**
 * Create a YouTube Community Post (text-only)
 * Note: Requires channel account and additional API setup
 */
export async function postToYouTubeCommunity(
  _content: {
    textContent: string;
    mediaUrls?: string[];
  },
  _account: {
    accountId: string;
    accessToken: string;
  },
): Promise<PublishResult> {
  // YouTube Community posts require a different API
  // This is a stub - would need to use YouTube Partner API
  return {
    success: false,
    error: "Community posts require additional YouTube API setup. Use video upload instead.",
  };
}

/**
 * Get video details from YouTube
 */
export async function getYouTubeVideoDetails(
  videoId: string,
  accessToken: string,
): Promise<{
  id: string;
  title: string;
  status: string;
  privacyStatus: string;
} | null> {
  try {
    const response = await fetch(`${YOUTUBE_API_BASE}/videos?part=snippet,status&id=${videoId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const video = data.items[0];
    return {
      id: video.id,
      title: video.snippet.title,
      status: video.status.uploadStatus,
      privacyStatus: video.status.privacyStatus,
    };
  } catch {
    return null;
  }
}
