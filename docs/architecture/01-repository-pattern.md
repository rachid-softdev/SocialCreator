# Repository Pattern — SocialCreator

## 1. Overview

The repository pattern abstracts data access behind interfaces, enabling:
- **Testability**: Mock repositories in unit tests without a database
- **Swap-ability**: Swap Prisma for another ORM or an in-memory store
- **Consistency**: Follow the same pattern as the existing `IEntitlementRepository`
- **Centralized queries**: Keep Prisma queries out of route handlers and services

Currently, routes and services call `prisma.*` directly (e.g., `prisma.agent.findMany()` in
`/api/agents/route.ts` and `prisma.generatedContent.findMany()` in `/api/content/route.ts`).
Repositories encapsulate this logic so that future changes (e.g., adding caching, switching
databases) affect only the repository layer.

## 2. File Structure

All files go into the existing (empty) directory `socialcreator-web/src/lib/repositories/`.

```
src/lib/repositories/
├── index.ts                 # Barrel export
├── registry.ts              # Simple DI registry
├── types.ts                 # Shared repository types
├── content.repository.ts    # GeneratedContent repository
├── agent.repository.ts      # Agent + AgentRun repositories
├── profile.repository.ts    # Profile repository
├── user.repository.ts       # User repository
├── api-key.repository.ts    # ApiKey repository
├── media-asset.repository.ts # MediaAsset + VideoAsset repositories
├── team.repository.ts       # Team repository
├── team-member.repository.ts # TeamMember repository
├── connected-account.repository.ts # ConnectedAccount repository
├── publish-log.repository.ts # PublishLog repository
```

## 3. Interfaces & Types

### 3.1 Domain-Specific Interfaces

Each repository mirrors the `IEntitlementRepository` naming convention
(see `entitlements/types.ts`):

```typescript
// content.repository.ts
export interface IContentRepository {
  findById(id: string): Promise<GeneratedContent | null>;
  findByProfileId(profileId: string, options?: ContentFilterOptions): Promise<ContentPage>;
  create(data: CreateContentInput): Promise<GeneratedContent>;
  updateStatus(id: string, status: ContentStatus): Promise<GeneratedContent>;
  delete(id: string): Promise<void>;
  findPendingScheduled(before: Date): Promise<GeneratedContent[]>;
  countPublishedToday(profileId: string, platform: Platform): Promise<number>;
  findByRunId(runId: string): Promise<GeneratedContent[]>;
}

// agent.repository.ts
export interface IAgentRepository {
  findById(id: string): Promise<AgentWithProfile | null>;
  findByProfileId(profileId: string): Promise<Agent[]>;
  create(data: CreateAgentInput): Promise<Agent>;
  update(id: string, data: UpdateAgentInput): Promise<Agent>;
  delete(id: string): Promise<void>;
  findActiveByPlatform(platform: Platform): Promise<Agent[]>;
}

export interface IAgentRunRepository {
  findById(id: string): Promise<AgentRunWithContent | null>;
  findByAgentId(agentId: string): Promise<AgentRun[]>;
  create(data: CreateRunInput): Promise<AgentRun>;
  updateStatus(id: string, status: RunStatus, error?: string): Promise<AgentRun>;
}

// profile.repository.ts
export interface IProfileRepository {
  findById(id: string): Promise<ProfileWithRelations | null>;
  findByUserId(userId: string): Promise<Profile[]>;
  create(data: CreateProfileInput): Promise<Profile>;
  update(id: string, data: UpdateProfileInput): Promise<Profile>;
  delete(id: string): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}

// user.repository.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  updateCguAcceptance(id: string): Promise<User>;
}

// api-key.repository.ts
export interface IApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByUserId(userId: string): Promise<ApiKey[]>;
  findByKeyHash(keyHash: string): Promise<ApiKey | null>;
  create(data: CreateApiKeyInput): Promise<ApiKey>;
  revoke(id: string): Promise<ApiKey>;
  updateLastUsed(id: string): Promise<void>;
}

// media-asset.repository.ts
export interface IMediaAssetRepository {
  findById(id: string): Promise<MediaAsset | null>;
  findByProfileId(profileId: string, type?: MediaType): Promise<MediaAsset[]>;
  create(data: CreateMediaAssetInput): Promise<MediaAsset>;
  delete(id: string): Promise<void>;
}

// team.repository.ts
export interface ITeamRepository {
  findById(id: string): Promise<TeamWithMembers | null>;
  findByOwnerId(ownerId: string): Promise<Team[]>;
  create(data: CreateTeamInput): Promise<Team>;
  update(id: string, data: Partial<Team>): Promise<Team>;
  delete(id: string): Promise<void>;
}

// team-member.repository.ts
export interface ITeamMemberRepository {
  findById(id: string): Promise<TeamMember | null>;
  findByTeamId(teamId: string): Promise<TeamMember[]>;
  findByUserId(userId: string): Promise<TeamMember[]>;
  addMember(data: AddTeamMemberInput): Promise<TeamMember>;
  updateRole(id: string, role: TeamRole): Promise<TeamMember>;
  removeMember(id: string): Promise<void>;
}

// connected-account.repository.ts
export interface IConnectedAccountRepository {
  findById(id: string): Promise<ConnectedAccount | null>;
  findByProfileId(profileId: string): Promise<ConnectedAccount[]>;
  findByProfileAndPlatform(profileId: string, platform: Platform): Promise<ConnectedAccount | null>;
  create(data: CreateConnectedAccountInput): Promise<ConnectedAccount>;
  update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount>;
  delete(id: string): Promise<void>;
}

// publish-log.repository.ts
export interface IPublishLogRepository {
  findById(id: string): Promise<PublishLog | null>;
  findByUserId(userId: string, options?: PaginationOptions): Promise<PublishLog[]>;
  findByProfileId(profileId: string, options?: PaginationOptions): Promise<PublishLog[]>;
  create(data: CreatePublishLogInput): Promise<PublishLog>;
  countPublishedToday(profileId: string, platform: Platform): Promise<number>;
  findByContentHash(hash: string): Promise<PublishLog | null>;
}
```

## 4. Implementation Plan

### 4.1 Prisma Repository Implementation Pattern

Each implementation follows the same structure as `PrismaEntitlementRepository` in
`entitlements/repository.ts`:

```typescript
// content.repository.ts
import { prisma } from "@/lib/infrastructure/prisma";
import type { ContentStatus, GeneratedContent, Platform, Prisma } from "@prisma/client";
import type { IContentRepository, ContentFilterOptions, ContentPage } from "./types";

export class PrismaContentRepository implements IContentRepository {
  async findById(id: string): Promise<GeneratedContent | null> {
    return prisma.generatedContent.findUnique({
      where: { id },
      include: {
        profile: { select: { id: true, name: true } },
        run: { select: { id: true, agent: { select: { id: true, name: true } } } },
      },
    });
  }

  async findByProfileId(profileId: string, options?: ContentFilterOptions): Promise<ContentPage> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const where: Prisma.GeneratedContentWhereInput = { profileId };
    if (options?.status) where.status = options.status;
    if (options?.platform) where.platform = options.platform;

    const [contents, total] = await Promise.all([
      prisma.generatedContent.findMany({
        where, orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
        include: { profile: { select: { id: true, name: true } } },
      }),
      prisma.generatedContent.count({ where }),
    ]);
    return { contents, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async create(data: Prisma.GeneratedContentCreateInput): Promise<GeneratedContent> {
    return prisma.generatedContent.create({ data });
  }

  async updateStatus(id: string, status: ContentStatus): Promise<GeneratedContent> {
    return prisma.generatedContent.update({ where: { id }, data: { status } });
  }

  async delete(id: string): Promise<void> {
    await prisma.generatedContent.delete({ where: { id } });
  }

  async findPendingScheduled(before: Date): Promise<GeneratedContent[]> {
    return prisma.generatedContent.findMany({
      where: { status: "SCHEDULED", scheduledPublishAt: { lte: before } },
    });
  }

  async countPublishedToday(profileId: string, platform: Platform): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return prisma.generatedContent.count({
      where: { profileId, platform, status: "PUBLISHED", publishedAt: { gte: startOfDay } },
    });
  }

  async findByRunId(runId: string): Promise<GeneratedContent[]> {
    return prisma.generatedContent.findMany({ where: { runId }, orderBy: { createdAt: "desc" } });
  }
}
```

### 4.2 Registry / DI Container

Mirror the singleton pattern from `entitlements/repository.ts`:

```typescript
// registry.ts
import type { IAgentRepository, IAgentRunRepository, IApiKeyRepository,
  IConnectedAccountRepository, IContentRepository, IMediaAssetRepository,
  IProfileRepository, IPublishLogRepository, ITeamMemberRepository,
  ITeamRepository, IUserRepository } from "./types";

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

let registryInstance: Repositories | null = null;

export function initRepositories(overrides?: Partial<Repositories>): Repositories {
  if (registryInstance && !overrides) return registryInstance;
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

export function getRepositories(): Repositories {
  if (!registryInstance) return initRepositories();
  return registryInstance;
}

export function resetRepositories(): void {
  registryInstance = null;
}
```

### 4.3 Barrel Export

```typescript
// index.ts
export type { IContentRepository, ContentFilterOptions, ContentPage } from "./content.repository";
export type { IAgentRepository, IAgentRunRepository } from "./agent.repository";
export type { IProfileRepository } from "./profile.repository";
export type { IUserRepository } from "./user.repository";
export type { IApiKeyRepository } from "./api-key.repository";
export type { IMediaAssetRepository } from "./media-asset.repository";
export type { ITeamRepository } from "./team.repository";
export type { ITeamMemberRepository } from "./team-member.repository";
export type { IConnectedAccountRepository } from "./connected-account.repository";
export type { IPublishLogRepository } from "./publish-log.repository";

export { PrismaContentRepository } from "./content.repository";
export { PrismaAgentRepository, PrismaAgentRunRepository } from "./agent.repository";
export { PrismaProfileRepository } from "./profile.repository";
export { PrismaUserRepository } from "./user.repository";
export { PrismaApiKeyRepository } from "./api-key.repository";
export { PrismaMediaAssetRepository } from "./media-asset.repository";
export { PrismaTeamRepository } from "./team.repository";
export { PrismaTeamMemberRepository } from "./team-member.repository";
export { PrismaConnectedAccountRepository } from "./connected-account.repository";
export { PrismaPublishLogRepository } from "./publish-log.repository";

export { getRepositories, initRepositories, resetRepositories } from "./registry";
export type { Repositories } from "./registry";
```

## 5. Integration with Existing Code

### 5.1 Migration from Direct Prisma Calls

**Current pattern (in route handlers):**
```typescript
const agents = await prisma.agent.findMany({
  where: { profileId, profile: { userId } },
  orderBy: { createdAt: "desc" },
});
```

**New pattern:**
```typescript
import { getRepositories } from "@/lib/repositories";
const { agent: agentRepo } = getRepositories();
const agents = await agentRepo.findByProfileId(profileId);
```

### 5.2 Phase-in Strategy

| Phase | Action | Risk |
|-------|--------|------|
| 1 | Create all interfaces + Prisma implementations | None (new code, not used yet) |
| 2 | Migrate 3 most-used repos (content, agent, profile) | Low — parallel implementations |
| 3 | Update route handlers to use repos | Medium — change imports |
| 4 | Update services (agent-runner, publish-guard, etc.) | Medium — change imports |
| 5 | Add deprecation notice on direct `prisma.*` calls in routes | None |

## 6. Testing Strategy

- **Unit tests**: Mock repository interfaces to test service logic without DB
- **Integration tests**: Test Prisma implementations against test DB
- **Test helpers**: `setEntitlementRepository()`-style function to inject mock repos

Each repository interface enables a pattern like:
```typescript
import { initRepositories, resetRepositories } from "@/lib/repositories";
import { mockContentRepo } from "@/test/mocks";

beforeEach(() => { initRepositories({ content: mockContentRepo }); });
afterEach(() => { resetRepositories(); });
```
