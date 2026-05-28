import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToTikTok } from "../../publishers/tiktok";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

describe("publishToTikTok", () => {
  const mockContent = {
    textContent: "Test TikTok",
    mediaUrls: ["https://storage.example.com/video.mp4"],
    hashtags: ["test"],
  };
  const mockAccount = {
    accountId: "acc123",
    accessToken: "tiktok-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error for non-HTTPS media URL", async () => {
    const result = await publishToTikTok(
      { ...mockContent, mediaUrls: ["http://localhost:8080/video.mp4"] },
      mockAccount,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid video URL");
  });

  it("should return error for private IP media URL", async () => {
    const result = await publishToTikTok(
      { ...mockContent, mediaUrls: ["https://10.0.0.1/video.mp4"] },
      mockAccount,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid video URL");
  });
});
