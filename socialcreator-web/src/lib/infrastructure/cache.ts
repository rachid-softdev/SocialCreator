import type { Redis } from "@upstash/redis";
import { getRedis } from "@/lib/infrastructure/rate-limit-redis";

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class RedisCacheService implements CacheService {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw as string) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }
}

let instance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!instance) {
    const redis = getRedis();
    if (!redis) throw new Error("Redis not configured");
    instance = new RedisCacheService(redis);
  }
  return instance;
}
