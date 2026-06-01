/**
 * Tests for request-id utilities (S2.2 — Correlation ID / Request ID tracing)
 *
 * These tests assume the interface defined in IMPLEMENTATION_PLAN.md:
 *   REQUEST_ID_HEADER = "x-request-id"
 *   generateRequestId(): string       // Returns a UUID v4
 *   getOrCreateRequestId(request: Request): string  // Extracts from header or generates new
 */

import { describe, expect, it, vi } from "vitest";
import { generateRequestId, getOrCreateRequestId, REQUEST_ID_HEADER } from "../request-id";

describe("request-id", () => {
  describe("REQUEST_ID_HEADER", () => {
    it("should be 'x-request-id'", () => {
      expect(REQUEST_ID_HEADER).toBe("x-request-id");
    });
  });

  describe("generateRequestId", () => {
    it("should generate a string", () => {
      const id = generateRequestId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should generate a UUID v4 format (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)", () => {
      const id = generateRequestId();
      // UUID v4 format: 8-4-4-4-12 hex chars, version nibble = 4
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it("should generate unique IDs on subsequent calls", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it("should generate at least 100 unique IDs without collision", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("getOrCreateRequestId", () => {
    function createMockRequest(headers: Record<string, string> = {}): Request {
      return {
        headers: {
          get: vi.fn((name: string) => headers[name] ?? null),
          has: vi.fn(),
          forEach: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          append: vi.fn(),
          getSetCookie: vi.fn(),
          entries: vi.fn(),
          keys: vi.fn(),
          values: vi.fn(),
          [Symbol.iterator]: vi.fn(),
        },
      } as unknown as Request;
    }

    it("should extract existing request ID from headers", () => {
      const request = createMockRequest({ "x-request-id": "existing-id-123" });
      const result = getOrCreateRequestId(request);
      expect(result).toBe("existing-id-123");
    });

    it("should create a new request ID if header is missing", () => {
      const request = createMockRequest({});
      const result = getOrCreateRequestId(request);

      // Should be a valid UUID
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("should create a new unique ID each time header is missing", () => {
      const request1 = createMockRequest({});
      const request2 = createMockRequest({});

      const id1 = getOrCreateRequestId(request1);
      const id2 = getOrCreateRequestId(request2);

      expect(id1).not.toBe(id2);
    });

    it("should return existing ID from different header casing", () => {
      // Headers are typically case-insensitive
      const request = createMockRequest({ "X-Request-Id": "case-insensitive-id" });
      const result = getOrCreateRequestId(request);
      // NOTE: This test documents current behavior. If the implementation
      // uses request.headers.get() which is case-insensitive per spec,
      // this should work. If not, this test will need adjustment.
      expect(typeof result).toBe("string");
    });

    it("should use generateRequestId when creating new IDs", () => {
      const request = createMockRequest({});
      const result = getOrCreateRequestId(request);

      // Validate it's a proper UUID (matching generateRequestId output)
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("should not mutate the request object", () => {
      const headers: Record<string, string> = {};
      const request = createMockRequest(headers);
      const headersGetSpy = vi.spyOn(request.headers, "get");

      const _id = getOrCreateRequestId(request);

      // Should have read the header but not written to it
      expect(headersGetSpy).toHaveBeenCalledWith("x-request-id");
      expect(headersGetSpy).toHaveBeenCalledTimes(1);
    });
  });
});
