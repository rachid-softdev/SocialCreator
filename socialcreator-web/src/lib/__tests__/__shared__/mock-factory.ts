/**
 * Shared mock factories for Zustand store tests.
 * Provides localStorage mock (for persist middleware) and fetch response mock.
 */
import { vi } from "vitest";

/**
 * Creates a localStorage mock suitable for Zustand persist middleware tests.
 * Replaces globalThis.localStorage with a mock backed by a Map.
 *
 * @returns The mock Storage object and the underlying Map store
 */
export function mockLocalStorage(): {
  mock: Storage;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();

  const mock: Storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length(): number {
      return store.size;
    },
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    writable: true,
    configurable: true,
  });

  return { mock, store };
}

/**
 * Creates mock Response-like objects for fetch tests.
 *
 * @param data - The JSON body returned by the response
 * @param status - HTTP status code (default 200)
 */
export function mockFetchResponse<T = unknown>(
  data: T,
  status = 200,
): { json: () => Promise<T>; ok: boolean; status: number } {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}
