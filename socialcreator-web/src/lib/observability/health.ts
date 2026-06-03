import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";
import { version } from "../../../package.json";
import { createLogger } from "./logger";

const PROCESS_START = Date.now();
const logger = createLogger("health");

export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  revision: string;
  responseTimeMs: number;
  checks: Record<string, "ok" | "failed" | "skipped">;
}

/**
 * Run a database health check by executing SELECT 1.
 */
async function checkDatabase(): Promise<"ok" | "failed"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch (error) {
    logger.error({ err: error }, "Database health check failed");
    return "failed";
  }
}

/**
 * Run an optional Redis health check.
 * Only executes if UPSTASH_REDIS_REST_URL is configured.
 */
async function checkRedis(): Promise<"ok" | "failed" | "skipped"> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return "skipped";
  }

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redis = new Redis({ url, token });
    await redis.ping();
    return "ok";
  } catch (error) {
    logger.warn({ err: error }, "Redis health check failed");
    return "failed";
  }
}

/**
 * Perform all health checks and return a aggregated result.
 */
export async function getHealth(): Promise<HealthCheckResult> {
  const start = Date.now();

  const [dbStatus, redisStatus] = await Promise.all([checkDatabase(), checkRedis()]);

  const checks: Record<string, "ok" | "failed" | "skipped"> = {
    database: dbStatus,
    redis: redisStatus,
  };

  const anyFailed = Object.values(checks).some((v) => v === "failed");
  const status = anyFailed ? "unhealthy" : "healthy";

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - PROCESS_START) / 1000),
    version,
    revision: process.env.GIT_REVISION || "unknown",
    responseTimeMs: Date.now() - start,
    checks,
  };
}
