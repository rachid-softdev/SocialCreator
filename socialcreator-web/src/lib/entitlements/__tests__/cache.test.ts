/**
 * Feature Flags & Entitlements - Cache Tests
 * Two-level cache: Redis (Upstash) + Memory LRU fallback
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockRedisInstance = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([] as string[]),
  publish: vi.fn(),
};

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(() => mockRedisInstance),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

// ============================================
// Helpers
// ============================================

async function importCache() {
  return await import("../cache");
}

// ============================================
// Tests
// ============================================

describe("Entitlements Cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  // ============================================
  // Memory LRU Cache (via public API, no Redis)
  // ============================================

  describe("MemoryLRUCache (via cacheService, no Redis)", () => {
    beforeEach(() => {
      // Ensure Redis env vars are NOT set so getEntitlementsRedis() returns null
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it("should set and get a value", async () => {
      const { cacheService } = await importCache();
      await cacheService.set("test-key", { foo: "bar" });
      const result = await cacheService.get("test-key");
      expect(result).toEqual({ foo: "bar" });
    });

    it("should return null for missing key", async () => {
      const { cacheService } = await importCache();
      const result = await cacheService.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should delete a value on invalidate", async () => {
      const { cacheService } = await importCache();
      await cacheService.set("del-key", "value");
      await cacheService.invalidate("del-key");
      const result = await cacheService.get("del-key");
      expect(result).toBeNull();
    });

    it("should clear all values", async () => {
      const { cacheService, clearMemoryCache } = await importCache();
      await cacheService.set("a", 1);
      await cacheService.set("b", 2);
      clearMemoryCache();
      expect(await cacheService.get("a")).toBeNull();
      expect(await cacheService.get("b")).toBeNull();
    });

    it("should expire entries after memory TTL", async () => {
      vi.useFakeTimers();
      const { cacheService } = await importCache();
      await cacheService.set("ttl-key", "value");
      // Immediately accessible
      expect(await cacheService.get("ttl-key")).toBe("value");
      // Advance past MEMORY_TTL_MS (30s)
      vi.advanceTimersByTime(31_000);
      // Should be expired in memory (no Redis to fall back to)
      expect(await cacheService.get("ttl-key")).toBeNull();
      vi.useRealTimers();
    });

    it("should evict oldest entries when cache exceeds maxSize", async () => {
      const { cacheService } = await importCache();
      // MemoryLRUCache maxSize is 1000; set 1001 keys to force eviction
      for (let i = 0; i < 1001; i++) {
        await cacheService.set(`key-${i}`, `value-${i}`);
      }
      // First key should be evicted
      expect(await cacheService.get("key-0")).toBeNull();
      // Most recent key should survive
      expect(await cacheService.get("key-1000")).toBe("value-1000");
    });

    it("should reorder on access (MRU) to prevent eviction", async () => {
      const { cacheService } = await importCache();
      // Fill to maxSize (1000)
      for (let i = 0; i < 1000; i++) {
        await cacheService.set(`key-${i}`, `value-${i}`);
      }
      // Access key-0 → moves to MRU end
      await cacheService.get("key-0");
      // Add one more, evicting the new LRU (key-1)
      await cacheService.set("overflow", "last");
      // key-0 was MRU-promoted, should survive
      expect(await cacheService.get("key-0")).toBe("value-0");
      // key-1 was not accessed again → becomes LRU → evicted
      expect(await cacheService.get("key-1")).toBeNull();
    });

    it("should clean up only expired entries", async () => {
      vi.useFakeTimers();
      const { cacheService, cleanupExpiredMemoryCache } = await importCache();
      await cacheService.set("fresh", "still-good");
      await cacheService.set("stale", "gone");
      // Advance past TTL
      vi.advanceTimersByTime(31_000);
      // Set a new entry (fresh TTL)
      await cacheService.set("fresh2", "also-good");
      // Clean up expired only
      cleanupExpiredMemoryCache();
      expect(await cacheService.get("fresh")).toBeNull();
      expect(await cacheService.get("stale")).toBeNull();
      expect(await cacheService.get("fresh2")).toBe("also-good");
      vi.useRealTimers();
    });
  });

  // ============================================
  // cacheService.get — Two-level lookup
  // ============================================

  describe("cacheService.get", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    it("should return value from Redis on hit and populate memory", async () => {
      mockRedisInstance.get.mockResolvedValue("redis-value");
      const { cacheService } = await importCache();

      const result = await cacheService.get("some-key");
      expect(result).toBe("redis-value");
      expect(mockRedisInstance.get).toHaveBeenCalledWith("some-key");
    });

    it("should fall back to memory cache on Redis miss", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const { cacheService } = await importCache();

      // Set in memory directly (simulate a previous set)
      // Use a separate key; the cacheService was just imported (memory empty)
      // We need to set it first via cacheService.set, then test get fallback
      await cacheService.set("fallback-key", "memory-value");

      // Reset Redis mock call count from the set operation
      vi.clearAllMocks();
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await cacheService.get("fallback-key");
      expect(result).toBe("memory-value");
    });

    it("should return null when both Redis and memory miss", async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      const { cacheService } = await importCache();

      const result = await cacheService.get("no-data");
      expect(result).toBeNull();
    });

    it("should log warning on Redis error and fall back to memory", async () => {
      mockRedisInstance.get.mockRejectedValue(new Error("Redis timeout"));
      const { cacheService } = await importCache();
      await cacheService.set("err-key", "fallback-value");
      // Clear the set call logs
      vi.clearAllMocks();
      mockRedisInstance.get.mockRejectedValue(new Error("Redis timeout"));

      const result = await cacheService.get("err-key");
      expect(result).toBe("fallback-value");
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================
  // cacheService.set
  // ============================================

  describe("cacheService.set", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    it("should set value in both Redis and memory", async () => {
      mockRedisInstance.set.mockResolvedValue("OK");
      const { cacheService } = await importCache();

      await cacheService.set("multi-key", { data: 42 });

      expect(mockRedisInstance.set).toHaveBeenCalledWith(
        "multi-key",
        JSON.stringify({ data: 42 }),
        { ex: 300 },
      );
    });

    it("should log warning on Redis set failure but continue", async () => {
      mockRedisInstance.set.mockRejectedValue(new Error("Redis down"));
      const { cacheService } = await importCache();

      // Should not throw
      await expect(cacheService.set("fails", "val")).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================
  // cacheService.invalidate
  // ============================================

  describe("cacheService.invalidate", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    it("should delete from both Redis and memory", async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      const { cacheService } = await importCache();
      await cacheService.set("inv-key", "val");
      await cacheService.invalidate("inv-key");

      expect(mockRedisInstance.del).toHaveBeenCalledWith("inv-key");
      // Memory should be cleared too
      expect(await cacheService.get("inv-key")).toBeNull();
    });

    it("should log warning on Redis del failure", async () => {
      mockRedisInstance.del.mockRejectedValue(new Error("Redis error"));
      const { cacheService } = await importCache();

      await expect(cacheService.invalidate("bad-key")).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================
  // cacheService.invalidatePattern
  // ============================================

  describe("cacheService.invalidatePattern", () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    it("should find keys by pattern and delete them", async () => {
      mockRedisInstance.keys.mockResolvedValue(["entitlements:org-1", "entitlements:org-2"]);
      mockRedisInstance.del.mockResolvedValue(2);
      const { cacheService } = await importCache();

      await cacheService.invalidatePattern("entitlements:*");

      expect(mockRedisInstance.keys).toHaveBeenCalledWith("entitlements:*");
      expect(mockRedisInstance.del).toHaveBeenCalledWith(
        "entitlements:org-1",
        "entitlements:org-2",
      );
    });

    it("should skip del when no keys match", async () => {
      mockRedisInstance.keys.mockResolvedValue([]);
      const { cacheService } = await importCache();

      await cacheService.invalidatePattern("no-match:*");

      expect(mockRedisInstance.keys).toHaveBeenCalled();
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // cacheService.publishInvalidation
  // ============================================

  describe("cacheService.publishInvalidation", () => {
    it("should publish invalidation event to Redis channel", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
      mockRedisInstance.publish.mockResolvedValue(1);
      const { cacheService } = await importCache();

      await cacheService.publishInvalidation("org-123");

      expect(mockRedisInstance.publish).toHaveBeenCalledWith(
        "entitlements-invalidation",
        JSON.stringify({ orgId: "org-123", key: "entitlements:org-123" }),
      );
    });

    it("should log warning when publishing without Redis configured", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      const { cacheService } = await importCache();

      await cacheService.publishInvalidation("org-123");

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockRedisInstance.publish).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // getEntitlementsRedis
  // ============================================

  describe("getEntitlementsRedis", () => {
    it("should return null when Redis env vars are missing", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      const { getEntitlementsRedis } = await importCache();

      expect(getEntitlementsRedis()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should create Redis instance when env vars are present", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
      const { getEntitlementsRedis } = await importCache();

      const redis = getEntitlementsRedis();
      expect(redis).not.toBeNull();
    });

    it("should return cached Redis instance on subsequent calls", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
      const { getEntitlementsRedis } = await importCache();

      // The mock factory returns a new object each time `new Redis()` is called,
      // but getEntitlementsRedis caches it after the first call.
      const first = getEntitlementsRedis();
      const second = getEntitlementsRedis();

      expect(second).toBe(first);
    });
  });

  // ============================================
  // getEntitlementsCacheKey
  // ============================================

  describe("getEntitlementsCacheKey", () => {
    it("should return prefixed key", async () => {
      const { getEntitlementsCacheKey } = await importCache();
      expect(getEntitlementsCacheKey("org-abc")).toBe("entitlements:org-abc");
    });
  });

  // ============================================
  // subscribeToInvalidations
  // ============================================

  describe("subscribeToInvalidations", () => {
    it("should return no-op cleanup when Redis not configured", async () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      const { subscribeToInvalidations } = await importCache();

      const cleanup = await subscribeToInvalidations(vi.fn());
      expect(typeof cleanup).toBe("function");
      // Calling cleanup should not throw
      expect(() => cleanup()).not.toThrow();
    });

    it("should return no-op cleanup when Redis is configured", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
      const { subscribeToInvalidations } = await importCache();

      const cleanup = await subscribeToInvalidations(vi.fn());
      expect(typeof cleanup).toBe("function");
      expect(() => cleanup()).not.toThrow();
    });
  });

  // ============================================
  // clearMemoryCache / cleanupExpiredMemoryCache
  // ============================================

  describe("clearMemoryCache", () => {
    it("should clear all entries from memory cache", async () => {
      const { cacheService, clearMemoryCache } = await importCache();
      await cacheService.set("a", 1);
      await cacheService.set("b", 2);

      clearMemoryCache();

      expect(await cacheService.get("a")).toBeNull();
      expect(await cacheService.get("b")).toBeNull();
    });
  });
});
