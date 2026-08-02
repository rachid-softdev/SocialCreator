/**
 * Tests for the real runPublishPipeline implementation (pipeline.ts).
 *
 * All dependencies (@socialcreator/utils, @/lib/logger) are mocked.
 * The function under test is the actual export from @/lib/publishers/pipeline.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Mocks — hoisted by vitest ==========

vi.mock("@socialcreator/utils", () => ({
  computeContentHash: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ========== Imports ==========

import { computeContentHash } from "@socialcreator/utils";
import logger from "@/lib/logger";
import type { PipelineContext } from "@/lib/publishers/pipeline";
import { runPublishPipeline } from "@/lib/publishers/pipeline";
import type {
  PublishAccount,
  PublishContent,
  PublisherRegistration,
  PublishResult,
} from "@/lib/publishers/types";

// ========== Test data ==========

const mockContent: PublishContent = {
  textContent: "Test post content",
  mediaUrls: ["https://example.com/image.jpg"],
  hashtags: ["test", "social"],
};

const mockAccount: PublishAccount = {
  accountId: "acct-123",
  accessToken: "token-abc",
};

const mockPublish = vi.fn<[PublishContent, PublishAccount], Promise<PublishResult>>();
const mockValidator = vi.fn();
const mockPrePublish = vi.fn();
const mockPostPublish = vi.fn();
const mockOnError = vi.fn();

function defaultRegistration(): PublisherRegistration {
  return {
    platform: "X" as any,
    publish: mockPublish,
    validators: [mockValidator],
    hooks: { prePublish: mockPrePublish, postPublish: mockPostPublish, onError: mockOnError },
    retry: { maxAttempts: 3, baseDelayMs: 10 },
  };
}

function createPipelineContext(
  overrides: {
    registration?: Partial<PublisherRegistration>;
    content?: Partial<PublishContent>;
    account?: Partial<PublishAccount>;
    platform?: string;
    profileId?: string;
    userId?: string;
  } = {},
): PipelineContext {
  const reg = defaultRegistration();
  return {
    registration: overrides.registration ? { ...reg, ...overrides.registration } : reg,
    content: overrides.content ? { ...mockContent, ...overrides.content } : mockContent,
    account: overrides.account ? { ...mockAccount, ...overrides.account } : mockAccount,
    platform: overrides.platform ?? "X",
    profileId: overrides.profileId ?? "profile-1",
    userId: overrides.userId ?? "user-1",
  };
}

// ========== Tests ==========

describe("runPublishPipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default return values
    vi.mocked(computeContentHash).mockReturnValue("ik_test_mocked_hash");
    mockPublish.mockResolvedValue({
      success: true,
      postId: "post-123",
      postUrl: "https://example.com/post/123",
    });
    mockValidator.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    mockPrePublish.mockImplementation(async (ctx) => ctx);
    mockPostPublish.mockResolvedValue(undefined);
    mockOnError.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------
  //  Nominal cases
  // ---------------------------------------------------------------

  describe("nominal cases", () => {
    it("1: should run full pipeline successfully (valid → prePublish → publish → postPublish)", async () => {
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      // Validation ran
      expect(mockValidator).toHaveBeenCalledWith(mockContent);

      // prePublish hook was called
      expect(mockPrePublish).toHaveBeenCalled();

      // publish was called with content and account
      expect(mockPublish).toHaveBeenCalledWith(mockContent, mockAccount);

      // postPublish was called with context and result
      expect(mockPostPublish).toHaveBeenCalledWith(
        expect.objectContaining({ content: mockContent, account: mockAccount }),
        expect.objectContaining({ success: true, postId: "post-123" }),
      );

      // Result is correct
      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-123");
      expect(result.postUrl).toBe("https://example.com/post/123");
      expect(result.platform).toBe("X");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("6: should pass modified content from prePublish hook to publish", async () => {
      mockPrePublish.mockImplementation(async (ctx) => ({
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

    it("7: should call postPublish hook after successful publish with correct context", async () => {
      const ctx = createPipelineContext();

      await runPublishPipeline(ctx);

      expect(mockPostPublish).toHaveBeenCalledTimes(1);
      expect(mockPostPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockContent,
          account: mockAccount,
          platform: "X",
          profileId: "profile-1",
          userId: "user-1",
          attempt: 1,
        }),
        expect.objectContaining({
          success: true,
          postId: "post-123",
          postUrl: "https://example.com/post/123",
        }),
      );
    });

    it("10: should compute idempotencyKey via computeContentHash", async () => {
      const ctx = createPipelineContext();

      await runPublishPipeline(ctx);

      expect(vi.mocked(computeContentHash)).toHaveBeenCalledWith({
        profileId: "profile-1",
        platform: "X",
        textContent: mockContent.textContent,
        mediaUrls: mockContent.mediaUrls,
        hashtags: mockContent.hashtags,
      });

      // The key is passed to the prePublish hook
      expect(mockPrePublish).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: "ik_test_mocked_hash" }),
      );
    });
  });

  // ---------------------------------------------------------------
  //  Error handling
  // ---------------------------------------------------------------

  describe("error handling", () => {
    it("2: should abort with validation failure when validator returns invalid", async () => {
      mockValidator.mockResolvedValue({
        valid: false,
        errors: ["Too long"],
        warnings: [],
      });
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation failed: Too long");
      expect(mockPublish).not.toHaveBeenCalled();

      // Real implementation logs the validation failure
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.objectContaining({ platform: "X", errors: ["Too long"] }),
        "Content validation failed",
      );
    });

    it("3: should propagate when validator throws an exception", async () => {
      mockValidator.mockRejectedValue(new Error("Validator crashed"));
      const ctx = createPipelineContext();

      await expect(runPublishPipeline(ctx)).rejects.toThrow("Validator crashed");
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("8: should call onError hook when publish fails after all retries exhausted", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Fatal error" });
      const ctx = createPipelineContext({
        registration: { retry: { maxAttempts: 2, baseDelayMs: 10 } },
      });

      await runPublishPipeline(ctx);

      expect(mockOnError).toHaveBeenCalledTimes(1);
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockContent,
          account: mockAccount,
          platform: "X",
          profileId: "profile-1",
          userId: "user-1",
          attempt: 2, // last attempt
        }),
        expect.objectContaining({ message: "Fatal error" }),
      );
      expect(mockPostPublish).not.toHaveBeenCalled();
    });

    it("should handle non-Error thrown values during publish (string rejection)", async () => {
      mockPublish.mockRejectedValue("string error");
      const ctx = createPipelineContext({
        registration: { retry: { maxAttempts: 1, baseDelayMs: 10 } },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("string error");
    });

    it("should handle onError throwing without crashing the pipeline", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Failed" });
      mockOnError.mockRejectedValue(new Error("onError hook crashed"));
      const ctx = createPipelineContext({
        registration: { retry: { maxAttempts: 1, baseDelayMs: 10 } },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed");

      // Real implementation logs the onError hook failure
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        expect.objectContaining({ platform: "X" }),
        "onError hook threw an error",
      );
    });
  });

  // ---------------------------------------------------------------
  //  Edge cases
  // ---------------------------------------------------------------

  describe("edge cases", () => {
    it("4a: should run pipeline when multiple validators all pass", async () => {
      const validatorA = vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] });
      const validatorB = vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] });
      const ctx = createPipelineContext({
        registration: { validators: [validatorA, validatorB] },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(validatorA).toHaveBeenCalledWith(mockContent);
      expect(validatorB).toHaveBeenCalledWith(mockContent);
      expect(mockPublish).toHaveBeenCalled();
    });

    it("4b: should abort with second validator failure when sequence fails", async () => {
      const validatorA = vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] });
      const validatorB = vi.fn().mockResolvedValue({
        valid: false,
        errors: ["Second validator failed"],
        warnings: [],
      });
      const ctx = createPipelineContext({
        registration: { validators: [validatorA, validatorB] },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Second validator failed");
      expect(mockPublish).not.toHaveBeenCalled();
      // Third validator (if any) should not run
      expect(validatorA).toHaveBeenCalled();
      expect(validatorB).toHaveBeenCalled();
    });

    it("5: should continue pipeline when validator returns warnings (but valid: true)", async () => {
      mockValidator.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ["Deprecated format", "Hashtag limit near max"],
      });
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(mockPublish).toHaveBeenCalled();
    });

    it("9: should ignore retryConfig.useJitter and retryOnStatuses (documented no-op fields)", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Server error" });
      const ctx = createPipelineContext({
        registration: {
          retry: {
            maxAttempts: 3,
            baseDelayMs: 10,
            useJitter: true,
            retryOnStatuses: [429, 503],
          },
        },
      });

      const result = await runPublishPipeline(ctx);

      // Retries still happen with exponential backoff (jitter not applied)
      expect(mockPublish).toHaveBeenCalledTimes(3);
      // Even though retryOnStatuses includes 429/503, no special handling occurs
      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
    });

    it("should abort publish when prePublish hook returns null", async () => {
      mockPrePublish.mockResolvedValue(null);
      const ctx = createPipelineContext();

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Publish aborted by prePublish hook");
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should propagate error when prePublish hook throws", async () => {
      mockPrePublish.mockRejectedValue(new Error("prePublish crashed"));
      const ctx = createPipelineContext();

      await expect(runPublishPipeline(ctx)).rejects.toThrow("prePublish crashed");
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should propagate error when postPublish hook throws", async () => {
      mockPostPublish.mockRejectedValue(new Error("postPublish crashed"));
      const ctx = createPipelineContext();

      await expect(runPublishPipeline(ctx)).rejects.toThrow("postPublish crashed");
      // Publish itself succeeded
      expect(mockPublish).toHaveBeenCalled();
    });

    it("should skip validation when no validators are configured", async () => {
      const ctx = createPipelineContext({
        registration: { validators: undefined },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(mockPublish).toHaveBeenCalled();
    });

    it("should skip prePublish when not configured", async () => {
      const ctx = createPipelineContext({
        registration: { hooks: { postPublish: mockPostPublish, onError: mockOnError } },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(mockPrePublish).not.toHaveBeenCalled();
    });

    it("should retry on publish failure then succeed", async () => {
      mockPublish
        .mockResolvedValueOnce({ success: false, error: "Rate limited" })
        .mockResolvedValueOnce({ success: true, postId: "post-456" });

      const ctx = createPipelineContext();
      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
      expect(result.postId).toBe("post-456");
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("should cap maxAttempts at 10 even if configured higher", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Persistent failure" });
      const ctx = createPipelineContext({
        registration: { retry: { maxAttempts: 999, baseDelayMs: 1 } },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(mockPublish).toHaveBeenCalledTimes(10);
    });

    it("should use default maxAttempts of 3 when retry config is not provided", async () => {
      mockPublish.mockResolvedValue({ success: false, error: "Failed" });
      const ctx = createPipelineContext({
        registration: {
          platform: "X" as any,
          publish: mockPublish,
          validators: undefined,
          hooks: { onError: mockOnError },
          retry: undefined,
        },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(mockPublish).toHaveBeenCalledTimes(3);
    });

    it("should wrap non-Error rejected values in Error via String()", async () => {
      // When publish rejects with a null value, the catch block does
      // `new Error(String(null))` which produces message "null"
      mockPublish.mockRejectedValue(null);
      const ctx = createPipelineContext({
        registration: { retry: { maxAttempts: 1, baseDelayMs: 10 } },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // String(null) → "null"
      expect(result.error).toBe("null");
    });

    it("should handle empty content gracefully", async () => {
      mockPublish.mockResolvedValue({ success: true, postId: "empty-post" });
      const ctx = createPipelineContext({
        content: { textContent: "", mediaUrls: [], hashtags: [] },
      });

      const result = await runPublishPipeline(ctx);

      expect(result.success).toBe(true);
    });
  });
});
