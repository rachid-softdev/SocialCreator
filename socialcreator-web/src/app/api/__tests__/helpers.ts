/**
 * Reusable test utilities for API route tests
 *
 * Provides factory functions for creating mock sessions, requests,
 * and Prisma delegates with sensible defaults.
 */

/**
 * Creates a mock NextAuth session object
 */
export function createMockSession(
  userId: string,
  overrides?: Partial<{
    user: Record<string, unknown>;
    expires: string;
  }>,
) {
  return {
    user: { id: userId, email: "test@example.com", name: "Test User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock NextRequest with optional JSON body
 *
 * Uses the standard Request constructor (available in node environment via undici).
 * For routes that need NextRequest-specific properties (nextUrl, ip, etc.),
 * pass them via the `headers` option or cast as needed.
 */
export function createMockRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Request {
  const body = options?.body !== undefined ? JSON.stringify(options.body) : undefined;

  return new Request(url, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body,
  });
}

/**
 * Creates a typed mock Prisma delegate with common CRUD methods
 *
 * Each method is a `vi.fn()` that can be further configured per test.
 * Pass `overrides` to replace specific methods or set default return values.
 *
 * @example
 * ```ts
 * const profile = createMockDelegate({
 *   findMany: vi.fn().mockResolvedValue([mockProfile]),
 * });
 * ```
 */
export function createMockDelegate(overrides?: Record<string, unknown>) {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a minimal mock content object for test assertions
 */
export function createMockContent(overrides?: Record<string, unknown>) {
  const now = new Date();
  return {
    id: "content-abc-123",
    profileId: "profile-abc-123",
    userId: "user-abc-123",
    status: "DRAFT",
    textContent: "Test content body",
    platform: "X",
    hashtags: ["#test"],
    mediaUrls: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a minimal mock profile object for test assertions
 */
export function createMockProfile(overrides?: Record<string, unknown>) {
  const now = new Date();
  return {
    id: "profile-abc-123",
    userId: "user-abc-123",
    name: "Test Profile",
    brandVoice: "Professional and engaging",
    contentBank: null,
    platforms: ["X", "LINKEDIN"],
    avatarUrl: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a minimal mock agent object for test assertions
 */
export function createMockAgent(overrides?: Record<string, unknown>) {
  const now = new Date();
  return {
    id: "agent-abc-123",
    profileId: "profile-abc-123",
    name: "Test Agent",
    type: "TEXT_POST",
    platforms: ["X", "LINKEDIN"],
    scheduleCron: null,
    autoPublish: false,
    maxPerDay: 2,
    isActive: true,
    config: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
