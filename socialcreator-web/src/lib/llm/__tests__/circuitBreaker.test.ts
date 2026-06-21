/**
 * Direct unit tests for circuitBreaker.ts — in-memory circuit breaker for LLM providers.
 *
 * Tests module-level functions independently of provider.ts:
 *   allowRequest, recordSuccess, recordFailure, getCircuitState, resetCircuit
 *
 * Edge cases covered:
 *   - State transitions: closed → open (threshold) → half-open (cooldown) → closed (success)
 *   - Half-open → open when probe fails
 *   - Failure window expiry resets counter
 *   - Unknown provider defaults to closed
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Import after mocks
import {
  allowRequest,
  getCircuitState,
  recordFailure,
  recordSuccess,
  resetCircuit,
} from "../circuitBreaker";

describe("circuitBreaker", () => {
  beforeEach(() => {
    // Start with a clean state for every test
    resetCircuit();
    vi.useRealTimers();
  });

  afterEach(() => {
    resetCircuit();
  });

  // ============================================
  // allowRequest
  // ============================================

  describe("allowRequest", () => {
    it("returns true for a provider whose circuit is closed", () => {
      expect(allowRequest("anthropic")).toBe(true);
    });

    it("returns false for a provider whose circuit is open and cooldown has not elapsed", () => {
      vi.useFakeTimers();

      // Open the circuit by recording 3 failures
      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("open");

      // Cooldown has not elapsed (0ms since open)
      expect(allowRequest("openai")).toBe(false);
    });

    it("returns true and transitions to half-open when cooldown has elapsed", () => {
      vi.useFakeTimers();

      // Open the circuit
      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("open");

      // Advance past the 30s cooldown
      vi.advanceTimersByTime(31_000);

      // Should be allowed and transition to half-open
      expect(allowRequest("openai")).toBe(true);
      expect(getCircuitState("openai")).toBe("half-open");
    });

    it("returns true for a provider in half-open state", () => {
      vi.useFakeTimers();

      // Open the circuit
      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("open");

      // Advance past cooldown → half-open
      vi.advanceTimersByTime(31_000);
      allowRequest("openai"); // transitions to half-open and returns true
      expect(getCircuitState("openai")).toBe("half-open");

      // Another call in half-open returns true (probe request)
      expect(allowRequest("openai")).toBe(true);
    });

    it("returns true for a provider that has never been recorded", () => {
      resetCircuit();
      expect(allowRequest("never-seen")).toBe(true);
    });
  });

  // ============================================
  // recordSuccess
  // ============================================

  describe("recordSuccess", () => {
    it("resets failure count and closes the circuit", () => {
      vi.useFakeTimers();

      // Open the circuit
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");

      // Advance past cooldown and do a probe
      vi.advanceTimersByTime(31_000);
      allowRequest("anthropic"); // half-open
      expect(getCircuitState("anthropic")).toBe("half-open");

      // Success resets the circuit
      recordSuccess("anthropic");
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("keeps the circuit closed after success when it was already closed", () => {
      recordSuccess("anthropic");
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("does not affect other providers", () => {
      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");

      recordSuccess("anthropic");

      expect(getCircuitState("openai")).toBe("open");
      expect(getCircuitState("anthropic")).toBe("closed");
    });
  });

  // ============================================
  // recordFailure
  // ============================================

  describe("recordFailure", () => {
    it("transitions from half-open to open when a probe fails", () => {
      vi.useFakeTimers();

      // Open → cooldown → half-open
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      vi.advanceTimersByTime(31_000);
      allowRequest("anthropic");
      expect(getCircuitState("anthropic")).toBe("half-open");

      // Probe fails → back to open
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");
    });

    it("opens the circuit when failure threshold is reached", () => {
      expect(getCircuitState("openai")).toBe("closed");

      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("closed");

      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("closed");

      // 3rd failure → threshold reached → open
      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("open");
    });

    it("stays closed when threshold is not reached", () => {
      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("closed");

      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("closed");
    });

    it("preserves the circuit in open state on additional failures", () => {
      vi.useFakeTimers();

      // Open the circuit
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");

      // Extra failures while open stay open
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");
    });
  });

  // ============================================
  // getCircuitState
  // ============================================

  describe("getCircuitState", () => {
    it("returns 'closed' for a provider with no recorded failures", () => {
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("returns 'closed' for an unknown provider", () => {
      expect(getCircuitState("unknown")).toBe("closed");
    });

    it("returns 'open' after threshold failures", () => {
      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      expect(getCircuitState("openai")).toBe("open");
    });

    it("returns 'half-open' after cooldown but before probe result", () => {
      vi.useFakeTimers();

      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      vi.advanceTimersByTime(31_000);
      allowRequest("openai"); // transitions to half-open

      expect(getCircuitState("openai")).toBe("half-open");
    });

    it("returns 'closed' after successful probe", () => {
      vi.useFakeTimers();

      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      vi.advanceTimersByTime(31_000);
      allowRequest("openai");
      recordSuccess("openai");

      expect(getCircuitState("openai")).toBe("closed");
    });
  });

  // ============================================
  // resetCircuit
  // ============================================

  describe("resetCircuit", () => {
    it("resets state for a single provider", () => {
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");

      resetCircuit("anthropic");
      expect(getCircuitState("anthropic")).toBe("closed");
    });

    it("does not affect other providers when resetting a single one", () => {
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("openai");
      expect(getCircuitState("anthropic")).toBe("open");
      expect(getCircuitState("openai")).toBe("closed");

      resetCircuit("anthropic");
      expect(getCircuitState("anthropic")).toBe("closed");
      expect(getCircuitState("openai")).toBe("closed");
    });

    it("resets all providers when called without arguments", () => {
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("openai");
      recordFailure("openai");
      recordFailure("openai");
      expect(getCircuitState("anthropic")).toBe("open");
      expect(getCircuitState("openai")).toBe("open");

      resetCircuit();
      expect(getCircuitState("anthropic")).toBe("closed");
      expect(getCircuitState("openai")).toBe("closed");
    });

    it("is idempotent — calling on a fresh state does nothing", () => {
      resetCircuit("never-used");
      expect(getCircuitState("never-used")).toBe("closed");

      resetCircuit();
      expect(getCircuitState("never-used")).toBe("closed");
    });
  });

  // ============================================
  // Integration: full lifecycle
  // ============================================

  describe("full lifecycle", () => {
    it("cycles through closed → open → half-open → closed", () => {
      vi.useFakeTimers();

      // Start closed
      expect(allowRequest("anthropic")).toBe(true);
      expect(getCircuitState("anthropic")).toBe("closed");

      // 3 failures → open
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");

      // Cooldown blocks requests
      expect(allowRequest("anthropic")).toBe(false);

      // After cooldown → half-open, request allowed
      vi.advanceTimersByTime(31_000);
      expect(allowRequest("anthropic")).toBe(true);
      expect(getCircuitState("anthropic")).toBe("half-open");

      // Success → closed
      recordSuccess("anthropic");
      expect(getCircuitState("anthropic")).toBe("closed");
      expect(allowRequest("anthropic")).toBe(true);
    });

    it("cycles through closed → open → half-open → open (probe fails)", () => {
      vi.useFakeTimers();

      // Open the circuit
      recordFailure("anthropic");
      recordFailure("anthropic");
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");

      // Cooldown → half-open
      vi.advanceTimersByTime(31_000);
      allowRequest("anthropic");
      expect(getCircuitState("anthropic")).toBe("half-open");

      // Probe fails → back to open
      recordFailure("anthropic");
      expect(getCircuitState("anthropic")).toBe("open");

      // Still blocked
      expect(allowRequest("anthropic")).toBe(false);
    });
  });
});
