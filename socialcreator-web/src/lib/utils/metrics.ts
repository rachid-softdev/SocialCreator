import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

export const activeUsers = new Gauge({
  name: "active_users_total",
  help: "Number of currently active users",
  registers: [register],
});

export const contentGenerated = new Counter({
  name: "content_generated_total",
  help: "Total pieces of content generated",
  labelNames: ["platform", "type"] as const,
  registers: [register],
});

export const oauthTokenRefresh = new Counter({
  name: "oauth_token_refresh_total",
  help: "Total OAuth token refresh attempts",
  labelNames: ["platform", "status"] as const,
  registers: [register],
});
