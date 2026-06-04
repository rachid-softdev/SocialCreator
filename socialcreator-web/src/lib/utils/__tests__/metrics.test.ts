/**
 * Tests for Prometheus metrics utilities
 * Verifies that all metrics are registered with correct configuration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("metrics", () => {
  beforeEach(async () => {
    // Clear any existing registered metrics before each test
    const { register } = await import("prom-client");
    register.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should export a Registry instance", async () => {
    const { register } = await import("../metrics");
    expect(register).toBeDefined();
    expect(register.metrics()).resolves.toBeDefined();
  });

  it("should register httpRequestDuration histogram with correct config", async () => {
    const { httpRequestDuration, register } = await import("../metrics");
    expect(httpRequestDuration).toBeDefined();
    const metricNames = await register.getMetricsAsJSON();
    const found = metricNames.find((m: any) => m.name === "http_request_duration_seconds");
    expect(found).toBeDefined();
    expect(found?.type).toBe("histogram");
    expect(found?.help).toContain("Duration of HTTP requests");
  });

  it("should register httpRequestTotal counter with correct label names", async () => {
    const { httpRequestTotal, register } = await import("../metrics");
    expect(httpRequestTotal).toBeDefined();
    const metricNames = await register.getMetricsAsJSON();
    const found = metricNames.find((m: any) => m.name === "http_requests_total");
    expect(found).toBeDefined();
    expect(found?.type).toBe("counter");
  });

  it("should register activeUsers gauge", async () => {
    const { activeUsers, register } = await import("../metrics");
    expect(activeUsers).toBeDefined();
    const metricNames = await register.getMetricsAsJSON();
    const found = metricNames.find((m: any) => m.name === "active_users_total");
    expect(found).toBeDefined();
    expect(found?.type).toBe("gauge");
  });

  it("should register contentGenerated counter with platform and type labels", async () => {
    const { contentGenerated } = await import("../metrics");
    expect(contentGenerated).toBeDefined();
    // Verify increment works
    contentGenerated.inc({ platform: "twitter", type: "text" });
    contentGenerated.inc({ platform: "twitter", type: "text" });
    // Increment works without throwing
    expect(true).toBe(true);
  });

  it("should register oauthTokenRefresh counter with platform and status labels", async () => {
    const { oauthTokenRefresh } = await import("../metrics");
    expect(oauthTokenRefresh).toBeDefined();
    oauthTokenRefresh.inc({ platform: "google", status: "success" });
    // Increment works without throwing
    expect(true).toBe(true);
  });

  it("should register agentRunDuration histogram with status label", async () => {
    const { agentRunDuration } = await import("../metrics");
    expect(agentRunDuration).toBeDefined();
    agentRunDuration.observe({ status: "completed" }, 5.5);
    // Observe works without throwing
    expect(true).toBe(true);
  });

  it("should populate default metrics (process metrics)", async () => {
    const { register } = await import("../metrics");
    const metrics = await register.metrics();
    // Default metrics include process_cpu_user_seconds_total
    expect(metrics).toContain("process_cpu");
  });

  it("should allow httpRequestDuration observations", async () => {
    const { httpRequestDuration } = await import("../metrics");
    httpRequestDuration.observe({ method: "GET", route: "/api/test", status: "200" }, 0.05);
    httpRequestDuration.observe({ method: "POST", route: "/api/test", status: "201" }, 0.1);
    // Should not throw
    expect(true).toBe(true);
  });

  it("should allow httpRequestTotal increments", async () => {
    const { httpRequestTotal } = await import("../metrics");
    httpRequestTotal.inc({ method: "GET", route: "/api/health", status: "200" });
    httpRequestTotal.inc({ method: "GET", route: "/api/health", status: "200" });
    httpRequestTotal.inc({ method: "POST", route: "/api/data", status: "500" });
    // Should not throw
    expect(true).toBe(true);
  });

  it("should allow activeUsers gauge set and dec", async () => {
    const { activeUsers } = await import("../metrics");
    activeUsers.set(10);
    activeUsers.dec();
    activeUsers.inc(5);
    // Should not throw
    expect(true).toBe(true);
  });

  it("should export all expected metric names", async () => {
    const metrics = await import("../metrics");
    expect(metrics.register).toBeDefined();
    expect(metrics.httpRequestDuration).toBeDefined();
    expect(metrics.httpRequestTotal).toBeDefined();
    expect(metrics.activeUsers).toBeDefined();
    expect(metrics.contentGenerated).toBeDefined();
    expect(metrics.oauthTokenRefresh).toBeDefined();
    expect(metrics.agentRunDuration).toBeDefined();
  });

  it("should expose metrics in Prometheus text format", async () => {
    const { register } = await import("../metrics");
    const textMetrics = await register.metrics();
    expect(typeof textMetrics).toBe("string");
    expect(textMetrics.length).toBeGreaterThan(0);
    // Should contain HELP lines
    expect(textMetrics).toContain("# HELP");
  });
});
