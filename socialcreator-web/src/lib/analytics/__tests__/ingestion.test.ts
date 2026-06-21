/**
 * Tests for Analytics Ingestion Service
 *
 * Covers:
 * - syncProfileAnalytics() — full sync flow, platform filtering, error handling
 * - syncUserAnalytics() — multi-profile sync
 * - fetchPlatformInsights integration paths (Meta, YouTube, LinkedIn, Pinterest)
 * - Token retrieval and expiration handling
 * - DB storage (upsert) behavior
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// ── Mock all external dependencies at the top level ──

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    analytics: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/tokens", () => ({
  getValidAccessToken: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/tokens";
import logger from "@/lib/logger";
import { syncProfileAnalytics, syncUserAnalytics } from "@/lib/analytics/ingestion";

// ── Helpers ──

const makeConnectedAccount = (overrides = {}) => ({
  id: "acct-1",
  platform: "INSTAGRAM",
  accountId: "ig-user-123",
  isActive: true,
  ...overrides,
});

const makeProfile = (overrides = {}) => ({
  id: "profile-1",
  name: "Test Profile",
  ...overrides,
});

describe("syncProfileAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("profile lookup", () => {
    it("returns error when profile is not found", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(null);

      const result = await syncProfileAnalytics("nonexistent");

      expect(result).toEqual({ synced: false, platforms: 0, error: "Profile not found" });
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: "nonexistent" },
        include: {
          connectedAccounts: {
            where: { isActive: true },
          },
        },
      });
    });

    it("returns 0 platforms when profile has no connected accounts", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(makeProfile({ connectedAccounts: [] }));

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 0 });
    });

    it("returns 0 platforms when all connected platforms are disabled", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [
            makeConnectedAccount({ platform: "TIKTOK" }),
            makeConnectedAccount({ platform: "X" }),
          ],
        }),
      );

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 0 });
    });
  });

  describe("token retrieval", () => {
    it("returns 0 platforms when no valid access token is available", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [makeConnectedAccount()],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue(null);

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 0 });
      expect(getValidAccessToken).toHaveBeenCalledWith("acct-1");
    });
  });

  describe("successful sync", () => {
    beforeEach(() => {
      (prisma.analytics.upsert as Mock).mockResolvedValue({ id: "analytics-1" });
    });

    it("syncs Instagram analytics successfully", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [makeConnectedAccount()],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue("valid-token");

      // Mock the Meta API response
      const mockInsightsResponse = {
        data: [
          { name: "impressions", values: [{ value: 1500 }] },
          { name: "engagement", values: [{ value: 300 }] },
          { name: "website_clicks", values: [{ value: 75 }] },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockInsightsResponse),
      });

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 1 });
      expect(getValidAccessToken).toHaveBeenCalledWith("acct-1");
      expect(prisma.analytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            profileId_date_platform: {
              profileId: "profile-1",
              platform: "INSTAGRAM",
              date: expect.any(Date),
            },
          },
          update: {
            impressions: 1500,
            engagements: 300,
            clicks: 75,
            followers: 0,
          },
          create: expect.objectContaining({
            profileId: "profile-1",
            platform: "INSTAGRAM",
            impressions: 1500,
            engagements: 300,
            clicks: 75,
            followers: 0,
          }),
        }),
      );
    });

    it("syncs multiple connected accounts across different platforms", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [
            makeConnectedAccount({ id: "acct-1", platform: "INSTAGRAM", accountId: "ig-1" }),
            makeConnectedAccount({ id: "acct-2", platform: "YOUTUBE", accountId: "yt-1" }),
          ],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue("valid-token");

      // First call: Instagram/Meta
      // Second call: YouTube
      global.fetch = vi
        .fn()
        // Instagram response
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { name: "impressions", values: [{ value: 100 }] },
                { name: "engagement", values: [{ value: 50 }] },
                { name: "website_clicks", values: [{ value: 10 }] },
              ],
            }),
        })
        // YouTube response
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ statistics: { viewCount: "500", likeCount: "30", commentCount: "5", subscriberCount: "200" } }],
            }),
        });

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 2 });
      expect(prisma.analytics.upsert).toHaveBeenCalledTimes(2);
    });

    it("continues syncing remaining accounts when one platform fails", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [
            makeConnectedAccount({ id: "acct-1", platform: "INSTAGRAM", accountId: "ig-1" }),
            makeConnectedAccount({ id: "acct-2", platform: "PINTEREST", accountId: "pin-1" }),
          ],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue("valid-token");

      global.fetch = vi
        .fn()
        // Instagram API fails
        .mockRejectedValueOnce(new Error("Network error"))
        // Pinterest succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              analytics: { monthly_view: 800, monthly_click: 120, monthly_follower: 60 },
            }),
        });

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 1 });
      expect(prisma.analytics.upsert).toHaveBeenCalledTimes(1);
      // Error is caught inside fetchMetaInsights and logged as "Meta insights error"
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Meta insights error",
      );
    });
  });

  describe("API error handling", () => {
    it("handles non-OK API response (returns null from fetchPlatformInsights)", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [makeConnectedAccount()],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue("valid-token");

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 0 });
      expect(prisma.analytics.upsert).not.toHaveBeenCalled();
    });

    it("handles token refresh failures", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [makeConnectedAccount()],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue(null);

      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 0 });
      expect(prisma.analytics.upsert).not.toHaveBeenCalled();
    });
  });

  describe("DB storage", () => {
    it("handles DB write failure gracefully", async () => {
      (prisma.profile.findUnique as Mock).mockResolvedValue(
        makeProfile({
          connectedAccounts: [makeConnectedAccount()],
        }),
      );
      (getValidAccessToken as Mock).mockResolvedValue("valid-token");
      (prisma.analytics.upsert as Mock).mockRejectedValue(new Error("DB connection lost"));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { name: "impressions", values: [{ value: 100 }] },
              { name: "engagement", values: [{ value: 50 }] },
              { name: "website_clicks", values: [{ value: 10 }] },
            ],
          }),
      });

      // The error should be caught and logged, and the sync should continue
      const result = await syncProfileAnalytics("profile-1");

      expect(result).toEqual({ synced: true, platforms: 0 });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
          platform: "INSTAGRAM",
          profileId: "profile-1",
        }),
        "Failed to sync analytics for profile",
      );
    });
  });
});

describe("syncUserAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns synced=true with 0 profiles when user has no profiles", async () => {
    (prisma.profile.findMany as Mock).mockResolvedValue([]);

    const result = await syncUserAnalytics("user-1");

    expect(result).toEqual({ synced: true, profiles: 0, totalPlatforms: 0 });
    expect(prisma.profile.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
  });

  it("syncs all profiles for a user and returns total platforms", async () => {
    (prisma.profile.findMany as Mock).mockResolvedValue([
      { id: "profile-1" },
      { id: "profile-2" },
    ]);

    // syncProfileAnalytics("profile-1") → 2 connected accounts (INSTAGRAM + FACEBOOK)
    // syncProfileAnalytics("profile-2") → 1 connected account (YOUTUBE)
    (prisma.profile.findUnique as Mock)
      .mockResolvedValueOnce(
        makeProfile({
          connectedAccounts: [
            makeConnectedAccount({ id: "acct-1", platform: "INSTAGRAM", accountId: "ig-1" }),
            makeConnectedAccount({ id: "acct-2", platform: "FACEBOOK", accountId: "fb-1" }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        makeProfile({
          connectedAccounts: [
            makeConnectedAccount({ id: "acct-3", platform: "YOUTUBE", accountId: "yt-1" }),
          ],
        }),
      );
    (getValidAccessToken as Mock).mockResolvedValue("valid-token");
    (prisma.analytics.upsert as Mock).mockResolvedValue({ id: "analytics-1" });

    // 3 fetch calls: Instagram, Facebook (both Meta), and YouTube
    const metaResponse = {
      data: [
        { name: "impressions", values: [{ value: 100 }] },
        { name: "engagement", values: [{ value: 50 }] },
        { name: "website_clicks", values: [{ value: 10 }] },
      ],
    };
    const youtubeResponse = {
      items: [
        {
          statistics: {
            viewCount: "500",
            likeCount: "30",
            commentCount: "5",
            subscriberCount: "200",
          },
        },
      ],
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(metaResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(metaResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(youtubeResponse) });

    const result = await syncUserAnalytics("user-1");

    expect(result).toEqual({ synced: true, profiles: 2, totalPlatforms: 3 });
    expect(prisma.profile.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
  });
});
