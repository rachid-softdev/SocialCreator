# Feature Gate Dependency Injection — SocialCreator

## 1. Overview

The existing `entitlements/` module already implements a simplified manual DI pattern:
- `IEntitlementRepository` interface
- `PrismaEntitlementRepository` implementation
- Singleton getters (`getEntitlementRepository()`, `getFeatureGateService()`)
- Test helpers (`setEntitlementRepository()`, `resetEntitlementRepository()`)

This document defines a lightweight DI container that works WITH the existing entitlements
module (not replacing it), and provides general-purpose DI for the entire application.

**Key principle**: Keep it simple. No `tsyringe`, no `inversify`, no decorator reflection.
A registry-based container with explicit registration.

## 2. Constraints

- Must NOT break the existing `entitlements/` module's getter pattern
- Must coexist with `getEntitlementRepository()` and `getFeatureGateService()`
- The existing `FeatureGateService` uses `this.repo = getEntitlementRepository()` internally
  — the DI container should provide an alternative way to inject deps into `FeatureGateService`
- No new npm dependencies

## 3. File Structure

```
socialcreator-web/src/lib/di/
├── index.ts           # Barrel export
├── container.ts       # DI container (registry pattern)
├── token.ts           # Service tokens
├── adapters.ts        # Adapters for existing service getters
└── __tests__/
    └── container.test.ts
```

## 4. Core Container

```typescript
// container.ts
export type Lifetime = "singleton" | "transient" | "scoped";

interface Registration<T> {
  factory: () => T;
  lifetime: Lifetime;
  instance?: T;
  scopedInstances?: Map<string, T>;
}

export class Container {
  private registrations = new Map<string, Registration<any>>();
  private parent: Container | null = null;
  private scopeId = "root";

  constructor(parent?: Container) { this.parent = parent ?? null; }

  register<T>(name: string, factory: () => T, lifetime: Lifetime = "singleton"): void {
    if (this.registrations.has(name)) throw new Error(`Service already registered: ${name}`);
    this.registrations.set(name, { factory, lifetime });
  }

  registerInstance<T>(name: string, instance: T): void {
    this.registrations.set(name, { factory: () => instance, lifetime: "singleton", instance });
  }

  isRegistered(name: string): boolean {
    return this.registrations.has(name) || (this.parent?.isRegistered(name) ?? false);
  }

  resolve<T>(name: string): T {
    const registration = this.registrations.get(name);
    if (registration) return this.resolveFromRegistration<T>(registration);
    if (this.parent) return this.parent.resolve<T>(name);
    throw new Error(`Service not registered: ${name}`);
  }

  createScope(scopeId?: string): Container {
    const child = new Container(this);
    child.scopeId = scopeId ?? crypto.randomUUID();
    return child;
  }

  override<T>(name: string, factory: () => T): void {
    this.registrations.set(name, { factory, lifetime: "transient" });
  }

  clear(): void { this.registrations.clear(); }

  private resolveFromRegistration<T>(registration: Registration<T>): T {
    switch (registration.lifetime) {
      case "singleton":
        if (!registration.instance) registration.instance = registration.factory();
        return registration.instance;
      case "transient":
        return registration.factory();
      case "scoped":
        if (!registration.scopedInstances) registration.scopedInstances = new Map();
        if (!registration.scopedInstances.has(this.scopeId))
          registration.scopedInstances.set(this.scopeId, registration.factory());
        return registration.scopedInstances.get(this.scopeId)!;
    }
  }
}

let defaultContainer: Container | null = null;
export function getContainer(): Container {
  if (!defaultContainer) defaultContainer = new Container();
  return defaultContainer;
}
export function resetContainer(): void { defaultContainer = null; }
```

## 5. Service Tokens

```typescript
// token.ts
export const TOKENS = {
  PRISMA_CLIENT: "PrismaClient",
  LOGGER: "Logger",
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
  ENTITLEMENT_REPOSITORY: "IEntitlementRepository",
  FEATURE_GATE_SERVICE: "FeatureGateService",
  PUBLISH_SERVICE: "PublishService",
  AGENT_SERVICE: "AgentService",
} as const;
```

## 6. Adapters for Existing Module

```typescript
// adapters.ts
import { getEntitlementRepository, PrismaEntitlementRepository } from "@/lib/entitlements/repository";
import { FeatureGateService } from "@/lib/entitlements/feature-gate";
import type { IEntitlementRepository } from "@/lib/entitlements/types";
import { Container } from "./container";
import { TOKENS } from "./token";

export function registerDefaultServices(container: Container): void {
  container.register(TOKENS.PRISMA_CLIENT, () => { const { prisma } = require("@/lib/infrastructure/prisma"); return prisma; }, "singleton");
  container.register(TOKENS.ENTITLEMENT_REPOSITORY, () => getEntitlementRepository(), "singleton");
  container.register(TOKENS.FEATURE_GATE_SERVICE, () => new FeatureGateService(), "singleton");
}

export function createDefaultContainer(): Container {
  const container = new Container();
  registerDefaultServices(container);
  return container;
}
```

## 7. Integration with Existing Code

### 7.1 How `FeatureGateService` Uses the DI Container

Currently, `FeatureGateService` does:
```typescript
export class FeatureGateService {
  private repo = getEntitlementRepository(); // hardcoded singleton
```

The DI allows an alternative constructor or setter:
```typescript
export class FeatureGateService {
  private repo: IEntitlementRepository;
  constructor(repo?: IEntitlementRepository) {
    this.repo = repo ?? getEntitlementRepository();
  }
}
```

### 7.2 No-Break Migration

| Step | Change | Impact |
|------|--------|--------|
| 1 | Create `di/` module | None (new files) |
| 2 | Add optional `repo` param to `FeatureGateService` constructor | None (backward compat) |
| 3 | Register existing services in `registerDefaultServices()` | None (not yet used) |
| 4 | Use container in new services | Low |
| 5 | (Future) Migrate existing services to constructor injection | Medium |

## 8. Testing Strategy

```typescript
describe("DI Container", () => {
  it("resolves singletons to the same instance", () => {
    const c = new Container();
    c.register("test", () => ({ value: 1 }), "singleton");
    expect(c.resolve("test")).toBe(c.resolve("test"));
  });

  it("creates new instances for transient", () => {
    const c = new Container();
    c.register("test", () => ({ value: Math.random() }), "transient");
    expect(c.resolve("test")).not.toBe(c.resolve("test"));
  });

  it("supports parent-child scopes", () => {
    const parent = new Container();
    parent.register("config", () => ({ env: "test" }), "singleton");
    const child = parent.createScope();
    expect(child.resolve("config")).toBe(parent.resolve("config"));
  });

  it("allows overrides for testing", () => {
    const c = new Container();
    c.register("repo", () => ({ find: () => "real" }), "singleton");
    c.override("repo", () => ({ find: () => "mock" }));
    expect(c.resolve<any>("repo").find()).toBe("mock");
  });
});
```
