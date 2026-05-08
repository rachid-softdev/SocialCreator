/**
 * YouTube publisher via YouTube Data API v3
 * Currently supports Shorts upload and video metadata
 */

import { PublishResult } from "./index";

export async function publishToYouTube(
  content: {
    textContent: string;
    mediaUrls: string[];
    hashtags: string[];
  },
  account: {
    accountId: string;
    accessToken: string;
  }
): Promise<PublishResult> {
  try {
    // YouTube requires a video for publishing
    // This endpoint is for video metadata creation after upload to Google
    if (content.mediaUrls.length > 0) {
      const snippet = {
        title: content.textContent.slice(0, 100),
        description:
          content.textContent +
          "\n\n" +
          content.hashtags.map((t) => "#" + t).join(" "),
        tags: content.hashtags.slice(0, 15),
        categoryId: "22", // People & Blogs
      };

      const response = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet,
            status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
          }),
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      return {
        success: true,
        postId: data.id,
        postUrl: `https://youtu.be/${data.id}`,
      };
    } else {
      // YouTube Community posts would require separate API
      return {
        success: false,
        error: "YouTube requires video content for publishing",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
