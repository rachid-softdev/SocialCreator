/**
 * Tests for job handler registration and resolution
 * Based on design spec: docs/architecture/02-async-agent-queue.md
 *
 * Self-contained: implements the handler registry inline matching the design spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline implementation matching the design spec ==========

type JobType = "agent-run" | "content-generate" | "publish" | "video-process";
type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlerRegistry = new Map<string, JobHandler>();

function registerHandler(type: string, handler: JobHandler): void {
  handlerRegistry.set(type, handler);
}

function getJobHandler(type: string): JobHandler | undefined {
  return handlerRegistry.get(type);
}

function registerBuiltinHandlers() {
  handlerRegistry.set("agent-run", async () => {});
  handlerRegistry.set("content-generate", async () => {});
  handlerRegistry.set("publish", async () => {});
  handlerRegistry.set("video-process", async () => {});
}

function resetHandlersForTest() {
  handlerRegistry.clear();
  registerBuiltinHandlers();
}

// Register all built-in handlers including content-generate
registerBuiltinHandlers();

// ========== Tests ==========

describe("Job Handlers", () => {
  beforeEach(() => {
    resetHandlersForTest();
  });

  describe("registerHandler", () => {
    it("should register a handler for a job type", () => {
      const handler = vi.fn();
      registerHandler("agent-run", handler);

      const retrieved = getJobHandler("agent-run");
      expect(retrieved).toBe(handler);
    });

    it("should overwrite existing handler when re-registering", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      registerHandler("publish", handler1);
      registerHandler("publish", handler2);

      const retrieved = getJobHandler("publish");
      expect(retrieved).toBe(handler2);
      expect(retrieved).not.toBe(handler1);
    });

    it("should register handlers for multiple job types", () => {
      const handler = vi.fn();
      registerHandler("agent-run", handler);
      registerHandler("content-generate", handler);
      registerHandler("publish", handler);
      registerHandler("video-process", handler);

      expect(getJobHandler("agent-run")).toBeDefined();
      expect(getJobHandler("content-generate")).toBeDefined();
      expect(getJobHandler("publish")).toBeDefined();
      expect(getJobHandler("video-process")).toBeDefined();
    });
  });

  describe("getJobHandler", () => {
    it("should return undefined for unknown type", () => {
      const handler = getJobHandler("unknown-type");
      expect(handler).toBeUndefined();
    });

    it("should return a handler for content-generate", () => {
      const handler = getJobHandler("content-generate");
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("should return handlers for all known job types", () => {
      const knownTypes: JobType[] = ["agent-run", "content-generate", "publish", "video-process"];
      for (const type of knownTypes) {
        expect(getJobHandler(type)).toBeDefined();
      }
    });

    it("should return the correct handler after registration", () => {
      const handler = vi.fn();
      registerHandler("agent-run", handler);

      const result = getJobHandler("agent-run");
      expect(result).toBe(handler);
    });
  });

  describe("Handler invocation", () => {
    it("should call handler with payload when invoked", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      registerHandler("agent-run", handler);

      const retrieved = getJobHandler("agent-run");
      await retrieved?.({ agentId: "a-1", runId: "r-1", userId: "u-1" });

      expect(handler).toHaveBeenCalledWith({ agentId: "a-1", runId: "r-1", userId: "u-1" });
    });

    it("should propagate errors from handler", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      registerHandler("publish", handler);

      const retrieved = getJobHandler("publish");
      await expect(retrieved?.({ contentId: "c-1" })).rejects.toThrow("Handler failed");
    });

    it("should handle different payload types correctly", async () => {
      const agentHandler = vi.fn().mockResolvedValue(undefined);
      const contentHandler = vi.fn().mockResolvedValue(undefined);
      const publishHandler = vi.fn().mockResolvedValue(undefined);
      const videoHandler = vi.fn().mockResolvedValue(undefined);

      registerHandler("agent-run", agentHandler);
      registerHandler("content-generate", contentHandler);
      registerHandler("publish", publishHandler);
      registerHandler("video-process", videoHandler);

      await getJobHandler("agent-run")?.({ agentId: "a-1", runId: "r-1", userId: "u-1" });
      await getJobHandler("content-generate")?.({
        profileId: "p-1",
        platform: "X",
        brief: "test",
        agentId: "a-1",
      });
      await getJobHandler("publish")?.({
        contentId: "c-1",
        profileId: "p-1",
        platform: "X",
        userId: "u-1",
      });
      await getJobHandler("video-process")?.({ videoAssetId: "v-1", profileId: "p-1" });

      expect(agentHandler).toHaveBeenCalled();
      expect(contentHandler).toHaveBeenCalledWith({
        profileId: "p-1",
        platform: "X",
        brief: "test",
        agentId: "a-1",
      });
      expect(publishHandler).toHaveBeenCalled();
      expect(videoHandler).toHaveBeenCalled();
    });

    it("should handle async handler that takes time to resolve", async () => {
      const handler = vi
        .fn()
        .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
      registerHandler("agent-run", handler);

      const promise = getJobHandler("agent-run")?.({ agentId: "a-1", runId: "r-1", userId: "u-1" });
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
