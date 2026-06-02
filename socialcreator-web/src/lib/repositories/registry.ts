/**
 * Repository Registry
 * Singleton DI pattern mirroring entitlements/repository.ts
 */

import type { IAgentRepository, IAgentRunRepository } from "./agent.repository";
import type { IApiKeyRepository } from "./api-key.repository";
import type { IConnectedAccountRepository } from "./connected-account.repository";
import type { IContentRepository } from "./content.repository";
import type { IMediaAssetRepository } from "./media-asset.repository";
import type { IProfileRepository } from "./profile.repository";
import type { IPublishLogRepository } from "./publish-log.repository";
import type { ITeamRepository } from "./team.repository";
import type { ITeamMemberRepository } from "./team-member.repository";
import type { IUserRepository } from "./user.repository";

// ============================================
// Registry Interface
// ============================================

export interface Repositories {
  content: IContentRepository;
  agent: IAgentRepository;
  agentRun: IAgentRunRepository;
  profile: IProfileRepository;
  user: IUserRepository;
  apiKey: IApiKeyRepository;
  mediaAsset: IMediaAssetRepository;
  team: ITeamRepository;
  teamMember: ITeamMemberRepository;
  connectedAccount: IConnectedAccountRepository;
  publishLog: IPublishLogRepository;
}

// ============================================
// Singleton Instance
// ============================================

let registryInstance: Repositories | null = null;

/**
 * Initialize repositories (singleton)
 * If overrides are provided, merges them for testing
 */
export function initRepositories(overrides?: Partial<Repositories>): Repositories {
  if (registryInstance && !overrides) return registryInstance;

  // Lazy require to avoid circular deps
  const { PrismaContentRepository } = require("./content.repository");
  const { PrismaAgentRepository, PrismaAgentRunRepository } = require("./agent.repository");
  const { PrismaProfileRepository } = require("./profile.repository");
  const { PrismaUserRepository } = require("./user.repository");
  const { PrismaApiKeyRepository } = require("./api-key.repository");
  const { PrismaMediaAssetRepository } = require("./media-asset.repository");
  const { PrismaTeamRepository } = require("./team.repository");
  const { PrismaTeamMemberRepository } = require("./team-member.repository");
  const { PrismaConnectedAccountRepository } = require("./connected-account.repository");
  const { PrismaPublishLogRepository } = require("./publish-log.repository");

  registryInstance = {
    content: new PrismaContentRepository(),
    agent: new PrismaAgentRepository(),
    agentRun: new PrismaAgentRunRepository(),
    profile: new PrismaProfileRepository(),
    user: new PrismaUserRepository(),
    apiKey: new PrismaApiKeyRepository(),
    mediaAsset: new PrismaMediaAssetRepository(),
    team: new PrismaTeamRepository(),
    teamMember: new PrismaTeamMemberRepository(),
    connectedAccount: new PrismaConnectedAccountRepository(),
    publishLog: new PrismaPublishLogRepository(),
    ...overrides,
  };

  return registryInstance;
}

/**
 * Get repository instance
 */
export function getRepositories(): Repositories {
  if (!registryInstance) return initRepositories();
  return registryInstance;
}

/**
 * Reset registry (for testing)
 */
export function resetRepositories(): void {
  registryInstance = null;
}
