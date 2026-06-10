/**
 * DI Service Tokens
 * Central registry of all known service token strings
 */

export const TOKENS = {
  // Infrastructure
  PRISMA_CLIENT: "PrismaClient",
  LOGGER: "Logger",
  CACHE_SERVICE: "CacheService",

  // Repositories
  CONTENT_REPOSITORY: "IContentRepository",
  AGENT_REPOSITORY: "IAgentRepository",
  AGENT_RUN_REPOSITORY: "IAgentRunRepository",
  PROFILE_REPOSITORY: "IProfileRepository",
  USER_REPOSITORY: "IUserRepository",
  API_KEY_REPOSITORY: "IApiKeyRepository",
  MEDIA_ASSET_REPOSITORY: "IMediaAssetRepository",
  TEAM_REPOSITORY: "ITeamRepository",
  TEAM_MEMBER_REPOSITORY: "ITeamMemberRepository",
  CONNECTED_ACCOUNT_REPOSITORY: "IConnectedAccountRepository",
  PUBLISH_LOG_REPOSITORY: "IPublishLogRepository",
  ANALYTICS_REPOSITORY: "IAnalyticsRepository",

  // Services
  ENTITLEMENT_REPOSITORY: "IEntitlementRepository",
  FEATURE_GATE_SERVICE: "FeatureGateService",
  PUBLISH_SERVICE: "PublishService",
  AGENT_SERVICE: "AgentService",
} as const;

export type Token = (typeof TOKENS)[keyof typeof TOKENS];
