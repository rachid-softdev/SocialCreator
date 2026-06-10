import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisCacheService } from "../infrastructure/cache";
import type { CacheService } from "../infrastructure/cache";

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  };
}

describe("RedisCacheService", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let cache: CacheService;

  beforeEach(() => {
    mockRedis = createMockRedis();
    cache = new RedisCacheService(mockRedis as any);
  });

  describe("get", () => {
    it("should return parsed value when key exists", async () => {
      const value = { foo: "bar", num: 42 };
      mockRedis.get.mockResolvedValue(JSON.stringify(value));

      const result = await cache.get<typeof value>("test-key");

      expect(result).toStrictEqual(value);
      expect(mockRedis.get).toHaveBeenCalledWith("test-key");
    });

    it("should return null when key does not exist", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get<string>("missing-key");

      expect(result).toBeNull();
    });

    it("should return null when redis returns empty string", async () => {
      mockRedis.get.mockResolvedValue("");

      const result = await cache.get<string>("empty-key");

      expect(result).toBeNull();
    });

    it("should handle primitive values", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify("hello"));

      const result = await cache.get<string>("str-key");

      expect(result).toBe("hello");
    });

    it("should handle numeric values", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(123));

      const result = await cache.get<number>("num-key");

      expect(result).toBe(123);
    });
  });

  describe("set", () => {
    it("should store JSON-stringified value with TTL", async () => {
      const value = { data: "test" };

      await cache.set("my-key", value, 60);

      expect(mockRedis.set).toHaveBeenCalledWith("my-key", JSON.stringify(value), { ex: 60 });
    });

    it("should store primitive values with TTL", async () => {
      await cache.set("str-key", "hello", 300);

      expect(mockRedis.set).toHaveBeenCalledWith("str-key", JSON.stringify("hello"), { ex: 300 });
    });

    it("should store arrays with TTL", async () => {
      const arr = [1, 2, 3];

      await cache.set("arr-key", arr, 120);

      expect(mockRedis.set).toHaveBeenCalledWith("arr-key", JSON.stringify(arr), { ex: 120 });
    });
  });

  describe("del", () => {
    it("should delete a key", async () => {
      mockRedis.del.mockResolvedValue(1);

      await cache.del("delete-me");

      expect(mockRedis.del).toHaveBeenCalledWith("delete-me");
    });

    it("should not throw when key does not exist", async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(cache.del("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("exists", () => {
    it("should return true when key exists", async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cache.exists("existing-key");

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith("existing-key");
    });

    it("should return false when key does not exist", async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cache.exists("missing-key");

      expect(result).toBe(false);
    });
  });

  describe("round-trip (get/set)", () => {
    it("should return the same value after being set", async () => {
      const original = { name: "test", count: 99 };

      await cache.set("roundtrip", original, 60);
      mockRedis.get.mockResolvedValue(JSON.stringify(original));

      const result = await cache.get<typeof original>("roundtrip");

      expect(result).toStrictEqual(original);
    });

    it("should return null after being deleted", async () => {
      mockRedis.del.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);

      await cache.del("deleted-key");
      const result = await cache.get<string>("deleted-key");

      expect(result).toBeNull();
    });
  });
});
