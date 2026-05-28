import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishToYouTube } from "../../publishers/youtube";

// Mock fetchWithTimeout
vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

describe("publishToYouTube", () => {
  const mockContent = {
    textContent: "Test video",
    mediaUrls: ["https://storage.example.com/video.mp4"],
    hashtags: ["test", "video"],
  };
  const mockAccount = {
    accountId: "channel123",
    accessToken: "ya29.valid-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return error if no media URLs provided", async () => {
    const result = await publishToYouTube({ ...mockContent, mediaUrls: [] }, mockAccount);
    expect(result.success).toBe(false);
    expect(result.error).toContain("requires video content");
  });

  describe("SSRF validation", () => {
    /**
     * publishToYouTube first calls fetchWithTimeout to initiate a YouTube upload,
     * then validates the media URL. We need the init call to succeed so the
     * SSRF validation step is reached.
     */
    function mockSuccessfulInitiation(): void {
      const mockHeaders = new Map<string, string>([
        ["Location", "https://youtube.com/upload/session/abc123"],
      ]);
      vi.mocked(fetchWithTimeout).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => mockHeaders.get(name) ?? null,
        },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response);
    }

    it("should return error for SSRF attempt with non-HTTPS URL", async () => {
      mockSuccessfulInitiation();
      const result = await publishToYouTube(
        { ...mockContent, mediaUrls: ["http://169.254.169.254/latest/meta-data/"] },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });

    it("should return error for private IP URL", async () => {
      mockSuccessfulInitiation();
      const result = await publishToYouTube(
        { ...mockContent, mediaUrls: ["https://192.168.1.1/video.mp4"] },
        mockAccount,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid video URL");
    });
  });
});
