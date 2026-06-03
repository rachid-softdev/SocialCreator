/**
 * Analytics Ingestion Service
 *
 * Récupère les métriques depuis les APIs sociales et les stocke dans la DB
 * À exécuter périodiquement via Trigger.dev ou cron
 *
 * Plateformes supportées:
 * - Instagram/Meta (Graph API)
 * - YouTube (YouTube Data API)
 * - LinkedIn (Marketing API)
 * - Pinterest (Pinterest API)
 *
 * Note: TikTok et X ont des APIs d'insights limitées ou payantes
 */

import type { Platform } from "@prisma/client";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/tokens";

// Configuration des plateformes
const ANALYTICS_PLATFORMS: Record<
  Platform,
  {
    enabled: boolean;
    apiUrl: string;
    insightsEndpoint: string;
  }
> = {
  INSTAGRAM: {
    enabled: true,
    apiUrl: "https://graph.facebook.com/v18.0",
    insightsEndpoint: "/insights",
  },
  FACEBOOK: {
    enabled: true,
    apiUrl: "https://graph.facebook.com/v18.0",
    insightsEndpoint: "/insights",
  },
  YOUTUBE: {
    enabled: true,
    apiUrl: "https://www.googleapis.com/youtube/v3",
    insightsEndpoint: "/channels",
  },
  LINKEDIN: {
    enabled: true,
    apiUrl: "https://api.linkedin.com/v2",
    insightsEndpoint: "/organizationalEntityShareStatistics",
  },
  TIKTOK: {
    enabled: false, // Nécessite TikTok Marketing API (payant)
    apiUrl: "https://business-api.tiktok.com",
    insightsEndpoint: "",
  },
  X: {
    enabled: false, // API gratuite très limitée
    apiUrl: "https://api.twitter.com/2",
    insightsEndpoint: "",
  },
  THREADS: {
    enabled: false, // Pas d'API insights publique
    apiUrl: "https://graph.facebook.com/v18.0",
    insightsEndpoint: "",
  },
  PINTEREST: {
    enabled: true,
    apiUrl: "https://api.pinterest.com/v5",
    insightsEndpoint: "/pins",
  },
};

interface PlatformInsights {
  impressions: number;
  engagements: number;
  clicks: number;
  followers: number;
}

/**
 * Fetch les analytics pour un profile
 * Appelé périodiquement pour sync les données
 */
export async function syncProfileAnalytics(profileId: string): Promise<{
  synced: boolean;
  platforms: number;
  error?: string;
}> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: {
      connectedAccounts: {
        where: { isActive: true },
      },
    },
  });

  if (!profile) {
    return { synced: false, platforms: 0, error: "Profile not found" };
  }

  let platformsSynced = 0;

  for (const account of profile.connectedAccounts) {
    const config = ANALYTICS_PLATFORMS[account.platform as Platform];
    if (!config?.enabled) continue;

    try {
      const insights = await fetchPlatformInsights(
        account.id,
        account.platform as Platform,
        account.accountId,
      );

      if (insights) {
        await storeAnalytics(profileId, account.platform as Platform, insights);
        platformsSynced++;
      }
    } catch (error) {
      logger.error(
        { err: error, platform: account.platform, profileId },
        "Failed to sync analytics for profile",
      );
    }
  }

  return { synced: true, platforms: platformsSynced };
}

/**
 * Fetch les insights pour une plateforme spécifique
 */
async function fetchPlatformInsights(
  accountId: string,
  platform: Platform,
  platformAccountId: string,
): Promise<PlatformInsights | null> {
  const accessToken = await getValidAccessToken(accountId);
  if (!accessToken) return null;

  switch (platform) {
    case "INSTAGRAM":
    case "FACEBOOK":
      return fetchMetaInsights(accessToken, platformAccountId);
    case "YOUTUBE":
      return fetchYouTubeInsights(accessToken, platformAccountId);
    case "LINKEDIN":
      return fetchLinkedInInsights(accessToken, platformAccountId);
    case "PINTEREST":
      return fetchPinterestInsights(accessToken, platformAccountId);
    default:
      return null;
  }
}

/**
 * Fetch insights Meta (Instagram/Facebook)
 */
async function fetchMetaInsights(
  accessToken: string,
  accountId: string,
): Promise<PlatformInsights | null> {
  const baseUrl = ANALYTICS_PLATFORMS.INSTAGRAM.apiUrl;

  try {
    // Fetch account insights (derniere semaine)
    const response = await fetch(
      `${baseUrl}/${accountId}/insights?metrics=impressions,reach,engagement,website_clicks&period=week`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const metrics = data.data || [];

    const getMetricValue = (name: string) => {
      const metric = metrics.find((m: any) => m.name === name);
      return metric?.values?.[0]?.value || 0;
    };

    return {
      impressions: getMetricValue("impressions"),
      engagements: getMetricValue("engagement"),
      clicks: getMetricValue("website_clicks"),
      followers: 0, // Nécessite un appel séparé
    };
  } catch (error) {
    logger.error({ err: error }, "Meta insights error");
    return null;
  }
}

/**
 * Fetch insights YouTube
 */
async function fetchYouTubeInsights(
  accessToken: string,
  channelId: string,
): Promise<PlatformInsights | null> {
  try {
    // Fetch channel statistics
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const stats = data.items?.[0]?.statistics;

    if (!stats) return null;

    return {
      impressions: parseInt(stats.viewCount, 10) || 0,
      engagements: (parseInt(stats.likeCount, 10) || 0) + (parseInt(stats.commentCount, 10) || 0),
      clicks: 0, // YouTube ne fournit pas de clicks via API
      followers: parseInt(stats.subscriberCount, 10) || 0,
    };
  } catch (error) {
    logger.error({ err: error }, "YouTube insights error");
    return null;
  }
}

/**
 * Fetch insights LinkedIn
 */
async function fetchLinkedInInsights(
  accessToken: string,
  organizationId: string,
): Promise<PlatformInsights | null> {
  try {
    const response = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics?entity=urn:li:organization:${organizationId}&timeRange.start=1672531200000&timeRange.end=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      impressions: data.impacts?.impressions || 0,
      engagements: data.impacts?.clicks || 0,
      clicks: data.impacts?.clicks || 0,
      followers: 0,
    };
  } catch (error) {
    logger.error({ err: error }, "LinkedIn insights error");
    return null;
  }
}

/**
 * Fetch insights Pinterest
 */
async function fetchPinterestInsights(
  accessToken: string,
  _accountId: string,
): Promise<PlatformInsights | null> {
  try {
    const response = await fetch(`https://api.pinterest.com/v5/user_account`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      impressions: data.analytics?.monthly_view || 0,
      engagements: data.analytics?.monthly_click || 0,
      clicks: data.analytics?.monthly_click || 0,
      followers: data.analytics?.monthly_follower || 0,
    };
  } catch (error) {
    logger.error({ err: error }, "Pinterest insights error");
    return null;
  }
}

/**
 * Stocke les analytics dans la DB
 */
async function storeAnalytics(
  profileId: string,
  platform: Platform,
  insights: PlatformInsights,
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.analytics.upsert({
    where: {
      profileId_date_platform: {
        profileId,
        date: today,
        platform,
      },
    },
    update: {
      impressions: insights.impressions,
      engagements: insights.engagements,
      clicks: insights.clicks,
      followers: insights.followers,
    },
    create: {
      profileId,
      date: today,
      platform,
      impressions: insights.impressions,
      engagements: insights.engagements,
      clicks: insights.clicks,
      followers: insights.followers,
    },
  });
}

/**
 * Sync tous les profiles d'un utilisateur
 */
export async function syncUserAnalytics(userId: string): Promise<{
  synced: boolean;
  profiles: number;
  totalPlatforms: number;
}> {
  const profiles = await prisma.profile.findMany({
    where: { userId },
    select: { id: true },
  });

  let totalPlatforms = 0;

  for (const profile of profiles) {
    const result = await syncProfileAnalytics(profile.id);
    totalPlatforms += result.platforms;
  }

  return {
    synced: true,
    profiles: profiles.length,
    totalPlatforms,
  };
}
