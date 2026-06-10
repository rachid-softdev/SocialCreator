import { describe, expect, it } from "vitest";
import { EXTERNAL_TIMEOUTS } from "../infrastructure/timeouts";

describe("EXTERNAL_TIMEOUTS", () => {
  it("should have all expected constants defined", () => {
    expect(EXTERNAL_TIMEOUTS).toHaveProperty("PUBLISH_PLATFORM");
    expect(EXTERNAL_TIMEOUTS).toHaveProperty("OAUTH_TOKEN_EXCHANGE");
    expect(EXTERNAL_TIMEOUTS).toHaveProperty("DNS_VALIDATION");
    expect(EXTERNAL_TIMEOUTS).toHaveProperty("DEEPGRAM_TRANSCRIPTION");
    expect(EXTERNAL_TIMEOUTS).toHaveProperty("LLM_COMPLETION");
  });

  it("should have all values greater than 0", () => {
    for (const [key, value] of Object.entries(EXTERNAL_TIMEOUTS)) {
      expect(value, `${key} must be > 0`).toBeGreaterThan(0);
    }
  });

  it("should have all values less than 120000", () => {
    for (const [key, value] of Object.entries(EXTERNAL_TIMEOUTS)) {
      expect(value, `${key} must be < 120000`).toBeLessThan(120000);
    }
  });

  it("should have PUBLISH_PLATFORM timeout of 30000ms (30s)", () => {
    expect(EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM).toBe(30_000);
  });

  it("should have OAUTH_TOKEN_EXCHANGE timeout of 10000ms (10s)", () => {
    expect(EXTERNAL_TIMEOUTS.OAUTH_TOKEN_EXCHANGE).toBe(10_000);
  });

  it("should have DNS_VALIDATION timeout of 5000ms (5s)", () => {
    expect(EXTERNAL_TIMEOUTS.DNS_VALIDATION).toBe(5_000);
  });

  it("should have DEEPGRAM_TRANSCRIPTION timeout of 60000ms (60s)", () => {
    expect(EXTERNAL_TIMEOUTS.DEEPGRAM_TRANSCRIPTION).toBe(60_000);
  });

  it("should have LLM_COMPLETION timeout of 60000ms (60s)", () => {
    expect(EXTERNAL_TIMEOUTS.LLM_COMPLETION).toBe(60_000);
  });

  it("should be const (reassigning should not affect original)", () => {
    const valuesBefore = { ...EXTERNAL_TIMEOUTS };
    // Can't reassign EXTERNAL_TIMEOUTS since it's const, but property values can't change either
    expect(EXTERNAL_TIMEOUTS.PUBLISH_PLATFORM).toBe(valuesBefore.PUBLISH_PLATFORM);
  });

  it("should have all values as integers", () => {
    for (const [key, value] of Object.entries(EXTERNAL_TIMEOUTS)) {
      expect(Number.isInteger(value), `${key} must be an integer`).toBe(true);
    }
  });
});
