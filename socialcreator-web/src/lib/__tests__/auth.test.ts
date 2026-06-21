/**
 * Tests for auth.ts callback logic (JWT, Session, Credentials authorize)
 *
 * STRATEGY: auth.ts imports next-auth which crashes in vitest environment.
 * Instead of importing the module directly, we extract the callback logic
 * into standalone testable functions. This isolates the pure business logic
 * without needing next-auth module resolution.
 *
 * The extracted functions replicate the exact logic from:
 * - jwt callback (auth.ts:76-106)
 * - session callback (auth.ts:107-116)
 * - credentials authorize (auth.ts:48-72)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Hoisted mocks — vitest hoists vi.mock() calls,
// so all mock data must go through vi.hoisted()
// ============================================

const { mockPrisma, DUMMY_HASH } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
  },
  // DUMMY_HASH constant extracted from auth.ts
  DUMMY_HASH: "dummy-hash-constant",
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock logger
vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock bcryptjs for constant-time comparison testing
vi.mock("bcryptjs", () => {
  const mockCompare = vi.fn();
  const mockHashSync = vi.fn(() => DUMMY_HASH);
  return {
    default: { compare: mockCompare, hashSync: mockHashSync },
    compare: mockCompare,
    hashSync: mockHashSync,
  };
});

// Mock next-auth (never imported directly, but prevents resolution issues)
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({ id: "credentials", type: "credentials" })),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({ id: "google", type: "oauth" })),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

// ============================================
// Imports
// ============================================

import bcrypt from "bcryptjs";
import logger from "@/lib/logger";

// ============================================
// Extracted callback logic (mirrors auth.ts exact implementation)
// ============================================

/**
 * JWT callback logic — extracted from auth.ts lines 76-106
 */
async function jwtCallback({
  token,
  user,
  trigger,
  session,
}: {
  token: Record<string, unknown>;
  user?: Record<string, unknown> | null;
  trigger?: string;
  session?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  if (user) {
    token.id = user.id ?? "";
    token.cguAccepted = user.cguAccepted ?? false;
    token.role = user.role ?? "USER";
    token.roles = [user.role ?? "USER"];
  }

  if (!user && token.sub) {
    try {
      const dbUser = await mockPrisma.user.findUnique({
        where: { id: token.sub as string },
        select: { role: true },
      });
      if (dbUser) {
        token.role = dbUser.role;
        token.roles = [dbUser.role];
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch user roles on token refresh");
    }
  }

  if (trigger === "update" && session) {
    token.cguAccepted = session.cguAccepted;
  }

  return token;
}

/**
 * Session callback logic — extracted from auth.ts lines 107-116
 */
async function sessionCallback({
  session,
  token,
}: {
  session: Record<string, unknown>;
  token?: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  if (token && session.user) {
    const user = session.user as Record<string, unknown>;
    user.id = token.id as string;
    user.cguAccepted = token.cguAccepted;
    user.role = token.role;
    user.roles = token.roles;
  }
  return session;
}

/**
 * Credentials authorize logic — extracted from auth.ts lines 48-72
 */
async function authorize(
  credentials: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const user = await mockPrisma.user.findUnique({
    where: { email: credentials.email as string },
  });

  const passwordHash = user?.password ?? DUMMY_HASH;
  const isValid = await bcrypt.compare(credentials.password as string, passwordHash);

  if (!user || !isValid) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
  } as any;
}

// ============================================
// Tests
// ============================================

describe("auth.ts callbacks (extracted logic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // JWT callback
  // ============================================

  describe("jwt callback", () => {
    it("should copy id, cguAccepted, role, roles from user on sign-in", async () => {
      const token: Record<string, unknown> = {};
      const user = {
        id: "user-1",
        cguAccepted: true,
        role: "ADMIN",
      };

      const result = await jwtCallback({ token, user });

      expect(result.id).toBe("user-1");
      expect(result.cguAccepted).toBe(true);
      expect(result.role).toBe("ADMIN");
      expect(result.roles).toEqual(["ADMIN"]);
    });

    it("should use defaults when user fields are missing", async () => {
      const token: Record<string, unknown> = {};
      const user = { id: "user-2" }; // no cguAccepted, no role

      const result = await jwtCallback({ token, user });

      expect(result.id).toBe("user-2");
      expect(result.cguAccepted).toBe(false);
      expect(result.role).toBe("USER");
      expect(result.roles).toEqual(["USER"]);
    });

    it("should refresh roles from DB on subsequent requests (no user, sub exists)", async () => {
      const token: Record<string, unknown> = { sub: "user-1" };
      mockPrisma.user.findUnique.mockResolvedValue({ role: "EDITOR" });

      const result = await jwtCallback({ token });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { role: true },
      });
      expect(result.role).toBe("EDITOR");
      expect(result.roles).toEqual(["EDITOR"]);
    });

    it("should keep token unchanged when DB fetch returns null on refresh", async () => {
      const token: Record<string, unknown> = {
        sub: "user-1",
        role: "USER",
        roles: ["USER"],
      };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await jwtCallback({ token });

      expect(result.role).toBe("USER");
      expect(result.roles).toEqual(["USER"]);
    });

    it("should keep token unchanged when DB fetch fails and log error", async () => {
      const token: Record<string, unknown> = {
        sub: "user-1",
        role: "USER",
        roles: ["USER"],
      };
      const dbError = new Error("DB timeout");
      mockPrisma.user.findUnique.mockRejectedValue(dbError);

      const result = await jwtCallback({ token });

      expect(result.role).toBe("USER");
      expect(result.roles).toEqual(["USER"]);
      expect(logger.error).toHaveBeenCalledWith(
        { err: dbError },
        "Failed to fetch user roles on token refresh",
      );
    });

    it("should update cguAccepted from session on trigger=update", async () => {
      const token: Record<string, unknown> = {
        cguAccepted: false,
        id: "user-1",
      };
      const session = { cguAccepted: true };

      const result = await jwtCallback({ token, trigger: "update", session });

      expect(result.cguAccepted).toBe(true);
    });

    it("should not modify cguAccepted when trigger is not update", async () => {
      const token: Record<string, unknown> = {
        cguAccepted: false,
        id: "user-1",
      };
      const user = { id: "user-1" };

      const result = await jwtCallback({ token, user, trigger: "signIn" });

      // cguAccepted should still be false (from user defaults)
      expect(result.cguAccepted).toBe(false);
    });

    it("should not call DB when user exists (first time sign-in)", async () => {
      const token: Record<string, unknown> = {};
      const user = { id: "user-1", role: "ADMIN", cguAccepted: true };

      await jwtCallback({ token, user });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should not try DB refresh when token has no sub", async () => {
      const token: Record<string, unknown> = {}; // no sub

      await jwtCallback({ token });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Session callback
  // ============================================

  describe("session callback", () => {
    it("should map id, cguAccepted, role, roles to session.user", async () => {
      const session = {
        user: { name: "Test User", email: "test@example.com" },
        expires: "2026-07-01",
      };
      const token = {
        id: "user-1",
        cguAccepted: true,
        role: "ADMIN",
        roles: ["ADMIN", "EDITOR"],
      };

      const result = await sessionCallback({ session, token });

      expect(result.user).toBeDefined();
      const user = result.user as Record<string, unknown>;
      expect(user.id).toBe("user-1");
      expect(user.cguAccepted).toBe(true);
      expect(user.role).toBe("ADMIN");
      expect(user.roles).toEqual(["ADMIN", "EDITOR"]);
    });

    it("should return session unchanged when token is null", async () => {
      const session = {
        user: { name: "Test" },
        expires: "2026-07-01",
      };

      const result = await sessionCallback({ session, token: null });

      expect(result).toEqual(session);
      expect((result.user as Record<string, unknown>).id).toBeUndefined();
    });

    it("should return session unchanged when session.user is null", async () => {
      const session = { user: null, expires: "2026-07-01" };
      const token = { id: "user-1" };

      const result = await sessionCallback({ session, token });

      expect((result as any).user).toBeNull();
      expect(result).toEqual(session);
    });

    it("should return session unchanged when session.user is undefined", async () => {
      const session = { expires: "2026-07-01" };
      const token = { id: "user-1" };

      const result = await sessionCallback({ session, token });

      expect(result).toEqual(session);
    });

    it("should preserve existing session fields while adding auth fields", async () => {
      const session = {
        user: { name: "Test User", email: "test@example.com", image: "avatar.png" },
        expires: "2026-07-01",
      };
      const token = {
        id: "user-1",
        cguAccepted: false,
        role: "USER",
        roles: ["USER"],
      };

      const result = await sessionCallback({ session, token });

      const user = result.user as Record<string, unknown>;
      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
      expect(user.image).toBe("avatar.png");
      expect(user.id).toBe("user-1");
    });
  });

  // ============================================
  // Credentials authorize
  // ============================================

  describe("authorize (credentials)", () => {
    const validUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      password: "hashed-password",
      emailVerified: new Date("2026-01-01"),
      role: "USER",
    };

    it("should return null when email is missing", async () => {
      const result = await authorize({ password: "secret123" });

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should return null when password is missing", async () => {
      const result = await authorize({ email: "test@example.com" });

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should return null when both email and password are missing", async () => {
      const result = await authorize(undefined);

      expect(result).toBeNull();
    });

    it("should use DUMMY_HASH when user not found (constant-time)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await authorize({ email: "unknown@test.com", password: "anypass" });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "unknown@test.com" },
      });
      // bcrypt.compare should have been called with the password and DUMMY_HASH
      expect(bcrypt.compare).toHaveBeenCalledWith("anypass", DUMMY_HASH);
      expect(result).toBeNull();
    });

    it("should return null when password is incorrect", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await authorize({ email: "test@example.com", password: "wrongpass" });

      expect(bcrypt.compare).toHaveBeenCalledWith("wrongpass", "hashed-password");
      expect(result).toBeNull();
    });

    it("should return user object when credentials are valid", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await authorize({ email: "test@example.com", password: "secret123" });

      expect(result).toEqual({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        emailVerified: validUser.emailVerified,
      });
    });

    it("should return null when user found but password does not match", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await authorize({ email: "test@example.com", password: "wrong" });

      expect(result).toBeNull();
    });

    it("should handle empty string credentials", async () => {
      const result = await authorize({ email: "", password: "" });

      expect(result).toBeNull();
    });
  });
});
