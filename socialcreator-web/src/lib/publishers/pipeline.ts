/**
 * Publish pipeline with validation, hooks, and retry
 */

import { computeContentHash } from "@socialcreator/utils";
import logger from "@/lib/logger";
import type {
  PublishAccount,
  PublishContent,
  PublishContext,
  PublisherRegistration,
  PublishResult,
} from "./types";

export interface PipelineContext {
  registration: PublisherRegistration;
  content: PublishContent;
  account: PublishAccount;
  platform: string;
  profileId: string;
  userId: string;
}

/**
 * Run the full publish pipeline:
 * 1. Validate content (all validators)
 * 2. Run prePublish hooks
 * 3. Execute publish with retry + exponential backoff
 * 4. Run postPublish hooks or onError hooks
 */
export async function runPublishPipeline(ctx: PipelineContext): Promise<PublishResult> {
  const { registration, content, account, platform, profileId, userId } = ctx;
  const startTime = Date.now();

  // 1. Validate content
  if (registration.validators) {
    for (const validator of registration.validators) {
      const result = await validator(content);
      if (!result.valid) {
        logger.warn({ platform, errors: result.errors }, "Content validation failed");
        return {
          success: false,
          error: `Validation failed: ${result.errors.join("; ")}`,
          platform: platform as any,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  // 2. Run prePublish hooks
  const publishCtx: PublishContext = {
    content,
    account,
    platform: platform as any,
    profileId,
    userId,
    attempt: 0,
    idempotencyKey: computeContentHash({
      profileId,
      platform,
      textContent: content.textContent,
      mediaUrls: content.mediaUrls,
      hashtags: content.hashtags,
    }),
  };

  if (registration.hooks?.prePublish) {
    const modifiedCtx = await registration.hooks.prePublish(publishCtx);
    if (modifiedCtx === null) {
      return {
        success: false,
        error: "Publish aborted by prePublish hook",
        platform: platform as any,
        durationMs: Date.now() - startTime,
      };
    }
    // Apply modifications returned by the prePublish hook
    Object.assign(publishCtx, modifiedCtx);
  }

  // 3. Execute publish with retry
  const retryConfig = {
    maxAttempts: Math.min(registration.retry?.maxAttempts ?? 3, 10),
    baseDelayMs: registration.retry?.baseDelayMs ?? 1000,
  };

  let lastError: Error | null = null;
  let result: PublishResult | null = null;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    publishCtx.attempt = attempt;

    try {
      result = await registration.publish(publishCtx.content, publishCtx.account);
      if (result.success) break;

      lastError = new Error(result.error || "Publish returned failure");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < retryConfig.maxAttempts) {
      const delayMs = retryConfig.baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        { platform, attempt, maxAttempts: retryConfig.maxAttempts, delayMs },
        "Publish attempt failed, retrying",
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (result) {
    result.durationMs = Date.now() - startTime;
    result.platform = platform as any;
  }

  if (!result?.success) {
    if (registration.hooks?.onError && lastError) {
      try {
        await registration.hooks.onError(publishCtx, lastError);
      } catch (hookError) {
        logger.error({ platform, err: hookError }, "onError hook threw an error");
      }
    }
    return (
      result ?? {
        success: false,
        error: lastError?.message ?? "Unknown error",
        platform: platform as any,
        durationMs: Date.now() - startTime,
      }
    );
  }

  // 4. Post-publish hook
  if (registration.hooks?.postPublish) {
    await registration.hooks.postPublish(publishCtx, result);
  }

  return result;
}
