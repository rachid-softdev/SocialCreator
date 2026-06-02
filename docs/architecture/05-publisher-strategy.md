# Publisher Strategy Pattern — SocialCreator

## 1. Overview

The existing `socialcreator-web/src/lib/publishers/` already implements a strategy pattern:
- `Publisher` interface with `publish()` method
- `publisherMap` for O(1) lookup
- `getPublisher(platform)` factory function
- `publishContent()` convenience function
- 8 platform-specific publisher files

This document **enhances** the existing pattern — not replaces it — adding:
- **Per-platform validation** (pre-publish content validation)
- **Rate-limit awareness** (check daily caps before publishing)
- **Platform-specific retry logic** (backoff per platform)
- **Publish pipeline** with hooks: `prePublish`, `postPublish`, `onError`

## 2. File Structure

```
socialcreator-web/src/lib/publishers/
├── index.ts                  # MODIFIED: add pipeline + enhanced factory
├── types.ts                  # NEW: shared types for pipeline
├── pipeline.ts               # NEW: publish pipeline with hooks
├── registry.ts               # NEW: enhanced registration
├── validators.ts             # NEW: content validators per platform
├── retry.ts                  # NEW: platform-specific retry configs
├── facebook.ts               # EXISTING (unchanged)
├── instagram.ts              # EXISTING
├── linkedin.ts               # EXISTING
├── pinterest.ts              # EXISTING
├── threads.ts                # EXISTING
├── tiktok.ts                 # EXISTING
├── x.ts                      # EXISTING
└── youtube.ts                # EXISTING
```

## 3. Types

```typescript
// types.ts
import type { Platform } from "@prisma/client";

export interface PublishContent {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

export interface PublishAccount {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  platform?: Platform;
  durationMs?: number;
}

export interface PublishContext {
  content: PublishContent;
  account: PublishAccount;
  platform: Platform;
  profileId: string;
  userId: string;
  attempt: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type ContentValidator = (content: PublishContent) => Promise<ValidationResult>;

export type PrePublishHook = (ctx: PublishContext) => Promise<PublishContext | null>;
export type PostPublishHook = (ctx: PublishContext, result: PublishResult) => Promise<void>;
export type OnErrorHook = (ctx: PublishContext, error: Error) => Promise<void>;

export interface PublisherHooks {
  prePublish?: PrePublishHook;
  postPublish?: PostPublishHook;
  onError?: OnErrorHook;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  useJitter: boolean;
  retryOnStatuses: number[];
}

export interface PublisherRegistration {
  platform: Platform;
  publish: (content: PublishContent, account: PublishAccount) => Promise<PublishResult>;
  validators?: ContentValidator[];
  hooks?: PublisherHooks;
  retry?: Partial<RetryConfig>;
}
```

## 4. Pipeline

```typescript
// pipeline.ts
import logger from "@/lib/utils/logger";
import type { PublishAccount, PublishContent, PublishContext, PublishResult, PublisherRegistration } from "./types";

export interface PipelineContext {
  registration: PublisherRegistration;
  content: PublishContent;
  account: PublishAccount;
  platform: string;
  profileId: string;
  userId: string;
}

export async function runPublishPipeline(ctx: PipelineContext): Promise<PublishResult> {
  const { registration, content, account, platform, profileId, userId } = ctx;
  const startTime = Date.now();

  // 1. Validate content
  if (registration.validators) {
    for (const validator of registration.validators) {
      const result = await validator(content);
      if (!result.valid) {
        logger.warn({ platform, errors: result.errors }, "Content validation failed");
        return { success: false, error: `Validation failed: ${result.errors.join("; ")}`, platform: platform as any, durationMs: Date.now() - startTime };
      }
    }
  }

  // 2. Run prePublish hooks
  const publishCtx: PublishContext = { content, account, platform: platform as any, profileId, userId, attempt: 0 };
  if (registration.hooks?.prePublish) {
    const modifiedCtx = await registration.hooks.prePublish(publishCtx);
    if (modifiedCtx === null) {
      return { success: false, error: "Publish aborted by prePublish hook", platform: platform as any, durationMs: Date.now() - startTime };
    }
  }

  // 3. Execute publish with retry
  const retryConfig = { maxAttempts: registration.retry?.maxAttempts ?? 3, baseDelayMs: registration.retry?.baseDelayMs ?? 1000 };
  let lastError: Error | null = null;
  let result: PublishResult | null = null;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    publishCtx.attempt = attempt;
    try {
      result = await registration.publish(content, account);
      if (result.success) break;
      lastError = new Error(result.error || "Publish returned failure");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < retryConfig.maxAttempts) {
      await new Promise((r) => setTimeout(r, retryConfig.baseDelayMs * 2 ** (attempt - 1)));
    }
  }

  if (result) { result.durationMs = Date.now() - startTime; result.platform = platform as any; }

  if (!result || !result.success) {
    if (registration.hooks?.onError && lastError) await registration.hooks.onError(publishCtx, lastError);
    return result ?? { success: false, error: lastError?.message ?? "Unknown error", platform: platform as any, durationMs: Date.now() - startTime };
  }

  if (registration.hooks?.postPublish) await registration.hooks.postPublish(publishCtx, result);
  return result;
}
```

## 5. Enhanced Registry

```typescript
// registry.ts
import type { Platform } from "@prisma/client";
import type { PublisherRegistration } from "./types";
import type { Publisher } from "./index";

const registryMap = new Map<Platform, PublisherRegistration>();

export function registerPublisherWithConfig(platform: Platform, registration: PublisherRegistration): void {
  registryMap.set(platform, registration);
}

export function registerSimplePublisher(platform: Platform, publisher: Publisher): void {
  registerPublisherWithConfig(platform, {
    platform, publish: (content, account) => publisher.publish(content, account),
  });
}

export function getPublisherRegistration(platform: Platform): PublisherRegistration {
  const registration = registryMap.get(platform);
  if (!registration) throw new Error(`No publisher registered for platform: ${platform}`);
  return registration;
}

export function hasPublisher(platform: Platform): boolean { return registryMap.has(platform); }
```

## 6. Content Validators

```typescript
// validators.ts
import type { ContentValidator, PublishContent } from "./types";

export function characterLimitValidator(maxChars: number): ContentValidator {
  return async (content: PublishContent) => {
    const errors: string[] = [];
    if (content.textContent.length > maxChars) errors.push(`Text exceeds ${maxChars} char limit`);
    return { valid: errors.length === 0, errors, warnings: [] };
  };
}

export const xValidator: ContentValidator = characterLimitValidator(4000);

export const tiktokValidator: ContentValidator = async (content: PublishContent) => {
  const errors: string[] = [];
  if (!content.mediaUrls.some((u) => u.match(/\.(mp4|mov|avi)$/i)))
    errors.push("TikTok requires at least one video file");
  return { valid: errors.length === 0, errors, warnings: [] };
};
```

## 7. Enhanced Index.ts (Backward Compatible)

The existing `index.ts` stays as-is. New functions are added to the barrel export.

## 8. Integration with Existing Code

No existing code breaks. The enhanced pipeline is opt-in:
- `getPublisher(platform)` works exactly as before
- New callers can use `runPublishPipeline()` for the full hook/validation pipeline

## 9. Testing Strategy

- **Unit tests**: Test each validator, hook, and the pipeline orchestration
- **Integration tests**: Test pipeline + real publisher functions
- **Backward compat**: Verify existing `getPublisher` + `publishContent` still work
- **Edge cases**: Abort from prePublish hook, retry exhaustion, validation failure
