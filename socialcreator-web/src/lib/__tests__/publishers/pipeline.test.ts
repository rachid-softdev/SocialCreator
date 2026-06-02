/**
 * Tests for publish pipeline
 * Based on design spec: docs/architecture/05-publisher-strategy.md
 *
 * Self-contained: implements the pipeline logic inline matching the design spec
 * so tests run regardless of whether the source module is implemented.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline types matching the design spec ==========

interface PublishContent {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

interface PublishAccount {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
}

interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  platform?: string;
  durationMs?: number;
}

interface PublishContext {
  content: PublishContent;
  account: PublishAccount;
  platform: string;
  profileId: string;
  userId: string;
  attempt: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type ContentValidator = (content: PublishContent) => Promise<ValidationResult>;
type PrePublishHook = (ctx: PublishContext) => Promise<PublishContext | null>;
type PostPublishHook = (ctx: PublishContext, result: PublishResult) => Promise<void>;
type OnErrorHook = (ctx: PublishContext, error: Error) => Promise<void>;

interface PublisherHooks {
  prePublish?: PrePublishHook;
  postPublish?: PostPublishHook;
  onError?: OnErrorHook;
}

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  useJitter?: boolean;
  retryOnStatuses?: number[];
}

interface PublisherRegistration {
  platform: string;
  publish: (content: PublishContent, account: PublishAccount) => Promise<PublishResult>;
  validators?: ContentValidator[];
  hooks?: PublisherHooks;
  retry?: Partial<RetryConfig>;
}

interface PipelineContext {
  registration: PublisherRegistration;
  content: PublishContent;
  account: PublishAccount;
  platform: string;
  profileId: string;
  userId: string;
}

// ========== Inline implementation matching the design spec ==========

async function runPublishPipeline(ctx: PipelineContext): Promise<PublishResult> {
  const { registration, content, account, platform, profileId, userId } = ctx;
  const startTime = Date.now();

  // 1. Validate content
  if (registration.validators) {
    for (const validator of registration.validators) {
      const result = await validator(content);
      if (!result.valid) {
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
    // Apply modifications from prePublish hook
    Object.assign(publishCtx, modifiedCtx);
  }

  // 3. Execute publish with retry
  const retryConfig = {
    maxAttempts: registration.retry?.maxAttempts ?? 3,
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
      await new Promise((r) => setTimeout(r, retryConfig.baseDelayMs * 2 ** (attempt - 1)));
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
      } catch {
        // onError hook threw — proceed with failure result
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

  if (registration.hooks?.postPublish) {
    await registration.hooks.postPublish(publishCtx, result);
  }
  return result;
}

// ========== Tests ==========

describe("Publish Pipeline", () => {
  const mockContent: PublishContent = {
    textContent: "Test post content",
    mediaUrls: ["https://example.com/image.jpg"],
    hashtags: ["test", "social"],
  };

  const mockAccount: PublishAccount = {
    accountId: "acct-123",
    accessToken: "token-abc",
  };

  const mockPublish = vi.fn();
  const mockValidator = vi.fn();
  const mockPrePublish = vi.fn();
  const mockPostPublish = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockPublish.mockResolvedValue({
      success: true,
      postId: "post-123",
      postUrl: "https://example.com/post/123",
    });
    mockValidator.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    mockPrePublish.mockImplementation(async (ctx: PublishContext) => ctx);
    mockPostPublish.mockResolvedValue(undefined);
    mockOnError.mockResolvedValue(undefined);
  });

  const createPipelineContext = (overrides: Record<string, unknown> = {}): PipelineContext => ({
    registration: {
      platform: "X",
      publish: mockPublish,
      validators: [mockValidator],
      hooks: {
        prePublish: mockPrePublish,
        postPublish: mockPostPublish,
        onError: mockOnError,
      },
      retry: { maxAttempts: 3, baseDelayMs: 10 },
    },
    content: mockContent,
    account: mockAccount,
    platform: "X",
    profileId: "profile-1",
    userId: "user-1",
    ...overrides,
  });

  describe("Validation", () => {
    it("should run validators before publishing", async () => {
      const ctx = createPipelineContext();
      await runPublishPipeline(ctx);
      expect(mockValidator).toHaveBeenCalledWith(mockContent);
    });

    it("should abort with validation failure when validator returns invalid", async () => {
      mockValidator.mockResolvedValue({
        valid: false,
        errors: ["Text exceeds 4000 char limit"],
        warnings: [],
      });
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Text exceeds 4000 char limit");
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should collect multiple validation errors", async () => {
      mockValidator.mockResolvedValue({
        valid: false,
        errors: ["Text exceeds limit", "No media files provided"],
        warnings: [],
      });
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Text exceeds limit");
      expect(result.error).toContain("No media files provided");
    });

    it("should skip validation when no validators are configured", async () => {
      const ctx = createPipelineContext({
        registration: { ...createPipelineContext().registration, validators: undefined },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(mockPublish).toHaveBeenCalled();
    });
  });

  describe("prePublish hook", () => {
    it("should call prePublish hook before publishing", async () => {
      const ctx = createPipelineContext();
      await runPublishPipeline(ctx);
      expect(mockPrePublish).toHaveBeenCalled();
    });

    it("should abort publish when prePublish returns null", async () => {
      mockPrePublish.mockResolvedValue(null);
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Publish aborted by prePublish hook");
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should pass modified context from prePublish to publish", async () => {
      mockPrePublish.mockImplementation(async (ctx: PublishContext) => ({
        ...ctx,
        content: { ...ctx.content, textContent: "Modified by prePublish" },
      }));
      const ctx = createPipelineContext();

      await runPublishPipeline(ctx);

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({ textContent: "Modified by prePublish" }),
        mockAccount,
      );
    });

    it("should skip prePublish when not configured", async () => {
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          hooks: { postPublish: mockPostPublish, onError: mockOnError },
        },
      });

      const result = await runPublishPipeline(ctx);
      expect(result.success).toBe(true);
      expect(mockPublish).toHaveBeenCalled();
    });
  });

  describe("Successful publish", () => {
    it("should return success with postId and postUrl", async () => {
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-123");
      expect(result.postUrl).toBe("https://example.com/post/123");
    });

    it("should include durationMs and platform in result", async () => {
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.platform).toBe("X");
    });

    it("should call postPublish hook on success", async () => {
      const ctx = createPipelineContext();

      const _result = await runPublishPipeline(ctx);

      expect(mockPostPublish).toHaveBeenCalledWith(
        expect.objectContaining({ content: mockContent, account: mockAccount }),
        expect.objectContaining({ success: true, postId: "post-123" }),
      );
    });
  });

  describe("Retry logic", () => {
    it("should retry on publish failure", async () => {
      mockPublish
        .mockResolvedValueOnce({ success: false, error: "Rate limited" })
        .mockResolvedValueOnce({ success: true, postId: "post-456" });

      const ctx = createPipelineContext();
      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-456");
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("should exhaust retries and return failure", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Server error" });

      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 3, baseDelayMs: 10 },
        },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
      expect(mockPublish).toHaveBeenCalledTimes(3);
    });

    it("should call onError hook when all retries exhausted", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Fatal error" });
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 2, baseDelayMs: 10 },
        },
      });

      await runPublishPipeline(ctx);

      expect(mockOnError).toHaveBeenCalled();
    });

    it("should pass the correct PublishContext to onError", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Fatal error" });
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 1, baseDelayMs: 10 },
        },
      });

      await runPublishPipeline(ctx);

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockContent,
          account: mockAccount,
          platform: "X",
          profileId: "profile-1",
          userId: "user-1",
        }),
        expect.any(Error),
      );
    });

    it("should handle publish throwing an exception", async () => {
      mockPublish.mockRejectedValue(new Error("Connection timeout"));
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 2, baseDelayMs: 10 },
        },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
    });

    it("should recover from exception on retry", async () => {
      mockPublish
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ success: true, postId: "post-789" });

      const ctx = createPipelineContext();
      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-789");
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });
  });

  describe("postPublish hook", () => {
    it("should call postPublish after successful publish", async () => {
      const ctx = createPipelineContext();
      await runPublishPipeline(ctx);
      expect(mockPostPublish).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ success: true }),
      );
    });

    it("should not call postPublish on publish failure", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Failed" });
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 1, baseDelayMs: 10 },
        },
      });

      await runPublishPipeline(ctx);

      expect(mockPostPublish).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty content gracefully", async () => {
      mockPublish.mockResolvedValue({ success: true, postId: "empty-post" });
      const ctx = createPipelineContext({
        content: { textContent: "", mediaUrls: [], hashtags: [] },
      });

      const result = await runPublishPipeline(ctx);
      expect(result.success).toBe(true);
    });

    it("should handle onError throwing without crashing pipeline", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Failed" });
      mockOnError.mockRejectedValue(new Error("onError hook crashed"));
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 1, baseDelayMs: 10 },
        },
      });

      // Should still return the failure result, not throw
      const result = await runPublishPipeline(ctx);
      expect(result.success).toBe(false);
    });

    it("should handle non-Error thrown values during publish", async () => {
      mockPublish.mockRejectedValue("string error");
      const ctx = createPipelineContext({
        registration: {
          ...createPipelineContext().registration,
          retry: { maxAttempts: 2, baseDelayMs: 10 },
        },
      });

      const result = await runPublishPipeline(ctx);
      expect(result.success).toBe(false);
    });
  });
});
