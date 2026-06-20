/**
 * In-memory circuit breaker for LLM providers.
 *
 * Tracks consecutive retryable failures per provider.
 * After FAILURE_THRESHOLD failures, the circuit opens and
 * subsequent requests are rejected until a cooldown period elapses.
 *
 * Interface (module-level functions):
 *   allowRequest(provider)  => true if call should proceed
 *   recordSuccess(provider) => resets failure count, closes circuit
 *   recordFailure(provider) => increments failure count, may open circuit
 *   getCircuitState(provider) => "closed" | "open" | "half-open"
 *   resetCircuit(provider?)  => reset state for one or all providers
 */

// ── Configuration ───────────────────────────────────────────────

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 30_000;
const FAILURE_WINDOW_MS = 30_000;

// ── Types ───────────────────────────────────────────────────────

export type CircuitState = "closed" | "open" | "half-open";

interface ProviderCircuit {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  lastStateChangeTime: number;
}

// ── Module-level state (not exported — use accessor functions) ──

const circuits = new Map<string, ProviderCircuit>();

// ── Helpers ─────────────────────────────────────────────────────

function getOrCreate(provider: string): ProviderCircuit {
  let entry = circuits.get(provider);
  if (!entry) {
    entry = { state: "closed", failureCount: 0, lastFailureTime: 0, lastStateChangeTime: 0 };
    circuits.set(provider, entry);
  }
  return entry;
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Whether a request to the given provider should be allowed.
 * When the circuit is closed  -> always allowed.
 * When half-open             -> allowed (trial request).
 * When open and cooldown elapsed -> transitions to half-open, allowed.
 * When open and cooldown not elapsed -> denied.
 */
export function allowRequest(provider: string): boolean {
  const entry = getOrCreate(provider);

  if (entry.state === "closed") return true;

  if (entry.state === "open") {
    const elapsed = Date.now() - entry.lastStateChangeTime;
    if (elapsed >= COOLDOWN_MS) {
      // Transition to half-open
      entry.state = "half-open";
      entry.lastStateChangeTime = Date.now();
      return true;
    }
    return false;
  }

  // half-open — allow the single probe request
  return true;
}

/**
 * Record a successful call. Closes the circuit and resets the
 * failure counter.
 */
export function recordSuccess(provider: string): void {
  const entry = getOrCreate(provider);
  entry.failureCount = 0;
  entry.state = "closed";
  entry.lastStateChangeTime = Date.now();
}

/**
 * Record a retryable failure.
 * - If the circuit was half-open it transitions back to open.
 * - If too much time passed since the last failure the counter resets.
 * - If the counter reaches the threshold the circuit opens.
 */
export function recordFailure(provider: string): void {
  const now = Date.now();
  const entry = getOrCreate(provider);
  entry.lastFailureTime = now;

  // half-open → back to open immediately (probe failed)
  if (entry.state === "half-open") {
    entry.state = "open";
    entry.lastStateChangeTime = now;
    return;
  }

  // Reset counter if the window between failures is too wide
  if (
    entry.state === "closed" &&
    entry.failureCount > 0 &&
    now - entry.lastFailureTime > FAILURE_WINDOW_MS
  ) {
    entry.failureCount = 0;
  }

  entry.failureCount++;

  // Open the circuit when threshold is reached
  if (entry.failureCount >= FAILURE_THRESHOLD && entry.state === "closed") {
    entry.state = "open";
    entry.lastStateChangeTime = now;
  }
}

/**
 * Return the current circuit state for a provider.
 */
export function getCircuitState(provider: string): CircuitState {
  return getOrCreate(provider).state;
}

/**
 * Reset circuit state for one provider, or all if no provider is given.
 * Useful for testing.
 */
export function resetCircuit(provider?: string): void {
  if (provider) {
    circuits.delete(provider);
  } else {
    circuits.clear();
  }
}
