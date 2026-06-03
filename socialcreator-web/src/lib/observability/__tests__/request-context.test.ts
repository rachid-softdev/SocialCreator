/**
 * Tests for AsyncLocalStorage request context (Sprint 8: Observability)
 *
 * Verifies that request context is properly propagated through
 * synchronous and asynchronous code paths via AsyncLocalStorage.
 */

import { describe, expect, it } from "vitest";
import { getRequestContext, getRequestId, runWithContext } from "../request-context";

describe("request-context", () => {
  describe("runWithContext", () => {
    it("sets the context for the duration of the callback", () => {
      const context = { requestId: "test-id", method: "GET", path: "/test" };
      let captured: unknown = null;
      runWithContext(context, () => {
        captured = getRequestContext();
      });
      expect(captured).toEqual(context);
    });
  });

  describe("getRequestContext", () => {
    it("returns the current context inside runWithContext", () => {
      runWithContext({ requestId: "abc-123" }, () => {
        const ctx = getRequestContext();
        expect(ctx).toEqual({ requestId: "abc-123" });
      });
    });

    it("returns null outside a context", () => {
      expect(getRequestContext()).toBeNull();
    });
  });

  describe("getRequestId", () => {
    it("returns the requestId from the active context", () => {
      runWithContext({ requestId: "req-456" }, () => {
        expect(getRequestId()).toBe("req-456");
      });
    });

    it('returns "no-request-id" outside a context', () => {
      expect(getRequestId()).toBe("no-request-id");
    });
  });

  describe("nested contexts", () => {
    it("inner context does not leak to outer context", () => {
      const outerCtx = { requestId: "outer" };
      const innerCtx = { requestId: "inner" };

      runWithContext(outerCtx, () => {
        expect(getRequestId()).toBe("outer");

        runWithContext(innerCtx, () => {
          expect(getRequestId()).toBe("inner");
        });

        // After inner completes, we should be back to outer
        expect(getRequestId()).toBe("outer");
      });

      // After outer completes, we should be back to null
      expect(getRequestId()).toBe("no-request-id");
    });
  });

  describe("async context propagation", () => {
    it("context is available inside setTimeout", () => {
      return new Promise<void>((resolve) => {
        runWithContext({ requestId: "async-test" }, () => {
          setTimeout(() => {
            expect(getRequestId()).toBe("async-test");
            resolve();
          }, 0);
        });
      });
    });

    it("context is available inside Promise.all", async () => {
      const results: string[] = [];
      await runWithContext({ requestId: "promise-all" }, async () => {
        const [r1, r2] = await Promise.all([
          Promise.resolve().then(() => getRequestId()),
          Promise.resolve().then(() => getRequestId()),
        ]);
        results.push(r1, r2);
      });
      expect(results).toEqual(["promise-all", "promise-all"]);
    });

    it("concurrent runWithContext calls have isolated contexts", async () => {
      const [r1, r2] = await Promise.all([
        runWithContext({ requestId: "A" }, async () => {
          return getRequestId();
        }),
        runWithContext({ requestId: "B" }, async () => {
          return getRequestId();
        }),
      ]);

      expect(r1).toBe("A");
      expect(r2).toBe("B");
    });
  });
});
